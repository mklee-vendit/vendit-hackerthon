import { useSupabaseQuery } from '@/shared/lib/query';
import type { Candidate } from '@/shared/lib/recommend';
import { supabase } from '@/shared/lib/supabase';
import { type CandidateRow, toCandidate } from './candidateRow';
import { fetchAllPages } from './paginate';

const COLUMNS = `id, name, category, walk_seconds,
  review_count, recommend_count, avg_rating, party_size_max, latest_review_at,
  price_min, price_max, price_avg, price_median, diet_tags`;

const fetchCandidatePage = async ({
  from,
  to,
}: {
  from: number;
  to: number;
}): Promise<CandidateRow[]> => {
  const { data, error } = await supabase
    .from('restaurant_candidates')
    .select(COLUMNS)
    // 페이지를 넘기려면 순서가 고정이어야 한다 — 정렬이 없으면 같은 행이 두 장에 올 수 있다.
    .order('id', { ascending: true })
    .range(from, to)
    .returns<CandidateRow[]>();

  if (error) throw error;
  return data;
};

/**
 * 판정에 들어가는 재료. 집계는 **DB 뷰가** 끝낸 상태로 온다 — 화면에서 다시 세지 않는다(§10.1).
 *
 * 조인을 뷰에서 하는 이유: PostgREST 의 임베드는 관계를 추론할 수 있어야 하고 `group by` 로
 * 접은 집계 뷰는 추론되지 않는다(*"Could not find a relationship ... in the schema cache"*).
 */
export function useCandidates() {
  return useSupabaseQuery(
    ['candidates'],
    // 여러 장을 모아야 하므로 빌더 하나로 끝나지 않는다. 래퍼가 기대하는 모양에 맞춰
    // 성공 응답으로 감싼다 — 실패는 위에서 throw 하므로 여기 오면 성공이다.
    async () => ({
      success: true as const,
      data: await fetchAllPages(fetchCandidatePage),
      error: null,
    }),
    {
      select: (rows): Candidate[] => rows.map(toCandidate),
      // 식당·도보 시간은 수집할 때만 바뀐다. 후기는 자주 바뀌지만 검색 한 번 안에서는
      // 고정이어도 된다 — 후기를 쓰면 그쪽에서 무효화한다.
      staleTime: 60_000,
    },
  );
}
