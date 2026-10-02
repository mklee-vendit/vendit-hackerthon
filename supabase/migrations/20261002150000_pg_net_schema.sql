-- `supabase db advisors` 지적: pg_net 이 public 스키마에 설치돼 있었다.
--
-- 앞 마이그레이션에서 `create extension pg_net;` 으로 스키마를 안 주는 바람에 extnamespace
-- 가 public 이 됐다. pg_net 은 relocatable = false 라 `alter extension ... set schema` 로는
-- 옮길 수 없어 다시 설치한다. 함수는 원래 `net` 스키마에 있으므로 호출부(net.http_post)는
-- 그대로다.
--
-- **지우면 `net._http_response` 의 보류 응답도 같이 사라진다.** 보낸 뒤 아직 거두지 않은
-- 요청이 있으면 그 식당은 이번 주기에 측정이 빠진다 — 다음 호출에서 다시 대상이 되므로
-- 복구되지만, 운영 중이라면 `public.walk_requests` 가 빈 때를 골라 적용해야 한다.
drop extension if exists pg_net;
create extension pg_net with schema extensions;

-- 적용 시점에 남아 있던 요청 짝은 응답이 사라졌으니 버린다. 두면 영원히 거둬지지 않는
-- 행으로 남아 `pending` 이 줄지 않고, 그 식당은 다시 보내지도 못한다(중복 방지 조건 때문).
delete from public.walk_requests;
