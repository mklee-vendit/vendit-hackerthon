-- 트리거 · RLS · 집계 뷰.
--
-- 권한은 전부 DB 에서 강제한다(§10.8). 프론트의 숨김은 UX 일 뿐이다.
--   - 멤버십: 모든 정책이 public.is_member() 를 요구한다 → 사내 계정이 아니면 아무것도 없다
--   - 소유권: 수정·삭제는 author_id = auth.uid() 인 행만
--   - 컬럼: RLS 는 행을 고르는 규칙이라 컬럼을 못 막는다 → 수정 가능 범위는 GRANT 로 좁힌다
--   - 작성자 위조: author_id 에 INSERT 권한을 주지 않는다. 컬럼 기본값 auth.uid() 가 채운다

-- ── 트리거 ──────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger walk_times_touch before update on public.walk_times
  for each row execute function public.touch_updated_at();

-- 소프트 삭제 규칙은 세 테이블이 똑같다.
--   1. 지우면 자유 입력 본문을 **비운다** — 내용이 남아 있으면 REST 로 그대로 읽힌다
--   2. 이미 지워진 항목은 수정도, 되살리기도 거절한다. 조용히 무시하지 않고 예외를 던진다
--      (§10.5 — 호출부가 "성공했는데 아무 일도 안 일어난" 상태를 보면 안 된다)
--   3. 한글은 NFC 로 정규화한다(§10.13). 안 하면 같은 글자가 다른 바이트로 들어오고
--      글자 수 상한도 자모 분리 여부에 따라 달라진다
-- 컬럼 이름을 인자로 받는 범용 트리거 하나로 묶지 않는다 — 오타가 런타임까지 숨어서
-- "정규화가 조용히 안 걸린 컬럼"이 생긴다.

create or replace function public.reviews_before_write()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null then
      raise exception '이미 지운 후기는 수정하거나 되살릴 수 없습니다';
    end if;
    new.updated_at := now();
  end if;

  if new.deleted_at is not null then
    new.body := '';
    return new;
  end if;

  new.body := normalize(new.body, nfc);
  return new;
end;
$fn$;

create trigger reviews_before_write before insert or update on public.reviews
  for each row execute function public.reviews_before_write();

create or replace function public.posts_before_write()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null then
      raise exception '이미 지운 글은 수정하거나 되살릴 수 없습니다';
    end if;
    new.updated_at := now();
  end if;

  if new.deleted_at is not null then
    new.title := '';
    new.body := '';
    return new;
  end if;

  new.title := normalize(new.title, nfc);
  new.body := normalize(new.body, nfc);
  return new;
end;
$fn$;

create trigger posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

create or replace function public.comments_before_write()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null then
      raise exception '이미 지운 댓글은 수정하거나 되살릴 수 없습니다';
    end if;
    new.updated_at := now();
  end if;

  if new.deleted_at is not null then
    new.body := '';
    return new;
  end if;

  new.body := normalize(new.body, nfc);
  return new;
end;
$fn$;

create trigger comments_before_write before insert or update on public.comments
  for each row execute function public.comments_before_write();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.restaurants enable row level security;
alter table public.walk_times enable row level security;
alter table public.diet_options enable row level security;
alter table public.reviews enable row level security;
alter table public.review_diet_tags enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

revoke all on public.restaurants from anon, authenticated;
revoke all on public.walk_times from anon, authenticated;
revoke all on public.diet_options from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.review_diet_tags from anon, authenticated;
revoke all on public.posts from anon, authenticated;
revoke all on public.comments from anon, authenticated;
revoke all on public.likes from anon, authenticated;

-- 식당·도보시간은 클라이언트에게 **읽기 전용**이다. 수집 스크립트는 service_role 로 쓴다
-- (RLS 우회) — 그 키는 브라우저에 가지 않고 스크립트·CI 에서만 쓴다.
grant select on public.restaurants to authenticated;
create policy "restaurants: 멤버만 읽기" on public.restaurants
  for select to authenticated using (public.is_member());

grant select on public.walk_times to authenticated;
create policy "walk_times: 멤버만 읽기" on public.walk_times
  for select to authenticated using (public.is_member());

-- 제약 옵션은 멤버가 추가할 수 있다(§5.6). 고치거나 지우지는 못한다 — 행 추가만으로
-- 늘리는 구조이고, 지우면 이미 달린 후기 태그의 뜻이 사라진다.
grant select on public.diet_options to authenticated;
grant insert (name) on public.diet_options to authenticated;
create policy "diet_options: 멤버만 읽기" on public.diet_options
  for select to authenticated using (public.is_member());
create policy "diet_options: 멤버가 추가" on public.diet_options
  for insert to authenticated with check (public.is_member());

-- 후기. 지워진 후기도 **읽을 수 있어야** 거기 달린 댓글이 보인다(본문은 비어 있다).
grant select on public.reviews to authenticated;
grant insert (restaurant_id, body, rating, recommends, price_per_person, party_size)
  on public.reviews to authenticated;
grant update (body, rating, recommends, price_per_person, party_size, deleted_at)
  on public.reviews to authenticated;
create policy "reviews: 멤버만 읽기" on public.reviews
  for select to authenticated using (public.is_member());
