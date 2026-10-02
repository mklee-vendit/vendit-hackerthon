import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseMutation, useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { type PendingReviewRequest, pickReviewRequest } from './reviewRequest';

const REVIEW_REQUEST_KEY = ['review-request'];

/**
 * 이 앱을 연 시각. 토스트는 **이 시각 이전의 방문만** 묻는다.
 *
 * 구글 로그인은 앱으로 되돌아오며 페이지가 새로 로드되므로, 이 값이 사실상 로그인 시각이다.
 * 모듈이 한 번만 평가되니 화면을 옮겨 다녀도 흔들리지 않는다.
 */
const OPENED_AT = new Date();

/** 지금 물어볼 방문 하나. 없으면 null. */
export function useReviewRequest() {
  return useSupabaseQuery(
    REVIEW_REQUEST_KEY,
    () =>
      supabase
        .from('pending_review_requests')
        .select('*')
        .returns<PendingReviewRequest[]>(),
    { select: (rows) => pickReviewRequest(rows, OPENED_AT) },
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
