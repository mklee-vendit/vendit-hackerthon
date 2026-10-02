-- 카드의 네이버 길찾기 버튼에 쓸 좌표를 뷰에 붙인다. 판정에는 쓰지 않는다 — 거리는 이미
-- 실측 도보 시간으로 판단하고, 좌표로 직선거리를 다시 계산하지 않는다(§7).
--
-- `create or replace view` 는 **기존 컬럼의 이름·순서·타입을 바꿀 수 없고 뒤에만 더할 수 있다.**
-- 그래서 lon·lat 을 맨 끝에 붙인다.
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
  ) as menu,
  ph.storage_path as photo_path,
  r.lon,
  r.lat
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id
left join public.restaurant_photo ph on ph.restaurant_id = r.id;
