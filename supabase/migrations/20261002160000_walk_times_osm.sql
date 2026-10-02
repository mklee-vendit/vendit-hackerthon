-- 도보 시간을 TMAP → OpenStreetMap(Valhalla) 으로 바꾸고, 갱신 기계를 **걷어낸다**.
--
-- 매일 다시 재던 이유는 데이터가 변해서가 아니라 TMAP 약관("저장 후 24시간 이상 사용할 수
-- 없습니다") 때문이었다. OSM 은 그 제한이 없다 — ODbL 은 라우팅 결과 저장을 막지 않고
-- 출처 표기만 요구한다. 사무실 좌표도 식당 좌표도 안 바뀌면 도보 시간도 안 바뀌므로,
-- **식당 데이터가 변할 때 한 번만** 재서 넣어두면 끝이다.
--
-- 그래서 사라지는 것: 23시간 재측정 · 24시간 만료 뷰 · pg_net 비동기 거두기 · 중복 발사
-- 잠금 · Vault 의 TMAP 키. 클라이언트가 트리거할 것도 없다.
--
-- 품질은 같은 식당 8곳으로 TMAP 과 대조했다(`docs/api-survey.md`). 보행속도를 4.6km/h 로
-- 맞추면 평균 편차 -0.4%, 절대편차 9.5% 이고 **5·10·15·20분 상한 판정이 갈린 것은 32번 중
-- 1번**이다 — §6 하드 필터의 결과가 실질적으로 같다.

drop view if exists public.walk_times_fresh;
drop function if exists public.walk_times_refresh(int);
drop function if exists private.tmap_app_key();
drop table if exists public.walk_requests;
drop table if exists public.walk_refresh_state;
drop extension if exists pg_net;
drop schema if exists private cascade;

-- TMAP 키는 더 쓰지 않는다. Vault 에서도 지운다.
delete from vault.secrets where name = 'tmap_app_key';

-- 측정 출처를 남긴다. 나중에 라우터를 바꾸면 어느 행이 어디서 왔는지 알아야 한다.
alter table public.walk_times
  add column source text not null default 'valhalla-osm';

comment on table public.walk_times is
  '사무실 → 식당 보행자 도보 시간. **식당 데이터가 변할 때 한 번만** 재서 영구 저장한다. '
  'OSM(ODbL)은 저장을 막지 않는다. 측정 실패는 seconds = null 로 남기고 직선거리로 '
  '대체하지 않는다(§7) — 화면에는 도보 "—" 로 나간다.';

/*
 * 쓸 수 있는 측정만 내놓는다. 실패한 행(seconds is null)은 걸러서, 쓰는 쪽이 매번 같은
 * 조건을 반복하지 않게 한다(§10.1). **시간 제한은 없다** — 영구 저장이 가능해졌다.
 */
create view public.walk_times_valid with (security_invoker = true) as
select restaurant_id, seconds, distance_m, measured_at, source
from public.walk_times
where seconds is not null;

revoke all on public.walk_times_valid from anon, authenticated;
grant select on public.walk_times_valid to authenticated;

-- 측정 결과를 넣는 것은 스크립트(권한 있는 롤)뿐이다. 클라이언트는 여전히 읽기만 한다 —
-- 쓰기를 열면 누구나 자기 단골을 "도보 1분" 으로 적을 수 있고 §6 필터가 그 값으로 판정된다.
