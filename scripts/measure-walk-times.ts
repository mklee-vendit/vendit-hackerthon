/**
 * 사무실 → 식당 보행자 도보 시간 측정 (요구사항 §7 · 작업 C).
 *
 *   bun scripts/measure-walk-times.ts
 *   bunx supabase db query --linked -f <출력된 경로>
 *
 * OpenStreetMap(Valhalla) 을 쓴다. **결과를 영구 저장한다** — ODbL 은 라우팅 결과 저장을
 * 막지 않고 출처 표기만 요구한다. 그래서 식당 데이터가 변할 때만 재면 된다.
 *
 * **아직 측정되지 않은 식당만** 집는다. 다시 돌려도 이미 잰 것을 또 부르지 않으므로,
 * 새 식당이 생기면 그만큼만 추가로 잰다.
 *
 * 공개 인스턴스는 자원봉사로 운영된다 — **1 call/sec 를 넘기지 않는다.**
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { $ } from 'bun';
import type { LatLng } from '../src/shared/lib/collect/geo';
import {
  parseValhalla,
  VALHALLA_MIN_INTERVAL_MS,
  valhallaRequestUrl,
  WALKING_SPEED_KMH,
} from '../src/shared/lib/collect/walk';

type Target = { id: string; name: string; lon: number; lat: number };

const PENDING_SQL = `
select coalesce(json_agg(json_build_object(
         'id', r.id, 'name', r.name, 'lon', r.lon, 'lat', r.lat)), '[]'::json) as rows
from public.restaurants r
where not exists (select 1 from public.walk_times w where w.restaurant_id = r.id);
`;

const OFFICE_SQL = `
select coalesce(json_agg(json_build_object('lon', lon, 'lat', lat)), '[]'::json) as rows
from public.office_location;
`;

/** CLI 로 DB 를 읽는다 — 여기만 DB 를 아는 자리이고, 판정 로직은 shared/lib 에 있다. */
async function queryRows<T>(sql: string): Promise<T[]> {
  const out = await $`bunx supabase db query --linked ${sql}`.quiet().text();
  const start = out.indexOf('{');
  if (start < 0)
    throw new Error(`DB 응답을 읽을 수 없습니다: ${out.slice(0, 300)}`);
  const parsed = JSON.parse(out.slice(start)) as {
    rows?: { rows?: T[] }[];
  };
  return parsed.rows?.[0]?.rows ?? [];
}

const [office] = await queryRows<LatLng>(OFFICE_SQL);
if (!office) {
  throw new Error(
    '사무실 좌표가 없습니다 — 먼저 bun run collect 결과를 적용하세요.',
  );
}

const targets = await queryRows<Target>(PENDING_SQL);
console.info(
  `측정 대상 ${targets.length}곳 · 보행속도 ${WALKING_SPEED_KMH}km/h · ` +
    `${VALHALLA_MIN_INTERVAL_MS}ms 간격 → 예상 ${Math.ceil((targets.length * VALHALLA_MIN_INTERVAL_MS) / 60000)}분`,
);

if (targets.length === 0) {
  console.info('측정할 식당이 없습니다. 끝냅니다.');
  process.exit(0);
}

type Row = {
  restaurant_id: string;
  seconds: number | null;
  distance_m: number | null;
  failure: string | null;
};

const rows: Row[] = [];
let ok = 0;
let failed = 0;
let lastAt = 0;

for (const [index, target] of targets.entries()) {
  // 간격을 **보낸 시점 기준**으로 지킨다. 응답이 늦어 이미 지났으면 바로 보낸다.
  const wait = lastAt + VALHALLA_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastAt = Date.now();

  let result: ReturnType<typeof parseValhalla>;
  try {
    const response = await fetch(valhallaRequestUrl(office, target), {
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => null);
    result = parseValhalla(response.status, body);
  } catch (cause) {
    result = { ok: false, failure: String(cause).slice(0, 200) };
  }

  if (result.ok) {
    ok += 1;
    rows.push({
      restaurant_id: target.id,
      seconds: result.value.seconds,
      distance_m: result.value.distanceM,
      failure: null,
    });
  } else {
    failed += 1;
    // 실패도 **행으로 남긴다** — 다시 돌릴 때 건너뛰고, 실패 목록으로 드러난다(§7).
    rows.push({
      restaurant_id: target.id,
      seconds: null,
      distance_m: null,
      failure: result.failure,
    });
  }

  if ((index + 1) % 100 === 0 || index + 1 === targets.length) {
    console.info(
      `  ${index + 1}/${targets.length}  성공 ${ok} · 실패 ${failed}`,
    );
  }
}

const payload = JSON.stringify(rows);
if (payload.includes('$venparty$')) {
  throw new Error(
    '데이터에 SQL 구분자가 들어 있습니다 — 구분자를 바꿔야 합니다.',
  );
}

const sql = `-- scripts/measure-walk-times.ts 가 만든 파일. 손으로 고치지 말고 다시 생성하세요.
-- 출처: OpenStreetMap (Valhalla, 보행속도 ${WALKING_SPEED_KMH}km/h) · 측정 ${rows.length}곳
-- 성공 ${ok} · 실패 ${failed}
begin;

insert into public.walk_times
  (restaurant_id, seconds, distance_m, measured_at, failure, source)
select
  (x.restaurant_id)::uuid, x.seconds, x.distance_m, now(), x.failure, 'valhalla-osm'
from jsonb_to_recordset($venparty$${payload}$venparty$::jsonb) as x(
  restaurant_id text, seconds int, distance_m int, failure text
)
on conflict (restaurant_id) do update set
  seconds = excluded.seconds,
  distance_m = excluded.distance_m,
  measured_at = excluded.measured_at,
  failure = excluded.failure,
  source = excluded.source;

select
  count(*) as walk_times,
  count(*) filter (where seconds is not null) as measured,
  count(*) filter (where seconds is null) as failed
from public.walk_times;

commit;
`;

const outPath = resolve(
  import.meta.dir,
  '../supabase/data/walk-times.generated.sql',
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sql, 'utf8');

console.info(`
── 측정 리포트
   대상        ${targets.length}
   성공        ${ok}
   실패        ${failed}

   SQL: ${outPath}
   적용: bunx supabase db query --linked -f "${outPath}"
`);

if (failed > 0) {
  console.error(
    `${failed}곳은 측정하지 못했습니다. 직선거리로 대체하지 않으므로 화면에는 도보 "—" 로 나갑니다(§7).`,
  );
}
