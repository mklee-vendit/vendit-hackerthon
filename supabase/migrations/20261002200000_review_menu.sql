-- 대표 메뉴. **API 에 없는 정보는 벤더가 후기 쓸 때 같이 입력한다**(§3 의 기존 패턴) —
-- 1인 가격·단체석·식사 제약과 같은 길이다. 네이버·카카오 어느 쪽도 메뉴를 주지 않는다.

create table public.review_menu_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  -- 적은 순서를 지킨다. 후기 작성자가 먹은 순서대로 적을 수 있다.
  position smallint not null default 0,
  constraint review_menu_items_name_length
    check (char_length(name) between 1 and 40),
  -- 한 후기에 같은 메뉴를 두 번 적지 않는다.
  unique (review_id, name)
);

create index review_menu_items_by_review on public.review_menu_items (review_id);

-- 이름을 NFC 로 맞춘다(§10.13). 안 하면 같은 메뉴가 자모 분리 여부에 따라 둘로 갈려
-- 집계에서 따로 세어진다.
create or replace function public.review_menu_items_before_write()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.name := normalize(btrim(new.name), nfc);
  return new;
end;
$fn$;

create trigger review_menu_items_before_write
  before insert or update on public.review_menu_items
  for each row execute function public.review_menu_items_before_write();

alter table public.review_menu_items enable row level security;
revoke all on public.review_menu_items from anon, authenticated;
grant select on public.review_menu_items to authenticated;
grant insert (review_id, name, price, position) on public.review_menu_items
  to authenticated;
grant delete on public.review_menu_items to authenticated;

create policy "review_menu_items: 멤버만 읽기" on public.review_menu_items
  for select to authenticated using ((select public.is_member()));

-- 내 후기에 달린 것만 손댈 수 있다. 수정은 지우고 다시 넣는다(태그와 같은 방식).
create policy "review_menu_items: 내 후기에만 추가" on public.review_menu_items
  for insert to authenticated with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.author_id = (select auth.uid())
        and r.deleted_at is null
    )
  );
create policy "review_menu_items: 내 후기에서만 제거" on public.review_menu_items
  for delete to authenticated using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.author_id = (select auth.uid())
    )
  );

/*
 * 식당별 메뉴 집계. **지워진 후기는 빠진다**(§9) — 집계를 저장하지 않고 후기에서 계산하는
 * 이유가 이것이다.
 *
 * 가격이 후기마다 다를 수 있으므로(가격 인상, 사이즈 차이) 어느 값을 쓸지 고르지 않고
 * **재료를 다 내놓는다** — 고르는 일은 추천 로직의 rules 한 곳에서 한다(§10.1·§10.4).
 */
create view public.restaurant_menu_stats with (security_invoker = true) as
select
  rv.restaurant_id,
  m.name,
  count(*) as mention_count,
  min(m.price) as price_min,
  max(m.price) as price_max,
  round(avg(m.price))::int as price_avg,
  percentile_cont(0.5) within group (order by m.price)::int as price_median,
  max(rv.created_at) as latest_at
from public.review_menu_items m
join public.reviews rv on rv.id = m.review_id and rv.deleted_at is null
group by rv.restaurant_id, m.name;

revoke all on public.restaurant_menu_stats from anon, authenticated;
grant select on public.restaurant_menu_stats to authenticated;

/*
 * 후기와 메뉴를 **한 트랜잭션에서** 넣는다.
 *
 * 둘로 나눠 보내면 후기만 저장되고 메뉴가 빠진 상태가 남는다 — 그러면 카드의 대표 메뉴가
 * 비는데 작성자는 적었다고 기억한다. 함수 하나로 묶으면 둘 다 들어가거나 둘 다 안 들어간다.
 *
 * **security invoker 다** — RLS 를 우회하지 않는다. author_id 는 컬럼 기본값 auth.uid() 가
 * 채우고, 멤버가 아니면 insert 정책에서 막힌다.
 */
create or replace function public.create_review(
  p_restaurant_id uuid,
  p_body text,
  p_rating smallint,
  p_recommends boolean,
  p_price_per_person integer,
  p_party_size integer default null,
  p_menu jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  new_id uuid;
begin
  insert into public.reviews
    (restaurant_id, body, rating, recommends, price_per_person, party_size)
  values
    (p_restaurant_id, p_body, p_rating, p_recommends, p_price_per_person,
     p_party_size)
  returning id into new_id;

  insert into public.review_menu_items (review_id, name, price, position)
  select
    new_id,
    item ->> 'name',
    (item ->> 'price')::int,
    (ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(p_menu, '[]'::jsonb))
       with ordinality as t(item, ordinality)
  where coalesce(btrim(item ->> 'name'), '') <> '';

  return new_id;
end;
$fn$;

revoke all on function public.create_review(uuid, text, smallint, boolean, int, int, jsonb)
  from anon, public;
grant execute on function public.create_review(uuid, text, smallint, boolean, int, int, jsonb)
  to authenticated;

-- ── 기존 뷰에 메뉴를 붙인다 ─────────────────────────────────────────────────
-- 대표 메뉴를 몇 개 보여줄지는 화면이 자르면 된다. 뷰는 **언급이 많은 순 → 최근 순**으로
-- 정렬해서 넘긴다. 후기가 없는 식당은 빈 배열이라 전송량이 늘지 않는다.

create or replace view public.restaurant_candidates with (security_invoker = true) as
select
  r.id,
  r.name,
  r.category,
  w.seconds as walk_seconds,
  s.review_count,
  s.recommend_count,
  s.avg_rating,
  s.party_size_max,
  s.latest_review_at,
  s.price_min,
  s.price_max,
  s.price_avg,
  s.price_median,
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'diet_option_id', d.diet_option_id,
                 'available_count', d.available_count,
                 'unavailable_count', d.unavailable_count
               )
             )
      from public.restaurant_diet_stats d
      where d.restaurant_id = r.id
    ),
    '[]'::jsonb
  ) as diet_tags,
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'name', m.name,
                 'mention_count', m.mention_count,
                 'price_min', m.price_min,
                 'price_max', m.price_max,
                 'price_avg', m.price_avg,
                 'price_median', m.price_median
               )
               order by m.mention_count desc, m.latest_at desc, m.name
             )
      from public.restaurant_menu_stats m
      where m.restaurant_id = r.id
    ),
    '[]'::jsonb
  ) as menu
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id;
