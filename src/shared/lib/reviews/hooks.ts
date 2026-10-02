import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseMutation, useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { filledMenu, normalizedBody, type ReviewDraft } from './draft';
import { photoPath, resizeToWebp } from './image';

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

const PHOTO_BUCKET = 'review-photos';

/**
 * 후기 쓰기.
 *
 * 후기와 메뉴는 **DB 함수 하나로 한 트랜잭션에서** 넣는다 — 둘로 나눠 보내면 후기만
 * 저장되고 메뉴가 빠진 상태가 남는다. `author_id` 는 보내지 않는다(컬럼 기본값 auth.uid()
 * 가 채우고 INSERT 권한도 없어 위조 불가 — §10.8).
 *
 * 사진은 **후기가 만들어진 뒤에** 올린다. 경로에 review_id 가 들어가고, 중간에 실패해도
 * 후기는 남는다(사진 없는 후기는 정상 상태다). 반대로 먼저 올리면 후기 생성이 실패했을 때
 * 아무 데도 연결되지 않은 파일이 남는다.
 *
 * 성공하면 집계가 바뀌므로 관련 캐시를 전부 무효화한다. 집계는 저장하지 않고 후기에서
 * 계산하므로 다시 읽으면 반영돼 있다(§9).
 */
export function useCreateReview(restaurantId: string) {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    async (draft: ReviewDraft) => {
      const { data: reviewId, error } = await supabase.rpc('create_review', {
        p_restaurant_id: restaurantId,
        p_body: normalizedBody(draft.body),
        p_rating: draft.rating,
        p_recommends: draft.recommends,
        p_price_per_person: draft.pricePerPerson,
        p_party_size: draft.partySize,
        p_menu: filledMenu(draft.menu).map((item) => ({
          name: item.name.trim(),
          price: item.price,
        })),
      });
      if (error) throw error;

      if (draft.photo) {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) throw new Error('로그인 상태를 확인할 수 없습니다');

        const resized = await resizeToWebp(draft.photo);
        const path = photoPath(userId, reviewId as string, crypto.randomUUID());

        const upload = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, resized.blob, {
            contentType: 'image/webp',
            // 사진은 바뀌지 않는다. 길게 캐시해야 전송 비용이 안 든다 — 비용의 핵심이다.
            cacheControl: '31536000',
          });
        if (upload.error) throw upload.error;

        const photoRow = await supabase.from('review_photos').insert({
          review_id: reviewId as string,
          storage_path: path,
          width: resized.width,
          height: resized.height,
          byte_size: resized.blob.size,
          position: 0,
        });
        if (photoRow.error) throw photoRow.error;
      }

      return {
        success: true as const,
        data: { id: reviewId as string },
        error: null,
      };
    },
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
