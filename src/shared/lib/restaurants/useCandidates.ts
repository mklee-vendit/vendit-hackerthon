import { useSupabaseQuery } from '@/shared/lib/query';
import type { Candidate } from '@/shared/lib/recommend';
import { supabase } from '@/shared/lib/supabase';
import { type CandidateRow, toCandidate } from './candidateRow';

/**
 * 판정에 들어가는 재료를 한 번에 읽는다. 집계는 **DB 뷰가** 끝낸 상태로 온다 — 화면에서
 * 다시 세지 않는다(§10.1).
 *
 * `walk_times_valid` 는 측정에 성공한 행만 있는 뷰라서, 조인 결과가 없으면 "재지 못함" 이다.
 * 0 이나 직선거리로 메우지 않는다(§7).
 */
export function useCandidates() {
  return useSupabaseQuery(
    ['candidates'],
    () =>
      supabase
        .from('restaurants')
        .select(
          `id, name, category,
           restaurant_stats!inner (
             review_count, recommend_count, avg_rating, party_size_max,
             latest_review_at, price_min, price_max, price_avg, price_median
           ),
           walk_times_valid ( seconds ),
           restaurant_diet_stats ( diet_option_id, available_count, unavailable_count )`,
        )
        .returns<CandidateRow[]>(),
    {
      select: (rows): Candidate[] => rows.map(toCandidate),
      // 식당·도보 시간은 수집할 때만 바뀐다. 후기는 자주 바뀌지만 검색 한 번 안에서는
      // 고정이어도 된다 — 후기를 쓰면 그쪽에서 무효화한다.
      staleTime: 60_000,
    },
  );
}
