-- 도보 시간 갱신 — **DB 안에서** 돈다. 운영할 서버도 cron 도 없다(작업 C).
--
-- 클라이언트는 `public.walk_times_refresh()` 하나만 부른다. 처음 터치한 사람이 트리거가
-- 되고, TMAP 호출은 Postgres 가 `pg_net` 으로 직접 한다.
--
-- **브라우저가 TMAP 을 부르지 않는 이유가 두 가지다.**
--   1. 키가 번들에 들어간다 — 누구나 꺼내 일 1,000건 무료 한도를 태울 수 있고, TMAP 약관의
--      "다수 프로젝트 사용은 불법 사용" 조항에도 걸린다.
--   2. 도보 시간이 **클라이언트가 주장하는 값**이 된다. 쓰기 권한을 주면 누구나 자기 단골을
--      "도보 1분" 으로 적을 수 있고, §6 하드 필터 1번이 그 값으로 판정된다. 서버가 직접
--      재지 않으면 검증할 방법이 없다.
--
-- **pg_net 은 비동기다** — "HTTP requests are not started until the transaction is
-- committed". 그래서 한 번의 호출로 보내고 받을 수 없고, 매 호출이
-- "지난번 응답을 거둔다 → 새로 보낸다" 두 단계를 한다. 클라이언트가 몇 초 간격으로 두세 번
-- 부르면 수렴한다.

create extension if not exists pg_net;

-- API 로 노출되지 않는 자리. config.toml 의 `api.schemas` 가 public 만 열어 둔다.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- ── 사무실 좌표 ─────────────────────────────────────────────────────────────
-- 정본은 `src/shared/constants/office.ts` 이고 이 행은 **수집 스크립트가 함께 써 준다**.
-- 두 곳에 손으로 적어 두면 한쪽만 고쳐져 갈린다(§10.1) — 수집 결과와 같은 트랜잭션에서
-- 갱신되므로 식당 목록과 중심이 항상 짝이 맞는다.
create table public.office_location (
  singleton boolean primary key default true check (singleton),
  lon double precision not null,
  lat double precision not null,
  updated_at timestamptz not null default now()
);