create policy "reviews: 멤버가 작성" on public.reviews
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());
create policy "reviews: 작성자만 수정" on public.reviews
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 태그는 내 후기에 달린 것만 손댈 수 있다. 수정은 지우고 다시 넣는다.
grant select, insert, delete on public.review_diet_tags to authenticated;
create policy "review_diet_tags: 멤버만 읽기" on public.review_diet_tags
  for select to authenticated using (public.is_member());
create policy "review_diet_tags: 내 후기에만 추가" on public.review_diet_tags
  for insert to authenticated with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.author_id = auth.uid() and r.deleted_at is null
    )
  );
create policy "review_diet_tags: 내 후기에서만 제거" on public.review_diet_tags
  for delete to authenticated using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.author_id = auth.uid() and r.deleted_at is null
    )
  );

grant select on public.posts to authenticated;
grant insert (title, body) on public.posts to authenticated;
grant update (title, body, deleted_at) on public.posts to authenticated;
create policy "posts: 멤버만 읽기" on public.posts
  for select to authenticated using (public.is_member());
create policy "posts: 멤버가 작성" on public.posts
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());
create policy "posts: 작성자만 수정" on public.posts
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

grant select on public.comments to authenticated;
grant insert (post_id, review_id, body) on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
create policy "comments: 멤버만 읽기" on public.comments
  for select to authenticated using (public.is_member());
create policy "comments: 멤버가 작성" on public.comments
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());
create policy "comments: 작성자만 수정" on public.comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 공감은 취소하면 **실제로 지운다** — 비울 내용이 없으니 소프트 삭제할 이유가 없다.
grant select, insert, delete on public.likes to authenticated;
create policy "likes: 멤버만 읽기" on public.likes
  for select to authenticated using (public.is_member());
create policy "likes: 본인만 추가" on public.likes
  for insert to authenticated
  with check (public.is_member() and profile_id = auth.uid());
create policy "likes: 본인만 취소" on public.likes
  for delete to authenticated using (profile_id = auth.uid());

-- ── 집계 뷰 ─────────────────────────────────────────────────────────────────
-- **security_invoker 를 반드시 켠다.** 끄면 뷰가 소유자 권한으로 돌아 밑 테이블의 RLS 를
-- 통째로 우회한다 — 멤버가 아닌 계정도 집계를 읽는다.
--
-- 집계 방식이 정해지지 않은 것(1인 가격 · 제약 엇갈림)은 **여기서 고르지 않고 재료를 다
-- 내놓는다.** 고르는 일은 추천 로직의 rules 한 곳에서 한다(§10.1 단일 기준 · §10.4).

create view public.restaurant_stats with (security_invoker = true) as
select
  r.id as restaurant_id,
  count(rv.id) as review_count,
  count(rv.id) filter (where rv.recommends) as recommend_count,
  round(avg(rv.rating)::numeric, 2) as avg_rating,
  -- 단체 수용 = "함께 간 인원"의 최대값. 아무도 안 적었으면 null = "단체석 미확인"
  max(rv.party_size) as party_size_max,
  max(rv.created_at) as latest_review_at,
  min(rv.price_per_person) as price_min,
  max(rv.price_per_person) as price_max,
  round(avg(rv.price_per_person)::numeric, 0) as price_avg,
  percentile_cont(0.5) within group (order by rv.price_per_person) as price_median
from public.restaurants r
left join public.reviews rv
  on rv.restaurant_id = r.id and rv.deleted_at is null
group by r.id;

comment on view public.restaurant_stats is
  '후기에서 계산한다. review_count = 0 이면 §6 의 "정보 없음" 구역 대상이다.';

-- 제약 태그가 후기끼리 엇갈릴 때의 규칙이 미정이라(§13) 양쪽 개수를 그대로 내놓는다.
create view public.restaurant_diet_stats with (security_invoker = true) as
select
  rv.restaurant_id,
  t.diet_option_id,
  count(*) filter (where t.available) as available_count,
  count(*) filter (where not t.available) as unavailable_count
from public.review_diet_tags t
join public.reviews rv on rv.id = t.review_id and rv.deleted_at is null
group by rv.restaurant_id, t.diet_option_id;

create view public.post_stats with (security_invoker = true) as
select
  p.id as post_id,
  count(distinct c.id) filter (where c.deleted_at is null) as comment_count,
  count(distinct l.profile_id) as like_count
from public.posts p
left join public.comments c on c.post_id = p.id
left join public.likes l on l.post_id = p.id
group by p.id;

create view public.review_stats with (security_invoker = true) as
select
  rv.id as review_id,
  count(distinct c.id) filter (where c.deleted_at is null) as comment_count,
  count(distinct l.profile_id) as like_count
from public.reviews rv
left join public.comments c on c.review_id = rv.id
left join public.likes l on l.review_id = rv.id
group by rv.id;

revoke all on public.restaurant_stats from anon, authenticated;
revoke all on public.restaurant_diet_stats from anon, authenticated;
revoke all on public.post_stats from anon, authenticated;
revoke all on public.review_stats from anon, authenticated;
grant select on public.restaurant_stats to authenticated;
grant select on public.restaurant_diet_stats to authenticated;
grant select on public.post_stats to authenticated;
grant select on public.review_stats to authenticated;
