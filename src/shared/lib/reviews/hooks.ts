import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseMutation, useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { normalizedBody, type ReviewDraft } from './draft';

export type RestaurantDetailRow = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  road_address: string | null;
  collected_at: string;
  walk_seconds: number | string | null;
  review_count: number | string | null;
  recommend_count: number | string | null;
  avg_rating: number | string | null;
  party_size_max: number | string | null;
  price_median: number | string | null;
};

export type ReviewFeedRow = {
  id: string;
  restaurant_id: string;
  author_id: string;
  is_mine: boolean;
  author_name: string;
  body: string;
  rating: number;
  recommends: boolean;
  price_per_person: number;
  party_size: number | null;
  created_at: string;
};

export function useRestaurantDetail(restaurantId: string | undefined) {
  return useSupabaseQuery(
    ['restaurant-detail', restaurantId],
    () =>
      supabase
        .from('restaurant_detail')
        .select('*')
        .eq('id', restaurantId ?? '')
        .limit(1)
        .returns<RestaurantDetailRow[]>(),
    {
      enabled: Boolean(restaurantId),
      // 없는 식당이면 빈 배열이 온다 — 그걸 null 로 바꿔 화면이 "찾을 수 없어요" 를 그린다.
      select: (rows) => rows.at(0) ?? null,
    },
  );
}

/** 후기 목록. 지워진 후기는 뷰가 이미 걸러 준다(§9). */
export function useReviewFeed(restaurantId: string | undefined) {
  return useSupabaseQuery(
    ['review-feed', restaurantId],
    () =>
      supabase
        .from('review_feed')
        .select('*')
        .eq('restaurant_id', restaurantId ?? '')
        .order('created_at', { ascending: false })
        .returns<ReviewFeedRow[]>(),
    { enabled: Boolean(restaurantId) },
  );
}

/**
 * 후기 쓰기. `author_id` 를 **보내지 않는다** — 컬럼 기본값 `auth.uid()` 가 채우고,
 * INSERT 권한도 없어서 위조할 수 없다(§10.8).
 *
 * 성공하면 집계가 바뀌므로 식당 목록·상세·목록 캐시를 전부 무효화한다. 집계는 저장하지
 * 않고 후기에서 계산하므로, 다시 읽으면 반영돼 있다(§9).
 */
export function useCreateReview(restaurantId: string) {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (draft: ReviewDraft) =>
      supabase
        .from('reviews')
        .insert({
          restaurant_id: restaurantId,
          body: normalizedBody(draft.body),
          rating: draft.rating,
          recommends: draft.recommends,
          price_per_person: draft.pricePerPerson,
          party_size: draft.partySize,
        })
        .select('id')
        .single()
        .returns<{ id: string }>(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['review-feed'] });
        queryClient.invalidateQueries({ queryKey: ['restaurant-detail'] });
        queryClient.invalidateQueries({ queryKey: ['candidates'] });
        queryClient.invalidateQueries({ queryKey: ['latest-reviews'] });
      },
    },
  );
}

/**
 * 후기 지우기 — **소프트 삭제다.** `deleted_at` 만 세우면 트리거가 본문을 비우고, 집계에서
 * 즉시 빠진다(§9). 거기 달린 댓글은 남는다.
 */
export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (reviewId: string) =>
      supabase
        .from('reviews')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reviewId)
        .select('id')
        .single()
        .returns<{ id: string }>(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['review-feed'] });
        queryClient.invalidateQueries({ queryKey: ['restaurant-detail'] });
        queryClient.invalidateQueries({ queryKey: ['candidates'] });
        queryClient.invalidateQueries({ queryKey: ['latest-reviews'] });
      },
    },
  );
}
