-- 1g 식당 상세에 필요한 것. 목록(`restaurant_candidates`)과 달리 주소·수집일을 함께 낸다.
--
-- 목록 뷰에 컬럼을 더 붙이지 않는다 — 목록은 1,911행을 페이지로 넘겨 받으므로 쓰지 않는
-- 컬럼이 그대로 전송량이 된다.
create view public.restaurant_detail with (security_invoker = true) as
select
  r.id,
  r.name,
  r.category,
  r.address,
  r.road_address,
  r.collected_at,
  w.seconds as walk_seconds,
  s.review_count,
  s.recommend_count,
  s.avg_rating,
  s.party_size_max,
  s.price_min,
  s.price_max,
  s.price_avg,
  s.price_median
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id;

revoke all on public.restaurant_detail from anon, authenticated;
grant select on public.restaurant_detail to authenticated;

/*
 * 후기 목록. 작성자 표시 이름을 붙이고, **지워진 후기는 내보내지 않는다.**
 *
 * `reviews` 를 직접 읽으면 지워진 행(본문이 빈)이 섞인다 — 그 행은 댓글을 붙여 두기 위해
 * 남아 있는 것이고 목록에 보일 것이 아니다(§9). 쓰는 쪽마다 `deleted_at is null` 을 적지
 * 않게 여기서 한 번 거른다(§10.1).
 *
 * `is_mine` 을 함께 낸다 — 수정·삭제 버튼을 본인 글에만 보이게 하려면 화면이 알아야 한다.
 * 다만 **버튼을 숨기는 것은 UX 일 뿐이고** 권한은 RLS 가 막는다(§10.8).
 */
create view public.review_feed with (security_invoker = true) as
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
  rv.updated_at
from public.reviews rv
join public.profiles p on p.id = rv.author_id
where rv.deleted_at is null;

revoke all on public.review_feed from anon, authenticated;
grant select on public.review_feed to authenticated;