-- ── 갱신 상태 (단일 행) ─────────────────────────────────────────────────────
create table public.walk_refresh_state (
  singleton boolean primary key default true check (singleton),
  -- "가장 최근에 성공적으로 다 거둔 시각". 화면에 "N분 전 기준" 으로 쓸 수 있다.
  last_success_at timestamptz,
  -- 동시에 열린 클라이언트가 같은 요청을 중복 발사하지 않게 하는 잠금.
  enqueued_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.walk_refresh_state (singleton) values (true);

-- 보낸 요청 ↔ 식당. 응답을 거둘 때 짝을 찾는 데 쓰고, 거두면 지운다.
create table public.walk_requests (
  request_id bigint primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index walk_requests_by_restaurant on public.walk_requests (restaurant_id);

-- ── 키 ──────────────────────────────────────────────────────────────────────
-- Vault 에 넣고 여기서만 읽는다. 마이그레이션에는 값이 들어가지 않는다(§10.11).
create or replace function private.tmap_app_key()
returns text language sql security definer stable set search_path = '' as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'tmap_app_key';
$fn$;

revoke all on function private.tmap_app_key() from anon, authenticated, public;

-- ── 갱신 ────────────────────────────────────────────────────────────────────

/*
 * 23시간이 지나면 다시 잰다. TMAP 약관이 "저장 후 24시간 이상 사용" 을 막으므로 한 시간
 * 앞서 갱신해, 쓰는 쪽이 만료된 값을 보지 않게 한다.
 */
create or replace function public.walk_times_refresh(batch_size int default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  stale_after interval := interval '23 hours';
  enqueue_lock interval := interval '2 minutes';
  harvested int := 0;
  failed int := 0;
  enqueued int := 0;
  pending int;
  stale int;
  office record;
  key text;
  target record;
  response record;
  secs int;
  dist int;
  locked boolean;
begin
  if not public.is_member() then
    raise exception '멤버만 호출할 수 있습니다';
  end if;

  -- ① 지난번에 보낸 요청의 응답을 거둔다.
  for response in
    select r.request_id, r.restaurant_id, h.status_code, h.content,
           h.timed_out, h.error_msg
    from public.walk_requests r
    join net._http_response h on h.id = r.request_id
  loop
    secs := null;
    dist := null;

    if response.status_code = 200 and response.content is not null then
      begin
        secs := (response.content::jsonb -> 'features' -> 0 -> 'properties'
                 ->> 'totalTime')::int;
        dist := (response.content::jsonb -> 'features' -> 0 -> 'properties'
                 ->> 'totalDistance')::int;
      exception when others then
        secs := null;
        dist := null;
      end;
    end if;

    -- 실패는 **실패로 남긴다**. 직선거리로 메우지 않는다(§7) — 화면에는 도보 "—" 로 나간다.
    insert into public.walk_times
      (restaurant_id, seconds, distance_m, measured_at, failure)
    values (
      response.restaurant_id, secs, dist, now(),
      case
        when secs is not null then null
        when response.timed_out then '타임아웃'
        when response.error_msg is not null then response.error_msg
        else 'HTTP ' || coalesce(response.status_code::text, '?')
      end
    )
    on conflict (restaurant_id) do update set
      seconds = excluded.seconds,
      distance_m = excluded.distance_m,
      measured_at = excluded.measured_at,
      failure = excluded.failure;

    if secs is null then failed := failed + 1; else harvested := harvested + 1; end if;
    delete from public.walk_requests where request_id = response.request_id;
  end loop;

  -- ② 아직 보낸 뒤 응답이 안 온 요청.
  select count(*) into pending from public.walk_requests;

  -- ③ 재야 할 식당 — **후기가 있는 식당만**(확정). 후기 0개는 §6 에서 도보 필터 판정
  --    대상이 아니므로 도보 시간이 필요 없다.
  create temp table if not exists _targets (restaurant_id uuid primary key) on commit drop;
  insert into _targets (restaurant_id)
  select r.id
  from public.restaurants r
  where exists (
          select 1 from public.reviews rv
          where rv.restaurant_id = r.id and rv.deleted_at is null)
    and not exists (
          select 1 from public.walk_requests q where q.restaurant_id = r.id)
    and not exists (
          select 1 from public.walk_times w
          where w.restaurant_id = r.id
            and w.measured_at is not null
            and w.measured_at > now() - stale_after)
  on conflict do nothing;

  select count(*) into stale from _targets;

  -- ④ 동시에 열린 클라이언트가 같은 요청을 중복 발사하지 않게 한 명만 통과시킨다.
  --    조건부 UPDATE 가 잠금이다 — 0행이면 다른 클라이언트가 방금 보냈다는 뜻이다.
  update public.walk_refresh_state
     set enqueued_at = now(), updated_at = now()
   where singleton
     and (enqueued_at is null or enqueued_at < now() - enqueue_lock)
  returning true into locked;

  if coalesce(locked, false) and stale > 0 then
    select * into office from public.office_location where singleton;
    if office is null then
      raise exception '사무실 좌표가 없습니다 — 먼저 수집 스크립트를 적용하세요';
    end if;
    key := private.tmap_app_key();
    if key is null then
      raise exception 'Vault 에 tmap_app_key 가 없습니다 — docs/auth-setup.md 참고';
    end if;

    for target in
      select t.restaurant_id, r.lon, r.lat, r.name
      from _targets t join public.restaurants r on r.id = t.restaurant_id
      limit batch_size
    loop
      insert into public.walk_requests (request_id, restaurant_id)
      values (
        net.http_post(
          url := 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1',
          body := jsonb_build_object(
            'startX', office.lon::text, 'startY', office.lat::text,
            'endX', target.lon::text, 'endY', target.lat::text,
            'reqCoordType', 'WGS84GEO', 'resCoordType', 'WGS84GEO',
            -- TMAP 은 이름을 URL 인코딩해서 받는다. 판정에 쓰지 않으므로 고정값으로 보낸다.
            'startName', 'office', 'endName', 'destination'
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json', 'appKey', key),
          timeout_milliseconds := 10000
        ),
        target.restaurant_id
      );
      enqueued := enqueued + 1;
    end loop;
  end if;

  -- ⑤ 거둘 것도 보낼 것도 없으면 "최신" 이다.
  if pending = 0 and stale = 0 then
    update public.walk_refresh_state
       set last_success_at = now(), last_error = null, updated_at = now()
     where singleton;
  end if;

  return jsonb_build_object(
    'harvested', harvested,
    'failed', failed,
    'enqueued', enqueued,
    'pending', pending,
    'stale', stale,
    'done', pending = 0 and stale = 0
  );
end;
$fn$;

revoke all on function public.walk_times_refresh(int) from anon, public;
grant execute on function public.walk_times_refresh(int) to authenticated;

-- ── 읽는 쪽 ─────────────────────────────────────────────────────────────────
/*
 * **24시간을 넘긴 값은 아예 내놓지 않는다.** TMAP 약관이 그 뒤로는 쓰지 못하게 하므로,
 * 낡은 값을 화면에 띄우면 약관 위반이고 사용자에게도 거짓말이다. 실패한 측정도 내놓지
 * 않는다 — 둘 다 "없음" 으로 보이고, 화면은 도보 "—" 를 그린다(§7).
 *
 * 쓰는 쪽이 기간을 따로 계산하지 않게 **여기서 한 번만** 거른다(§10.1).
 */
create view public.walk_times_fresh with (security_invoker = true) as
select restaurant_id, seconds, distance_m, measured_at
from public.walk_times
where seconds is not null
  and measured_at is not null
  and measured_at > now() - interval '24 hours';

-- ── 권한 ────────────────────────────────────────────────────────────────────

alter table public.office_location enable row level security;
alter table public.walk_refresh_state enable row level security;
alter table public.walk_requests enable row level security;

revoke all on public.office_location from anon, authenticated;
revoke all on public.walk_refresh_state from anon, authenticated;
revoke all on public.walk_requests from anon, authenticated;
revoke all on public.walk_times_fresh from anon, authenticated;

grant select on public.office_location to authenticated;
create policy "office_location: 멤버만 읽기" on public.office_location
  for select to authenticated using ((select public.is_member()));

-- 갱신 상태는 읽기만. 쓰는 것은 walk_times_refresh() 뿐이다(security definer).
grant select on public.walk_refresh_state to authenticated;
create policy "walk_refresh_state: 멤버만 읽기" on public.walk_refresh_state
  for select to authenticated using ((select public.is_member()));

-- walk_requests 는 내부 배선이라 클라이언트가 볼 일이 없다 — 정책을 만들지 않는다.

grant select on public.walk_times_fresh to authenticated;
