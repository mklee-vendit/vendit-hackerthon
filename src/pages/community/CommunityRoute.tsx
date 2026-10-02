import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/shared/components/AppHeader';
import { useConst } from '@/shared/hooks';
import { useProfile, useSession } from '@/shared/lib/auth';
import {
  POST_BODY_MAX,
  POST_ISSUE_LABEL,
  POST_TITLE_MAX,
  type PostDraft,
  validatePost,
} from '@/shared/lib/community/draft';
import {
  useCreatePost,
  useDeletePost,
  usePostFeed,
  useReviewCommunityFeed,
  useToggleLike,
} from '@/shared/lib/community/hooks';
import { extractCause } from '@/shared/lib/extractCause';
import { cn, formatWon } from '@/shared/utils';
import { relativeKo } from '@/shared/utils/relativeTime';
import { CommentThread } from './CommentThread';

type Tab = 'posts' | 'reviews';

const count = (value: number | string | null): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function LikeButton({
  liked,
  likeCount,
  commentCount,
  onToggle,
}: {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onToggle: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={(e) => {
          // 글 펼치기 토글과 겹치지 않게 — 공감만 누른 것이다.
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'rounded-full border px-2.5 py-1 font-mono',
          liked ? 'border-brand text-brand' : 'border-line text-content-muted',
        )}
      >
        {liked ? '공감함' : '공감'} {likeCount}
      </button>
      <span className="text-content-muted">댓글 {commentCount}</span>
    </div>
  );
}

