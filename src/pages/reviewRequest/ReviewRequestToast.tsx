import { useState } from 'react';
import { Z_INDEX } from '@/app/constants/zIndex';
import { TOAST_TYPE } from '@/shared/constants/toast';
import { useToast } from '@/shared/hooks/useToast';
import { extractCause } from '@/shared/lib/extractCause';
import { emptyDraft, type ReviewDraft } from '@/shared/lib/reviews/draft';
import { useCreateReview } from '@/shared/lib/reviews/hooks';
import {
  useDismissReviewRequests,
  useReviewRequest,
} from '@/shared/lib/visits/hooks';
import {
  canSubmitQuickReview,
  type PendingReviewRequest,
  QUICK_BODY_MAX,
  visitLabel,
} from '@/shared/lib/visits/reviewRequest';
import { cn, formatWon, parseWon, particleFor } from '@/shared/utils';

const RATINGS = [1, 2, 3, 4, 5];

const field = 'bg-ink-content/10 rounded-xl';
const label = 'text-xs text-ink-content/75';
const required = <span className="text-brand">*</span>;

/**
 * 2a 후기 요청. 길찾기를 누른 식당이 있으면 멤버 화면 어디서든 위에 뜬다 — 목업은 "로그인 직후
 * 첫 화면" 이지만 당일 클릭도 묻기로 해서(jhey 결정), 지도에서 돌아온 결과 화면에서도 떠야 한다.
 */
export function ReviewRequestToast({ authorName }: { authorName: string }) {
  const request = useReviewRequest();
  if (!request.data) return null;
  // 요청이 바뀌면 입력을 새로 시작한다 — 이전 식당에 쓰던 별점이 남지 않게.
  return (
    <RequestCard
      key={request.data.id}
      request={request.data}
      authorName={authorName}
    />
  );
}

/**
 * **목업에 없던 입력 두 개를 넣었다** — 추천/비추천과 1인 가격. 상세 화면(1g)과 같은 이유로
 * 필수다(`reviews/draft.ts`). 기명/익명 토글은 빼기로 했으므로 그 자리에 "안 쓸래요" 를 둔다.
 */
function RequestCard({
  request,
  authorName,
}: {
  request: PendingReviewRequest;
  authorName: string;
}) {
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const create = useCreateReview(request.restaurant_id);
  const dismiss = useDismissReviewRequests();
  const { openToast } = useToast();

  const patch = (next: Partial<ReviewDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));
  const busy = create.isPending || dismiss.isPending;
  const ready = canSubmitQuickReview(draft) && !busy;
  const error = create.error ?? dismiss.error;

  const submit = () =>
    create.mutate(draft, {
      onSuccess: () => {
        openToast(
          TOAST_TYPE.SUCCESS,
          `후기 등록 완료 · ${request.restaurant_name} ★ ${draft.rating}`,
        );
        // 이 방문은 후기가 생겨 이미 빠졌다. 그보다 먼저 누른 방문까지 닫는다.
        dismiss.mutate(request);
      },
    });

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/18"
        style={{ zIndex: Z_INDEX.reviewRequest }}
      />
      <section
        aria-label="다녀온 식당 후기 요청"
        className="fixed inset-x-3 top-[68px] mx-auto max-w-[456px] rounded-[20px] bg-ink px-4 pt-3.5 pb-3 text-ink-content shadow-modal"
        style={{ zIndex: Z_INDEX.reviewRequest }}
      >
        <div className="flex items-center gap-2 text-xs text-ink-content/75">
          <span className="flex size-[22px] items-center justify-center rounded-md bg-brand font-display text-xs text-brand-content">
            v
          </span>
          <span className="font-semibold text-ink-content">venparty</span>
        </div>

        <div className="mt-2.5">
          <div className={label}>{visitLabel(request, new Date())}</div>
          <div className="mt-0.5 text-base leading-[1.4] font-bold">
            {request.restaurant_name}
            {particleFor(request.restaurant_name, '은', '는')} 어떠셨어요?
          </div>
        </div>

        <div
          className={cn(field, 'mt-3 flex justify-between rounded-[14px] p-1')}
        >
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`별점 ${value}점`}
              aria-pressed={draft.rating === value}
              onClick={() => patch({ rating: value })}
              className={cn(
                'flex h-12 min-w-0 flex-1 items-center justify-center text-[28px]',
                (draft.rating ?? 0) >= value
                  ? 'text-brand'
                  : 'text-ink-content/30',
              )}
            >
              ★
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={label}>추천 {required}</span>
            <div className={cn(field, 'grid h-11 grid-cols-2 gap-0.5 p-[3px]')}>
              {[
                { value: true, text: '추천' },
                { value: false, text: '비추천' },
              ].map(({ value, text }) => (
                <button
                  key={text}
                  type="button"
                  aria-pressed={draft.recommends === value}
                  onClick={() => patch({ recommends: value })}
                  className={cn(
                    'min-w-0 rounded-[9px] text-[13px]',
                    draft.recommends === value
                      ? 'bg-ink-content font-semibold text-ink'
                      : 'text-ink-content/75',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={label}>1인 가격 {required}</span>
            <span
              className={cn(
                field,
                'flex h-11 items-center gap-1 px-3 focus-within:ring-1 focus-within:ring-ink-content/50',
              )}
            >
              <input
                inputMode="numeric"
                value={
                  draft.pricePerPerson === null
                    ? ''
                    : formatWon(draft.pricePerPerson)
                }
                onChange={(e) =>
                  patch({ pricePerPerson: parseWon(e.target.value) })
                }
                className="w-full min-w-0 bg-transparent text-right font-mono text-[15px] font-semibold outline-none"
              />
              <span className="text-xs text-ink-content/75">원</span>
            </span>
          </label>
        </div>

        <div className={cn(label, 'mt-3 flex justify-between')}>
          <span>한 줄 코멘트 {required}</span>
          <span className="font-mono">
            {draft.body.length}/{QUICK_BODY_MAX}
          </span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <input
            value={draft.body}
            maxLength={QUICK_BODY_MAX}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="예: 반찬이 매번 바뀌어서 좋아요"
            className={cn(
              field,
              'h-12 min-w-0 flex-1 px-3 text-sm outline-none placeholder:text-ink-content/45 focus:ring-1 focus:ring-ink-content/50',
            )}
          />
          <button
            type="button"
            disabled={!ready}
            onClick={submit}
            className="h-12 w-16 flex-none rounded-xl bg-brand text-sm font-bold text-brand-content disabled:bg-ink-content/15 disabled:text-ink-content/45"
          >
            등록
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-ink-content">{extractCause(error)}</p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-ink-content/75">
            {authorName}
            {particleFor(authorName, '으로', '로')} 남겨요
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => dismiss.mutate(request)}
            className="h-9 flex-none px-2 text-xs text-ink-content/75 underline underline-offset-2"
          >
            후기 안 쓸래요
          </button>
        </div>
      </section>
    </>
  );
}
