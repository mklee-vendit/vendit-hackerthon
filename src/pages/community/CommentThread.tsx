import { useState } from 'react';
import { useConst } from '@/shared/hooks';
import {
  COMMENT_BODY_MAX,
  validateComment,
} from '@/shared/lib/community/draft';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
} from '@/shared/lib/community/hooks';
import { extractCause } from '@/shared/lib/extractCause';
import { cn } from '@/shared/utils';
import { relativeKo } from '@/shared/utils/relativeTime';

type Target = { postId?: string; reviewId?: string };

/** 글과 후기 **양쪽에** 붙는다(§9). 대상만 바꿔 같은 컴포넌트를 쓴다. */
export function CommentThread({ target }: { target: Target }) {
  const now = useConst(() => new Date());
  const [draft, setDraft] = useState('');
  const comments = useComments(target);
  const create = useCreateComment();
  const remove = useDeleteComment();

  const issue = validateComment(draft);
  const over = draft.normalize('NFC').trim().length > COMMENT_BODY_MAX;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {comments.isPending && (
        <p className="text-xs text-content-muted">불러오는 중…</p>
      )}
      {comments.isError && (
        <p className="text-xs text-danger">{extractCause(comments.error)}</p>
      )}
      {comments.data?.length === 0 && (
        <p className="text-xs text-content-muted">
          아직 댓글이 없어요. 첫 댓글을 남겨보세요.
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {comments.data?.map((comment) => (
          <li key={comment.id}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold">
                {comment.is_deleted ? '—' : comment.author_name}
              </span>
              <span className="text-xs text-content-muted">
                {relativeKo(new Date(comment.created_at), now)}
              </span>
              {/* 숨기는 것은 UX 일 뿐이고 권한은 RLS 가 막는다(§10.8) */}
              {comment.is_mine && !comment.is_deleted && (
                <button
                  type="button"
                  onClick={() => remove.mutate(comment.id)}
                  className="ml-auto text-xs text-content-muted underline"
                >
                  삭제
                </button>
              )}
            </div>
            <p
              className={cn(
                'mt-0.5 text-[14px] leading-normal whitespace-pre-wrap',
                comment.is_deleted && 'text-content-muted italic',
              )}
            >
              {/* 지운 댓글도 자리를 남긴다 — 아래 흐름이 끊기지 않게 */}
              {comment.is_deleted ? '삭제된 댓글입니다' : comment.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-1.5">
        <input
          value={draft}
          placeholder="댓글 남기기"
          onChange={(e) => setDraft(e.target.value)}
          // 한글 입력 중 Enter 는 조합을 끝내는 키다 — 가드가 없으면 글자가 잘린 채 올라간다(§10.13)
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            if (issue) return;
            create.mutate(
              { ...target, body: draft },
              { onSuccess: () => setDraft('') },
            );
          }}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-[14px] outline-none focus:border-content"
        />
        <button
          type="button"
          disabled={Boolean(issue) || create.isPending}
          onClick={() =>
            create.mutate(
              { ...target, body: draft },
              { onSuccess: () => setDraft('') },
            )
          }
          className="h-10 flex-none rounded-xl bg-ink px-4 text-[13px] font-semibold text-ink-content disabled:opacity-40"
        >
          등록
        </button>
      </div>
      {over && (
        <p className="mt-1 text-xs text-danger">
          댓글은 {COMMENT_BODY_MAX}자까지예요
        </p>
      )}
      {create.isError && (
        <p className="mt-1 text-xs text-danger">{extractCause(create.error)}</p>
      )}
    </div>
  );
}
