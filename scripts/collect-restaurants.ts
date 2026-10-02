/**
 * 식당 수집 (요구사항 §7 · 작업 B).
 *
 * 카카오 `카테고리로 장소 검색`(FD6)으로 사무실 반경 650m 안 음식점을 모아 `restaurants`
 * 에 넣을 SQL 을 만든다. 순수한 판단(타일 계획·쪼개기·중복 제거·경계)은
 * `src/shared/lib/collect/` 에 있고 테스트로 박제돼 있다. 이 파일은 **부수효과만** 맡는다.
 *
 *   bun scripts/collect-restaurants.ts
 *   bunx supabase db query --linked -f <출력된 경로>
 *
 * 출력은 `supabase/data/` 에 둔다 — `supabase/seed/` 가 아니다. CLI 의 seed 는
 * `config.toml` 의 `sql_paths` 만 보므로 거기 둬도 자동 적용되지 않는데, 이름 때문에
 * 자동으로 들어갔다고 오해하게 된다.
 *
 * **DB 에 직접 쓰지 않는다.** `restaurants` 는 클라이언트에게 읽기 전용이라 쓰려면
 * service_role 키가 필요한데, 그 키를 더 두지 않으려고 SQL 을 내보내고 CLI 로 적용한다
 * (CLI 는 이미 토큰으로 DB 에 붙는다). 올리기 전에 눈으로 볼 수 있다는 이점도 있다.
 *
 * 실패를 숨기지 않는다(§7·§10.5) — 타일 요청이 깨지거나 끝까지 45건에 걸려 잘린 타일이
 * 남으면 리포트에 적고 **종료 코드 1** 로 끝낸다. 그 상태의 결과를 "수집 완료"로 쓰면
 * 빠진 식당을 아무도 모른다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  COLLECT_RADIUS_M,
  KAKAO_CATEGORY_RESTAURANT,
  OFFICE,
} from '../src/shared/constants/office';
import {
  type CollectedRestaurant,
  collectPlaces,
  type KakaoPlace,
} from '../src/shared/lib/collect/places';
import {
  isTruncated,
  planTiles,
  QUERY_CAP,
  subdivideTile,
  type Tile,
} from '../src/shared/lib/collect/tiles';

/** 시작 타일 반지름. 반경 150m 에서 46곳이 나왔으므로(실측) 그보다 작게 잡는다. */
const START_TILE_RADIUS_M = 120;
/** 더 쪼개도 잘리면 멈춘다. 멈췄다는 사실은 리포트에 남는다. */
const MAX_DEPTH = 4;
const PAGE_SIZE = 15;

const KAKAO_CATEGORY_URL =
  'https://dapi.kakao.com/v2/local/search/category.json';

function readEnv(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(
      `${name} 가 없습니다. .env.local 에 넣어 주세요 (.env.example 참고).`,
    );
  }
  return value;
}

const KAKAO_KEY = readEnv('KAKAO_REST_API_KEY');

type Page = { places: KakaoPlace[]; totalCount: number };

