import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseMutation, useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { normalized, type PostDraft } from './draft';

export type PostFeedRow = {
  id: string;
  author_id: string;
  is_mine: boolean;
  author_name: string;
  title: string;
  body: string;
  created_at: string;
  is_deleted: boolean;
  comment_count: number | string | null;
  like_count: number | string | null;
  liked_by_me: boolean;
};

export type CommentFeedRow = {
  id: string;
  post_id: string | null;
  review_id: string | null;
  author_id: string;
  is_mine: boolean;
  author_name: string;
  body: string;
  created_at: string;
  is_deleted: boolean;
};

export type ReviewCommunityRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_category: string;
  is_mine: boolean;
  author_name: string;
  body: string;
  rating: number;
  recommends: boolean;
  price_per_person: number;
  created_at: string;
  comment_count: number | string | null;
  like_count: number | string | null;
  liked_by_me: boolean;
};

/** 모든 커뮤니티 목록을 한 번에 다시 읽게 하는 키. 공감 하나에도 수가 바뀐다. */
const COMMUNITY_KEYS = [
  ['post-feed'],
  ['comment-feed'],
  ['review-community'],
  ['review-feed'],
];

function invalidateCommunity(queryClient: ReturnType<typeof useQueryClient>) {
  for (const queryKey of COMMUNITY_KEYS) {
    queryClient.invalidateQueries({ queryKey });
  }
}

export function usePostFeed() {
  return useSupabaseQuery(
    ['post-feed'],
    () =>
      supabase
        .from('post_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<PostFeedRow[]>(),
    { staleTime: 10_000 },
  );
}

/** 식당을 가로지르는 후기 목록. 커뮤니티의 "식당 후기" 탭. */
export function useReviewCommunityFeed() {
  return useSupabaseQuery(
    ['review-community'],
    () =>
      supabase
        .from('review_feed')
        .select(
          'id, restaurant_id, restaurant_name, restaurant_category, is_mine, author_name, body, rating, recommends, price_per_person, created_at, comment_count, like_count, liked_by_me',
        )
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<ReviewCommunityRow[]>(),
    { staleTime: 10_000 },
  );
}

/** 펼친 글 하나의 댓글만 읽는다 — 목록 전체의 댓글을 미리 받지 않는다. */
export function useComments(
  target: {
    postId?: string;
    reviewId?: string;
  } | null,
) {
  const postId = target?.postId;
  const reviewId = target?.reviewId;
  return useSupabaseQuery(
    ['comment-feed', postId ?? '', reviewId ?? ''],
    () => {
      const query = supabase.from('comment_feed').select('*');
      return (
        postId
          ? query.eq('post_id', postId)
          : query.eq('review_id', reviewId ?? '')
      )
        .order('created_at', { ascending: true })
        .returns<CommentFeedRow[]>();
    },
    { enabled: Boolean(postId || reviewId) },
  );
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (draft: PostDraft) =>
      supabase
        .from('posts')
        .insert({
          title: normalized(draft.title),
          body: normalized(draft.body),
        })
        .select('id')
        .single()
        .returns<{ id: string }>(),
    { onSuccess: () => invalidateCommunity(queryClient) },
  );
}

/** 소프트 삭제. 제목·본문은 트리거가 비우고, 달린 댓글은 남는다(§13 결정). */
export function useDeletePost() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (postId: string) =>
      supabase
        .from('posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', postId)
        .select('id')
        .single()
        .returns<{ id: string }>(),
    { onSuccess: () => invalidateCommunity(queryClient) },
  );
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (input: { postId?: string; reviewId?: string; body: string }) =>
      supabase
        .from('comments')
        .insert({
          post_id: input.postId ?? null,
          review_id: input.reviewId ?? null,
          body: normalized(input.body),
        })
        .select('id')
        .single()
        .returns<{ id: string }>(),
    { onSuccess: () => invalidateCommunity(queryClient) },
  );
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    (commentId: string) =>
      supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)
        .select('id')
        .single()
        .returns<{ id: string }>(),
    { onSuccess: () => invalidateCommunity(queryClient) },
  );
}

/**
 * 공감 토글. **DB 함수가 왕복 한 번에 끝낸다** — 읽고 나서 쓰면 그 사이에 다른 탭에서 누른
 * 것과 엇갈려 unique 제약에 걸린다.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useSupabaseMutation(
    async (target: { postId?: string; reviewId?: string }) => {
      const { data, error } = await supabase.rpc('toggle_like', {
        p_post_id: target.postId ?? null,
        p_review_id: target.reviewId ?? null,
      });
      if (error) throw error;
      return { success: true as const, data: data as boolean, error: null };
    },
    { onSuccess: () => invalidateCommunity(queryClient) },
  );
}
