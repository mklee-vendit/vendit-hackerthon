-- 카드의 사진과 "대표 메뉴" 칸이 후기에서만 채워져서, 후기가 0건인 지금은 회색 사선과 `—`
-- 뿐이다. 네이버 메뉴판·사진이 쌓였으니 **후기가 없을 때의 대체 출처**로 붙인다.
--
-- 후기가 있으면 후기 쪽이 이긴다 — 벤더가 찍은 사진과 벤더가 먹은 메뉴가 이 서비스의 값이고,
-- 메뉴판은 가게가 내건 값이다. 출처가 다르므로 화면도 라벨을 가른다(§7 출처 표시).
--
-- 메뉴 줄 순서는 **화면에 보이던 순서**다(`position`). 네이버가 "대표 메뉴" 를 따로 주지
-- 않으므로 대표라고 부르지 않고 "메뉴판" 으로 보여 준다(§10.2 발명 금지).
-- 숫자로 파싱 안 된 "시가"·"변동" 줄은 뺀다 — 카드가 금액을 그려야 한다.

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
  r.lat,
  nv.naver_place_id,
  np.price_min as naver_price_min,
  np.price_median as naver_price_median,
  np.price_count as naver_price_count,
  nv.photo_url as naver_photo_url,
  coalesce(nm.items, '[]'::jsonb) as naver_menu
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id
left join public.restaurant_photo ph on ph.restaurant_id = r.id
-- 아직 수집하지 않은 식당은 행이 없다. left join 이라 그대로 null 로 온다.
left join public.restaurant_naver nv on nv.restaurant_id = r.id
left join public.naver_price_stats np on np.restaurant_id = r.id
left join lateral (
  select jsonb_agg(jsonb_build_object('name', x.name, 'price', x.price)
                   order by x.position) as items
  from (
    select name, price, position
    from public.naver_menu_items
    where restaurant_id = r.id and price is not null
    order by position
    limit 5
  ) x
) nm on true;
