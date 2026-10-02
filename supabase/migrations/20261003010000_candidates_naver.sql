-- 카드가 네이버 **업체 페이지**로 가려면 place id 가 필요하고, 후기가 쌓이기 전에 예산으로
-- 거르려면 메뉴판 가격이 필요하다. 둘 다 `restaurant_candidates` 에 붙인다.
--
-- 메뉴판 가격은 **후기 1인 가격을 대체하지 않는다**(§8 단일 기준). 후기가 있으면 그쪽이
-- 판정 기준이고, 이 값은 후기가 없을 때 "예산 안에서 먹을 수 있는 메뉴가 하나도 없는" 집을
-- 걸러내는 데만 쓴다. 그래서 컬럼 이름도 `naver_` 를 붙여 출처를 드러낸다.

-- 숫자로 파싱된 가격만 센다. "시가"·"변동" 은 금액이 아니므로 집계에서 빠진다 —
-- 0 으로 메우면 **아무 예산이나 통과하는 식당**이 된다(§10.2).
create view public.naver_price_stats with (security_invoker = true) as
select
  restaurant_id,
  min(price) as price_min,
  percentile_cont(0.5) within group (order by price) as price_median,
  count(*) as price_count
from public.naver_menu_items
where price is not null
group by restaurant_id;

comment on view public.naver_price_stats is
  '네이버 메뉴판 가격 집계. 가게가 내건 값이고 후기의 1인 가격과 섞지 않는다(§8).';

revoke all on public.naver_price_stats from anon, authenticated;
grant select on public.naver_price_stats to authenticated;

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
  np.price_count as naver_price_count
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id
left join public.restaurant_photo ph on ph.restaurant_id = r.id
-- 아직 수집하지 않은 식당은 행이 없다. left join 이라 그대로 null 로 온다.
left join public.restaurant_naver nv on nv.restaurant_id = r.id
left join public.naver_price_stats np on np.restaurant_id = r.id;
