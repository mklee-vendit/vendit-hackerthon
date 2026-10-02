/**
 * 네이버 플레이스 메뉴판 + 대표 사진 1장 수집.
 *
 *   bun scripts/collect-naver.ts
 *   bunx supabase db query --linked -f supabase/data/naver.generated.sql
 *   bun scripts/collect-naver.ts --sql-only   # 수집 중에 모인 만큼만 SQL 로
 *
 * 대상은 `restaurants.generated.sql` 의 식당 목록이다(브라우저 키로는 restaurants 를 못 읽는다).
 * 식당마다 요청 2번(이름+좌표 검색 → 메뉴 페이지). 결과는 `supabase/data/.naver-cache/` 에
 * 식당별로 남겨 중단돼도 이어서 돈다. 연속으로 막히면(캡차 등) 멈추고 종료 코드 1.
 * 판단은 `src/shared/lib/collect/naver.ts` 에 있고 테스트로 박제돼 있다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractApollo,
  listCandidates,
  mainPhoto,
  menuItems,
  type NaverMenuItem,
  pickMatch,
} from '../src/shared/lib/collect/naver';

type Restaurant = {
  kakao_place_id: string;
  name: string;
  lon: number;
  lat: number;
};
type Result = {
  kakao_place_id: string;
  naver_place_id: string | null;
  photo_url: string | null;
  menu: NaverMenuItem[];
};

const DATA = resolve(import.meta.dir, '../supabase/data');
const CACHE = resolve(DATA, '.naver-cache');
const OUT = resolve(DATA, 'naver.generated.sql');
// 2026-10-02 실측: 짧은 UA 에는 캐시가 빠진 페이지를 준다.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// 2026-10-02 실측: 0.8초 간격으로 10여 건 만에 429. 간격에 흔들림을 섞고, 429 는 쉬었다 다시 한다.
const DELAY_MS = 2500;
const BACKOFF_MS = [60_000, 180_000, 600_000];
const MAX_CONSECUTIVE_BLOCKS = 3;

const restaurants: Restaurant[] = JSON.parse(
  readFileSync(resolve(DATA, 'restaurants.generated.sql'), 'utf8').match(
    /\$venparty\$(\[.*?\])\$venparty\$/s,
  )?.[1] ?? '[]',
);
if (!restaurants.length)
  throw new Error('restaurants.generated.sql 에서 식당 목록을 못 읽었습니다');

async function apollo(url: string) {
  for (const wait of [...BACKOFF_MS, null]) {
    await Bun.sleep(DELAY_MS + Math.random() * DELAY_MS);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR' },
    });
    if (res.status === 429 && wait !== null) {
      console.error(`429 — ${wait / 1000}초 쉽니다`);
      await Bun.sleep(wait);
      continue;
    }
    const state = res.ok ? extractApollo(await res.text()) : null;
    if (!state) throw new Error(`막힘 또는 형식 변경: ${res.status} ${url}`);
    return state;
  }
  throw new Error('unreachable');
}

async function collect(r: Restaurant): Promise<Result> {
  const q = new URLSearchParams({
    query: r.name,
    x: String(r.lon),
    y: String(r.lat),
  });
  const list = await apollo(
    `https://pcmap.place.naver.com/restaurant/list?${q}`,
  );
  const hit = pickMatch(r, listCandidates(list));
  if (!hit) {
    return {
      kakao_place_id: r.kakao_place_id,
      naver_place_id: null,
      photo_url: null,
      menu: [],
    };
  }
  const page = await apollo(
    `https://pcmap.place.naver.com/restaurant/${hit.id}/menu/list`,
  );
  return {
    kakao_place_id: r.kakao_place_id,
    naver_place_id: hit.id,
    photo_url: mainPhoto(page),
    menu: menuItems(page),
  };
}

// --sql-only: 수집은 건너뛰고 지금까지 모인 캐시로 SQL 만 만든다(수집 중 중간 반영용).
const SQL_ONLY = process.argv.includes('--sql-only');
mkdirSync(CACHE, { recursive: true });
let blocks = 0;
for (const [i, r] of SQL_ONLY ? [] : restaurants.entries()) {
  const file = resolve(CACHE, `${r.kakao_place_id}.json`);
  if (existsSync(file)) continue;
  try {
    writeFileSync(file, JSON.stringify(await collect(r)));
    blocks = 0;
  } catch (e) {
    console.error(`[${i + 1}/${restaurants.length}] ${r.name}: ${e}`);
    if (++blocks >= MAX_CONSECUTIVE_BLOCKS) {
      console.error(
        '연속으로 막혀 멈춥니다. 잠시 뒤 다시 돌리면 이어서 합니다.',
      );
      process.exit(1);
    }
  }
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${restaurants.length}`);
}

const results: Result[] = restaurants.flatMap((r) => {
  const file = resolve(CACHE, `${r.kakao_place_id}.json`);
  return existsSync(file) ? [JSON.parse(readFileSync(file, 'utf8'))] : [];
});
const menus = results.flatMap((r) =>
  r.menu.map((m, position) => ({
    kakao_place_id: r.kakao_place_id,
    position,
    name: m.name,
    price: m.price,
    price_text: m.priceText,
  })),
);
const json = (v: unknown) => `$naver$${JSON.stringify(v)}$naver$`;

writeFileSync(
  OUT,
  `-- scripts/collect-naver.ts 가 만든 파일. 손으로 고치지 말고 다시 생성하세요.
begin;

insert into public.restaurant_naver (restaurant_id, naver_place_id, photo_url, collected_at)
select r.id, d.naver_place_id, d.photo_url, now()
from jsonb_to_recordset(${json(results.map(({ menu, ...rest }) => rest))})
  as d(kakao_place_id text, naver_place_id text, photo_url text)
join public.restaurants r using (kakao_place_id)
on conflict (restaurant_id) do update set
  naver_place_id = excluded.naver_place_id,
  photo_url = excluded.photo_url,
  collected_at = now();

delete from public.naver_menu_items m
using public.restaurants r
where m.restaurant_id = r.id
  and r.kakao_place_id in (select jsonb_array_elements_text(${json(results.map((r) => r.kakao_place_id))}));

insert into public.naver_menu_items (restaurant_id, position, name, price, price_text)
select r.id, d.position, d.name, d.price, d.price_text
from jsonb_to_recordset(${json(menus)})
  as d(kakao_place_id text, position int, name text, price int, price_text text)
join public.restaurants r using (kakao_place_id);

commit;

select count(*) filter (where naver_place_id is not null) as matched,
       count(*) filter (where naver_place_id is null) as unmatched,
       count(*) filter (where photo_url is not null) as with_photo
from public.restaurant_naver;
select count(*) as menu_items from public.naver_menu_items;
`,
);

const matched = results.filter((r) => r.naver_place_id);
console.log(
  `대상 ${restaurants.length} · 수집 ${results.length} · 매칭 ${matched.length} · 사진 ${matched.filter((r) => r.photo_url).length} · 메뉴 있는 곳 ${matched.filter((r) => r.menu.length).length} · 메뉴 ${menus.length}개 (숫자 가격 ${menus.filter((m) => m.price !== null).length})`,
);
console.log(`→ ${OUT}`);
if (!SQL_ONLY && results.length < restaurants.length) process.exit(1);
