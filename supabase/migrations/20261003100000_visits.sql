-- 2a "다녀온 식당 후기 요청" 의 근거. 실제 방문은 알 수 없으므로 **네이버 길찾기 버튼을 누른 것을
-- 다녀온 것으로 본다**(jhey 결정, 2026-10-02). 당일 클릭도 바로 요청 대상이다.
--
-- 같은 날 같은 식당을 여러 번 눌러도 1행 — 날짜는 클라이언트 시계가 아니라 DB 의 KST 로 정한다.

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  restaurant_id uuid not null
    references public.restaurants (id) on delete cascade,
  visited_on date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now(),
  -- 토스트를 닫은 시각("후기 안 쓸래요" 또는 토스트에서 등록). 닫힌 방문은 다시 묻지 않는다.
  -- 후기를 썼는지는 저장하지 않는다 — 아래 뷰가 reviews 에서 계산한다.
  dismissed_at timestamptz,
  unique (user_id, restaurant_id, visited_on)
);

alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;
grant select on public.visits to authenticated;
-- user_id·visited_on 은 기본값이 채운다. 남의 이름·다른 날짜로 위조할 수 없게 컬럼을 막는다.
grant insert (restaurant_id) on public.visits to authenticated;
grant update (dismissed_at) on public.visits to authenticated;

create policy "visits: 내 것만 읽기" on public.visits
  for select to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));
create policy "visits: 내 것만 기록" on public.visits
  for insert to authenticated
  with check ((select public.is_member()) and user_id = (select auth.uid()));
create policy "visits: 내 것만 닫기" on public.visits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/*
 * 아직 묻지 않은 방문. 닫지 않았고, 누른 뒤로 그 식당에 내 후기(지우지 않은 것)가 없어야 한다 —
 * 토스트가 아니라 상세 화면에서 후기를 써도 요청이 저절로 사라진다.
 */
create view public.pending_review_requests with (security_invoker = true) as
select
  v.id,
  v.restaurant_id,
  r.name as restaurant_name,
  v.visited_on,
  v.created_at
from public.visits v
join public.restaurants r on r.id = v.restaurant_id
where v.user_id = (select auth.uid())
  and v.dismissed_at is null
  and not exists (
    select 1 from public.reviews rv
    where rv.author_id = v.user_id
      and rv.restaurant_id = v.restaurant_id
      and rv.created_at >= v.created_at
      and rv.deleted_at is null
  );

revoke all on public.pending_review_requests from anon, authenticated;
grant select on public.pending_review_requests to authenticated;
