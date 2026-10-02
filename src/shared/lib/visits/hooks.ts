import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseMutation, useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { type PendingReviewRequest, pickReviewRequest } from './reviewRequest';

const REVIEW_REQUEST_KEY = ['review-request'];

/** 지금 물어볼 방문 하나. 없으면 null. */
export function useReviewRequest() {
  return useSupabaseQuery(
    REVIEW_REQUEST_KEY,
    () =>
      supabase
        .from('pending_review_requests')
        .select('*')
        .returns<PendingReviewRequest[]>(),
    { select: pickReviewRequest },
  );
}

/**
 * 길찾기를 누른 것을 방문으로 기록한다. 같은 날 같은 식당은 unique 에 걸려 조용히 무시된다 —
 * 그래서 이미 닫은 요청이 같은 날 다시 눌러도 되살아나지 않는다.
 */
export function useRecordVisit() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (restaurantId: string) =>
      supabase.from('visits').upsert(
        { restaurant_id: restaurantId },
        {
          onConflict: 'user_id,restaurant_id,visited_on',
          ignoreDuplicates: true,
        },
      ),
    {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: REVIEW_REQUEST_KEY }),
    },
  );
}

/**
 * 토스트를 닫는다. **그 방문과 그보다 먼저 누른 방문을 함께 닫는다** — 둘러보며 여러 곳을
 * 눌렀을 때 하나를 닫자마자 다음 식당이 줄줄이 뜨지 않게.
 */
export function useDismissReviewRequests() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (upTo: Pick<PendingReviewRequest, 'created_at'>) =>
      supabase
        .from('visits')
        .update({ dismissed_at: new Date().toISOString() })
        .is('dismissed_at', null)
        .lte('created_at', upTo.created_at),
    {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: REVIEW_REQUEST_KEY }),
    },
  );
}
