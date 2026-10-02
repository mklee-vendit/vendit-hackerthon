-- 식당 목록에 사진 경로를 붙인다. 카드가 한 장만 쓰므로 `restaurant_photo` 가 이미 한 장으로
-- 줄여 둔 값을 그대로 가져온다 — 1,911행에 쓰지도 않을 경로를 여러 개 싣지 않는다.
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
  ph.storage_path as photo_path
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id
left join public.restaurant_photo ph on ph.restaurant_id = r.id;