async function fetchPage(tile: Tile, page: number): Promise<Page> {
  const url = new URL(KAKAO_CATEGORY_URL);
  url.searchParams.set('category_group_code', KAKAO_CATEGORY_RESTAURANT);
  url.searchParams.set('x', String(tile.center.lon));
  url.searchParams.set('y', String(tile.center.lat));
  url.searchParams.set('radius', String(Math.round(tile.radiusM)));
  url.searchParams.set('size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort', 'distance');

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!response.ok) {
    throw new Error(
      `카카오 ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = (await response.json()) as {
    documents?: KakaoPlace[];
    meta?: { total_count?: number };
  };
  return {
    places: body.documents ?? [],
    totalCount: body.meta?.total_count ?? 0,
  };
}

type Report = {
  requests: number;
  tilesVisited: number;
  subdivided: number;
  rawPlaces: number;
  failures: { tile: Tile; reason: string }[];
  stillTruncated: { tile: Tile; totalCount: number }[];
};

async function sweep(
  tile: Tile,
  depth: number,
  report: Report,
  out: KakaoPlace[],
) {
  report.tilesVisited += 1;

  let first: Page;
  try {
    report.requests += 1;
    first = await fetchPage(tile, 1);
  } catch (cause) {
    // 조용히 넘기지 않는다 — 이 타일이 담당한 영역은 "모은 적 없음" 으로 남는다.
    report.failures.push({ tile, reason: String(cause) });
    return;
  }
  // 잘려 있어도 받은 15건은 유효한 데이터다. 버리지 않고 합친다.
  out.push(...first.places);

  if (isTruncated(first.totalCount)) {
    if (depth >= MAX_DEPTH) {
      report.stillTruncated.push({ tile, totalCount: first.totalCount });
      return;
    }
    report.subdivided += 1;
    for (const part of subdivideTile(tile)) {
      await sweep(part, depth + 1, report, out);
    }
    return;
  }

  const lastPage = Math.ceil(first.totalCount / PAGE_SIZE);
  for (let page = 2; page <= lastPage; page += 1) {
    try {
      report.requests += 1;
      const next = await fetchPage(tile, page);
      out.push(...next.places);
    } catch (cause) {
      report.failures.push({ tile, reason: `page ${page}: ${cause}` });
    }
  }
}

/**
 * 멱등한 upsert SQL. 행마다 문자열을 이어 붙이지 않고 **JSON 한 덩어리**로 넘긴다 —
 * 식당 이름에 따옴표가 들어 있어도 이스케이프를 손으로 할 일이 없다.
 */
function toSql(rows: CollectedRestaurant[]): string {
  const payload = JSON.stringify(
    rows.map((r) => ({
      kakao_place_id: r.kakaoPlaceId,
      name: r.name,
      category: r.category,
      address: r.address,
      road_address: r.roadAddress,
      lon: r.lon,
      lat: r.lat,
    })),
  );
  // 달러 인용 안으로 들어가므로 구분자가 데이터에 나타나면 안 된다.
  if (payload.includes('$venparty$')) {
    throw new Error(
      '데이터에 SQL 구분자가 들어 있습니다 — 구분자를 바꿔야 합니다.',
    );
  }

  return `-- scripts/collect-restaurants.ts 가 만든 파일. 손으로 고치지 말고 다시 생성하세요.
-- 사무실 ${OFFICE.lat}, ${OFFICE.lon} / 반경 ${COLLECT_RADIUS_M}m / 식당 ${rows.length}곳
begin;

insert into public.restaurants
  (kakao_place_id, name, category, address, road_address, lon, lat, collected_at)
select
  kakao_place_id, name, category, address, road_address, lon, lat, now()
from jsonb_to_recordset($venparty$${payload}$venparty$::jsonb) as x(
  kakao_place_id text, name text, category text,
  address text, road_address text,
  lon double precision, lat double precision
)
on conflict (kakao_place_id) do update set
  name = excluded.name,
  category = excluded.category,
  address = excluded.address,
  road_address = excluded.road_address,
  lon = excluded.lon,
  lat = excluded.lat,
  -- 수집일은 **다시 본 날**로 갱신한다(§7). 언제 확인한 정보인지가 화면에 나간다.
  collected_at = now();

select count(*) as restaurants from public.restaurants;

commit;
`;
}

const tiles = planTiles({
  center: OFFICE,
  radiusM: COLLECT_RADIUS_M,
  tileRadiusM: START_TILE_RADIUS_M,
});

const report: Report = {
  requests: 0,
  tilesVisited: 0,
  subdivided: 0,
  rawPlaces: 0,
  failures: [],
  stillTruncated: [],
};

console.info(
  `타일 ${tiles.length}개 (반지름 ${START_TILE_RADIUS_M}m) 로 반경 ${COLLECT_RADIUS_M}m 를 훑습니다…`,
);

const raw: KakaoPlace[] = [];
for (const tile of tiles) {
  await sweep(tile, 0, report, raw);
}
report.rawPlaces = raw.length;

const rows = collectPlaces({
  places: raw,
  center: OFFICE,
  radiusM: COLLECT_RADIUS_M,
});

const outPath = resolve(
  import.meta.dir,
  '../supabase/data/restaurants.generated.sql',
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, toSql(rows), 'utf8');

const incomplete =
  report.failures.length > 0 || report.stillTruncated.length > 0;

console.info(`
── 수집 리포트
   방문한 타일        ${report.tilesVisited}
   쪼갠 타일          ${report.subdivided}  (결과가 ${QUERY_CAP}건을 넘어 잘린 타일)
   보낸 요청          ${report.requests}
   받은 장소(중복 포함) ${report.rawPlaces}
   반경 안 유일 식당   ${rows.length}
   요청 실패          ${report.failures.length}
   끝까지 잘린 타일    ${report.stillTruncated.length}

   SQL: ${outPath}
   적용: bunx supabase db query --linked -f "${outPath}"
`);

for (const f of report.failures) {
  console.error(
    `실패 tile(${f.tile.center.lat.toFixed(6)}, ${f.tile.center.lon.toFixed(6)}, r=${Math.round(f.tile.radiusM)}m): ${f.reason}`,
  );
}
for (const t of report.stillTruncated) {
  console.error(
    `아직 잘림 tile(${t.tile.center.lat.toFixed(6)}, ${t.tile.center.lon.toFixed(6)}, r=${Math.round(t.tile.radiusM)}m): total=${t.totalCount}`,
  );
}

if (incomplete) {
  console.error(
    '\n이 결과는 **불완전합니다.** 빠진 영역이 있으므로 "수집 완료" 로 쓰지 마세요(§7).',
  );
  process.exit(1);
}
