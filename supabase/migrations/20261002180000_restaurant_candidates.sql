-- 판정 재료를 **한 뷰로** 내놓는다.
--
-- 클라이언트가 `restaurants` 에 집계 뷰들을 임베드(`select=...,restaurant_stats(...)`)하려
-- 했더니 PostgREST 가 거절했다: *"Could not find a relationship between 'restaurants' and
-- 'restaurant_stats' in the schema cache"*. 임베드는 관계를 추론할 수 있어야 하고,
-- `group by` 로 접은 뷰는 추론되지 않는다.
--
-- 그래서 조인을 **DB 쪽에서** 끝낸다. 화면이 여러 응답을 맞춰 붙이지 않아도 되고, 집계가
-- 한 자리에 남는다(§10.1).
--
-- 식사 제약 태그는 식당당 여러 행이라 jsonb 배열로 접는다 — 행을 늘리면 식당이 중복돼
-- 클라이언트가 다시 접어야 한다.
create view public.restaurant_candidates with (security_invoker = true) as
select
  r.id,
  r.name,
  r.category,
  -- 측정에 성공한 값만. 없으면 **재지 못한 것**이고 0 이나 직선거리가 아니다(§7).
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
  ) as diet_tags
from public.restaurants r
join public.restaurant_stats s on s.restaurant_id = r.id
left join public.walk_times_valid w on w.restaurant_id = r.id;

comment on view public.restaurant_candidates is
  '추천 판정에 들어가는 재료 전부. 집계는 여기서 끝난다 — 화면에서 다시 세지 않는다.';

revoke all on public.restaurant_candidates from anon, authenticated;
grant select on public.restaurant_candidates to authenticated;
