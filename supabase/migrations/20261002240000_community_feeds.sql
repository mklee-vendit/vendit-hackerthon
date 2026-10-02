-- 커뮤니티(3a) 목록용 뷰.
--
-- 세는 일은 전부 DB 가 한다 — 화면이 댓글·공감을 다시 세면 숫자가 갈린다(§10.1).

/*
 * 자유게시판 목록.
 *
 * **지운 글도 내보낸다 — 단, 댓글이 남아 있을 때만.** 글을 지워도 거기 달린 댓글은 살아야
 * 한다는 결정(§13)에 따라 글 행을 남기므로, 그 글을 목록에서 빼 버리면 댓글이 닿을 곳이
 * 없어진다. 댓글이 없는 지운 글은 보여줄 이유가 없으므로 뺀다.
 *
 * 지운 글은 제목·본문이 트리거로 비워져 있다. 화면은 `is_deleted` 를 보고 "삭제된 글입니다"
 * 를 그린다 — 빈 제목을 그대로 그리지 않는다.
 */
create view public.post_feed with (security_invoker = true) as
select
  p.id,
  p.author_id,
  p.author_id = (select auth.uid()) as is_mine,
  pr.display_name as author_name,
  p.title,
  p.body,
  p.created_at,
  p.deleted_at is not null as is_deleted,
  s.comment_count,
  s.like_count,
  exists (
    select 1 from public.likes l
    where l.post_id = p.id and l.profile_id = (select auth.uid())
  ) as liked_by_me
from public.posts p
join public.profiles pr on pr.id = p.author_id
join public.post_stats s on s.post_id = p.id
where p.deleted_at is null or s.comment_count > 0;

revoke all on public.post_feed from anon, authenticated;
grant select on public.post_feed to authenticated;

/*
 * 댓글. 지운 댓글은 **자리를 남긴다** — 그 아래 흐름(누가 뭐라 했는지)이 끊기지 않게.
 * 본문은 트리거가 비워 뒀고 화면이 "삭제된 댓글입니다" 를 그린다.
 */
create view public.comment_feed with (security_invoker = true) as
select
  c.id,
  c.post_id,
  c.review_id,
  c.author_id,
  c.author_id = (select auth.uid()) as is_mine,
  pr.display_name as author_name,
  c.body,
  c.created_at,
  c.deleted_at is not null as is_deleted
from public.comments c
join public.profiles pr on pr.id = c.author_id;

revoke all on public.comment_feed from anon, authenticated;
grant select on public.comment_feed to authenticated;

-- 후기 목록에 식당 이름과 공감·댓글 수를 붙인다. 커뮤니티의 "식당 후기" 탭이 식당을 가로질러
-- 최신순으로 보여주므로 식당 이름이 필요하다.
create or replace view public.review_feed with (security_invoker = true) as
select
  rv.id,
  rv.restaurant_id,
  rv.author_id,
  rv.author_id = (select auth.uid()) as is_mine,
  p.display_name as author_name,
  rv.body,
  rv.rating,
  rv.recommends,
  rv.price_per_person,
  rv.party_size,
  rv.created_at,
  rv.updated_at,
  r.name as restaurant_name,
  r.category as restaurant_category,
  s.comment_count,
  s.like_count,
  exists (
    select 1 from public.likes l
    where l.review_id = rv.id and l.profile_id = (select auth.uid())
  ) as liked_by_me
from public.reviews rv
join public.profiles p on p.id = rv.author_id
join public.restaurants r on r.id = rv.restaurant_id
join public.review_stats s on s.review_id = rv.id
where rv.deleted_at is null;

/*
 * 공감 토글. 두 번 누르면 꺼진다.
 *
 * **왕복 한 번으로 끝낸다** — 읽고 나서 쓰면 그 사이에 다른 탭에서 누른 것과 엇갈려
 * unique 제약에 걸리거나 상태가 뒤집힌다. 지우고 0행이면 없던 것이므로 넣는다.
 *
 * security invoker 라 RLS 를 우회하지 않는다 — 남의 공감은 애초에 지워지지 않는다.
 */
create or replace function public.toggle_like(
  p_post_id uuid default null,
  p_review_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  removed int;
begin
  if (p_post_id is null) = (p_review_id is null) then
    raise exception '대상은 글이나 후기 중 하나여야 합니다';
  end if;

  delete from public.likes
  where profile_id = (select auth.uid())
    and post_id is not distinct from p_post_id
    and review_id is not distinct from p_review_id;
  get diagnostics removed = row_count;

  if removed > 0 then
    return false;
  end if;

  insert into public.likes (post_id, review_id) values (p_post_id, p_review_id);
  return true;
end;
$fn$;

revoke all on function public.toggle_like(uuid, uuid) from anon, public;
grant execute on function public.toggle_like(uuid, uuid) to authenticated;