/** 3a 커뮤니티 — 글쓰기·펼치기·댓글·공감이 **한 페이지 안에서** 일어난다. */
export function CommunityRoute() {
  const navigate = useNavigate();
  const now = useConst(() => new Date());
  const session = useSession();
  const profile = useProfile(
    session.status === 'signedIn' ? session.session.user.id : undefined,
  );

  const [tab, setTab] = useState<Tab>('posts');
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState<PostDraft>({ title: '', body: '' });
  const [touched, setTouched] = useState(false);
  // **한 번에 한 글만 열린다**(목업 3a). 열린 글의 id 를 하나만 들고 있으면 그 규칙이 된다.
  const [openId, setOpenId] = useState<string | null>(null);

  const posts = usePostFeed();
  const reviews = useReviewCommunityFeed();
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const toggleLike = useToggleLike();

  const issues = validatePost(draft);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
      <AppHeader
        activeTab="community"
        displayName={profile.data?.display_name ?? ''}
        onTabChange={(next) => next === 'recommend' && navigate('/')}
      />

      <main className="px-5 pb-8">
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-1 rounded-xl bg-track p-1">
            {(
              [
                ['posts', '자유게시판'],
                ['reviews', '식당 후기'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key);
                  setOpenId(null);
                }}
                className={cn(
                  'h-9 rounded-lg px-3 text-[13px]',
                  tab === key
                    ? 'bg-surface font-semibold'
                    : 'font-medium text-content-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'posts' && (
            <button
              type="button"
              onClick={() => setComposeOpen((open) => !open)}
              className="h-9 rounded-xl bg-ink px-3.5 text-[13px] font-semibold text-ink-content"
            >
              {composeOpen ? '취소' : '글쓰기'}
            </button>
          )}
        </div>

        {tab === 'posts' && composeOpen && (
          // 페이지를 옮기지 않는다 — 목록 위에 작성 칸을 펼친다(목업 3a).
          <section className="mt-3 rounded-2xl bg-surface px-[18px] py-4 shadow-ticket">
            <p className="text-xs text-content-muted">
              <span className="font-semibold text-content">
                {profile.data?.display_name ?? ''}
              </span>{' '}
              으로 올라가요
            </p>
            <input
              value={draft.title}
              placeholder="제목"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-3 h-11 w-full rounded-xl border border-line bg-transparent px-3 text-[15px] font-semibold outline-none focus:border-content"
            />
            <textarea
              rows={5}
              value={draft.body}
              placeholder="내용"
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="mt-2 w-full resize-none rounded-xl border border-line bg-transparent px-3 py-2.5 text-[14px] leading-normal outline-none focus:border-content"
            />
            <div className="mt-1 text-right font-mono text-xs text-content-muted">
              {draft.body.normalize('NFC').trim().length} / {POST_BODY_MAX}
            </div>

            {touched && issues.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {issues.map((issue) => (
                  <li key={issue} className="text-xs text-danger">
                    {POST_ISSUE_LABEL[issue]}
                  </li>
                ))}
              </ul>
            )}
            {createPost.isError && (
              <p className="mt-2 text-xs text-danger">
                {extractCause(createPost.error)}
              </p>
            )}

            <button
              type="button"
              disabled={createPost.isPending}
              onClick={() => {
                setTouched(true);
                if (issues.length > 0) return;
                createPost.mutate(draft, {
                  onSuccess: ({ id }) => {
                    setDraft({ title: '', body: '' });
                    setTouched(false);
                    setComposeOpen(false);
                    // 등록하면 맨 위에 추가되며 **펼쳐진 상태로** 보인다(목업 3a).
                    setOpenId(id);
                  },
                });
              }}
              className="mt-3 h-11 w-full rounded-xl bg-brand text-sm font-bold text-brand-content disabled:opacity-50"
            >
              {createPost.isPending ? '등록 중…' : '등록'}
            </button>
            <p className="mt-2 text-center text-xs text-content-muted">
              제목 {POST_TITLE_MAX}자 · 내용 {POST_BODY_MAX}자 · 텍스트만
            </p>
          </section>
        )}

        {tab === 'posts' && (
          <section className="mt-3">
            {posts.isPending && (
              <p className="py-8 text-center text-sm text-content-muted">
                불러오는 중…
              </p>
            )}
            {posts.isError && (
              <p className="py-8 text-center text-sm text-danger">
                {extractCause(posts.error)}
              </p>
            )}
            {posts.data?.length === 0 && (
              <p className="py-8 text-center text-sm text-content-muted">
                아직 글이 없어요. 첫 글을 남겨보세요.
              </p>
            )}

            <ul className="flex flex-col gap-2.5">
              {posts.data?.map((post) => {
                const open = openId === post.id;
                return (
                  <li
                    key={post.id}
                    className="rounded-2xl bg-surface px-[18px] py-3.5 shadow-ticket"
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : post.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[15px] font-semibold',
                            post.is_deleted && 'text-content-muted italic',
                          )}
                        >
                          {/* 지운 글도 자리를 남긴다 — 달린 댓글이 닿을 곳이 필요하다(§13) */}
                          {post.is_deleted ? '삭제된 글입니다' : post.title}
                        </span>
                        {post.is_mine && !post.is_deleted && (
                          <span className="flex-none rounded bg-track px-1.5 py-0.5 text-[10px]">
                            내 글
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-content-muted">
                        {post.is_deleted ? '—' : post.author_name} ·{' '}
                        {relativeKo(new Date(post.created_at), now)}
                      </div>
                    </button>

                    {open && !post.is_deleted && (
                      <p className="mt-2.5 text-[14px] leading-normal whitespace-pre-wrap">
                        {post.body}
                      </p>
                    )}

                    <LikeButton
                      liked={post.liked_by_me}
                      likeCount={count(post.like_count)}
                      commentCount={count(post.comment_count)}
                      onToggle={() => toggleLike.mutate({ postId: post.id })}
                    />

                    {open && (
                      <>
                        <CommentThread target={{ postId: post.id }} />
                        {post.is_mine && !post.is_deleted && (
                          <button
                            type="button"
                            onClick={() => deletePost.mutate(post.id)}
                            className="mt-3 text-xs text-content-muted underline"
                          >
                            글 삭제
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === 'reviews' && (
          <section className="mt-3">
            {reviews.isPending && (
              <p className="py-8 text-center text-sm text-content-muted">
                불러오는 중…
              </p>
            )}
            {reviews.data?.length === 0 && (
              <p className="py-8 text-center text-sm text-content-muted">
                아직 후기가 없어요. 식당을 찾아 첫 후기를 남겨보세요.
              </p>
            )}

            <ul className="flex flex-col gap-2.5">
              {reviews.data?.map((review) => {
                const open = openId === review.id;
                return (
                  <li
                    key={review.id}
                    className="rounded-2xl bg-surface px-[18px] py-3.5 shadow-ticket"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/restaurants/${review.restaurant_id}`}
                        className="min-w-0 flex-1 truncate text-[15px] font-semibold"
                      >
                        {review.restaurant_name}
                      </Link>
                      <span className="flex-none font-mono text-[13px] text-brand">
                        {'★'.repeat(review.rating)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-content-muted">
                      {review.restaurant_category} · {review.author_name} ·{' '}
                      {relativeKo(new Date(review.created_at), now)}
                    </div>
                    <p className="mt-2 text-[14px] leading-normal whitespace-pre-wrap">
                      {review.body}
                    </p>
                    <div className="mt-1.5 font-mono text-xs text-content-muted">
                      1인 {formatWon(review.price_per_person)}원 ·{' '}
                      {review.recommends ? '추천' : '비추천'}
                    </div>

                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : review.id)}
                      className="mt-2 text-xs text-content-muted underline"
                    >
                      {open ? '댓글 접기' : '댓글 보기'}
                    </button>

                    <LikeButton
                      liked={review.liked_by_me}
                      likeCount={count(review.like_count)}
                      commentCount={count(review.comment_count)}
                      onToggle={() =>
                        toggleLike.mutate({ reviewId: review.id })
                      }
                    />

                    {open && <CommentThread target={{ reviewId: review.id }} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
