-- 검색 화면 맨 아래 줄("식당 정보 10.01 수집 · 도보 경로 실패 2곳")에 쓰는 값.
--
-- **수집 실패를 숨기지 않기 위한 표시다**(§7). 화면에서 세지 않고 여기서 한 번만 센다 —
-- 쓰는 쪽마다 세면 숫자가 갈린다(§10.1).
--
-- 세 가지를 구별한다.
--   measured   : 재서 값이 있다
--   failed     : 재봤지만 실패했다 (경로 없음 등) → 화면에 도보 "—"
--   unmeasured : 아직 재본 적이 없다 (측정 스크립트를 돌려야 한다)
-- 둘을 뭉치면 "스크립트를 안 돌린 것" 과 "길이 없는 것" 을 구별할 수 없다.
create view public.collection_status with (security_invoker = true) as
select
  (select max(collected_at) from public.restaurants) as collected_at,
  (select count(*) from public.restaurants) as restaurant_count,
  (select count(*) from public.walk_times where seconds is not null) as walk_measured,
  (select count(*) from public.walk_times where seconds is null) as walk_failed,
  (
    select count(*)
    from public.restaurants r
    where not exists (
      select 1 from public.walk_times w where w.restaurant_id = r.id
    )
  ) as walk_unmeasured;

revoke all on public.collection_status from anon, authenticated;
grant select on public.collection_status to authenticated;
