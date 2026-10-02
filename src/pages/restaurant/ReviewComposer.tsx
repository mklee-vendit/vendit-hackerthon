import { useState } from 'react';
import {
  DRAFT_ISSUE_LABEL,
  emptyDraft,
  MENU_ROWS_MAX,
  REVIEW_BODY_MAX,
  type ReviewDraft,
  remainingChars,
  validateDraft,
} from '@/shared/lib/reviews/draft';
import { cn, formatWon, parseWon } from '@/shared/utils';

const RATINGS = [1, 2, 3, 4, 5];

type ReviewComposerProps = {
  authorName: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (draft: ReviewDraft) => void;
};

const fieldLabel = 'text-[13px] font-semibold';
const required = <span className="ml-0.5 text-danger">*</span>;

/**
 * 1g 의 후기 작성 칸.
 *
 * **목업에 없던 입력 두 개를 넣었다** — 1인 가격과 추천/비추천. §3 은 1인 가격을 필수로,
 * §6 은 추천 비율을 점수에 쓴다. 안 받으면 그 후기는 집계에서 빠지고, 2a 메모도 같은 지적을
 * 한다. 둘 다 `*` 로 표시한다.
 *
 * 글자 수는 목업의 200자가 아니라 **확정값 300자**다.
 */
export function ReviewComposer({
  authorName,
  pending = false,
  error = null,
  onSubmit,
}: ReviewComposerProps) {
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [touched, setTouched] = useState(false);

  const issues = validateDraft(draft);
  const left = remainingChars(draft.body);
  const patch = (next: Partial<ReviewDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  return (
    <section className="rounded-2xl bg-surface px-[18px] py-4 shadow-ticket">
      <p className="text-xs text-content-muted">
        <span className="font-semibold text-content">{authorName}</span> 으로
        남겨요
      </p>

      <div className="mt-3.5 flex items-center justify-between">
        <span className={fieldLabel}>별점{required}</span>
        <div className="flex gap-1">
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`별점 ${value}점`}
              aria-pressed={draft.rating === value}
              onClick={() => patch({ rating: value })}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg text-lg',
                (draft.rating ?? 0) >= value
                  ? 'text-brand'
                  : 'text-content-muted',
              )}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-dashed border-dash pt-3.5">
        <span className={fieldLabel}>추천{required}</span>
        <div className="flex gap-1.5">
          {[
            { value: true, label: '추천' },
            { value: false, label: '비추천' },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={draft.recommends === value}
              onClick={() => patch({ recommends: value })}
              className={cn(
                'h-9 min-w-16 rounded-lg px-3 text-[13px] font-semibold',
                draft.recommends === value
                  ? 'bg-ink text-ink-content'
                  : 'border border-line text-content-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-2 flex items-center justify-between border-t border-dashed border-dash pt-3.5">
        <span className={fieldLabel}>1인 가격{required}</span>
        <span className="flex h-10 w-[140px] items-center justify-end gap-1 rounded-xl border border-line px-3 focus-within:border-content">
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
            className="w-full min-w-0 bg-transparent text-right font-mono text-base font-semibold outline-none"
          />
          {draft.pricePerPerson !== null && (
            <span className="text-xs text-content-muted">원</span>
          )}
        </span>
      </label>

      <label className="mt-2 flex items-center justify-between border-t border-dashed border-dash pt-3.5">
        <span className={fieldLabel}>함께 간 인원</span>
        <span className="flex h-10 w-[140px] items-center justify-end gap-1 rounded-xl border border-line px-3 focus-within:border-content">
          <input
            inputMode="numeric"
            placeholder="선택"
            value={draft.partySize === null ? '' : String(draft.partySize)}
            onChange={(e) => patch({ partySize: parseWon(e.target.value) })}
            className="w-full min-w-0 bg-transparent text-right font-mono text-base font-semibold outline-none placeholder:font-sans placeholder:text-xs placeholder:font-normal"
          />
          {/* 값이 없을 때 단위를 띄우면 "선택 명" 으로 붙어 읽힌다 */}
          {draft.partySize !== null && (
            <span className="text-xs text-content-muted">명</span>
          )}
        </span>
      </label>

      <div className="mt-2 border-t border-dashed border-dash pt-3.5">
        <div className="flex items-baseline justify-between">
          <span className={fieldLabel}>먹은 메뉴</span>
          <span className="text-xs text-content-muted">
            적어두면 다음 사람 카드에 보여요
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {draft.menu.map((item, index) => (
            // 줄 자체에는 안정적인 id 가 없다. 지우면 뒤 줄이 당겨지므로 index 가 바뀌는데,
            // 줄 수가 적고 입력 중 재정렬이 없어 눈에 띄는 문제가 없다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 재정렬이 없는 짧은 입력 목록
            <li key={index} className="flex gap-1.5">
              <input
                value={item.name}
                placeholder="메뉴 이름"
                onChange={(e) =>
                  patch({
                    menu: draft.menu.map((row, i) =>
                      i === index ? { ...row, name: e.target.value } : row,
                    ),
                  })
                }
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-[14px] outline-none focus:border-content"
              />
              <span className="flex h-10 w-[108px] flex-none items-center justify-end gap-1 rounded-xl border border-line px-3 focus-within:border-content">
                <input
                  inputMode="numeric"
                  placeholder="가격"
                  value={item.price === null ? '' : formatWon(item.price)}
                  onChange={(e) =>
                    patch({
                      menu: draft.menu.map((row, i) =>
                        i === index
                          ? { ...row, price: parseWon(e.target.value) }
                          : row,
                      ),
                    })
                  }
                  className="w-full min-w-0 bg-transparent text-right font-mono text-sm font-semibold outline-none placeholder:font-sans placeholder:text-xs placeholder:font-normal"
                />
                {item.price !== null && (
                  <span className="text-xs text-content-muted">원</span>
                )}
              </span>
              <button
                type="button"
                aria-label="메뉴 줄 지우기"
                onClick={() =>
                  patch({ menu: draft.menu.filter((_, i) => i !== index) })
                }
                className="size-10 flex-none rounded-xl border border-line text-content-muted"
              >
                −
              </button>
            </li>
          ))}
        </ul>
        {draft.menu.length < MENU_ROWS_MAX && (
          <button
            type="button"
            onClick={() =>
              patch({ menu: [...draft.menu, { name: '', price: null }] })
            }
            className="mt-2 h-10 w-full rounded-xl border border-dashed border-line text-[13px] font-semibold text-content-muted"
          >
            + 메뉴 추가
          </button>
        )}
      </div>

      <div className="mt-2 border-t border-dashed border-dash pt-3.5">
        <div className="flex items-baseline justify-between">
          <span className={fieldLabel}>사진</span>
          <span className="text-xs text-content-muted">
            올리면 자동으로 줄여서 저장해요
          </span>
        </div>
        {draft.photo ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-content-muted">
              {draft.photo.name}
            </span>
            <button
              type="button"
              onClick={() => patch({ photo: null })}
              className="h-9 flex-none rounded-lg border border-line px-3 text-[13px] text-content-muted"
            >
              빼기
            </button>
          </div>
        ) : (
          <label className="mt-2 flex h-10 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line text-[13px] font-semibold text-content-muted">
            + 사진 고르기
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => patch({ photo: e.target.files?.[0] ?? null })}
            />
          </label>
        )}
      </div>

      <div className="mt-2 border-t border-dashed border-dash pt-3.5">
        <div className="flex items-baseline justify-between">
          <span className={fieldLabel}>짧은 후기{required}</span>
          <span
            className={cn(
              'font-mono text-xs',
              left < 0 ? 'text-danger' : 'text-content-muted',
            )}
          >
            {REVIEW_BODY_MAX - left} / {REVIEW_BODY_MAX}
          </span>
        </div>
        <textarea
          rows={3}
          value={draft.body}
          onChange={(e) => patch({ body: e.target.value })}
          placeholder="맛·대기 시간·좌석처럼 다음 사람이 알면 좋은 것을 적어주세요"
          className="mt-2 w-full resize-none rounded-xl border border-line bg-transparent px-3 py-2.5 text-[14px] leading-normal outline-none focus:border-content"
        />
      </div>

      {touched && issues.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1">
          {issues.map((issue) => (
            <li key={issue} className="text-xs text-danger">
              {DRAFT_ISSUE_LABEL[issue]}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2.5 text-xs text-danger">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setTouched(true);
          if (issues.length === 0) {
            onSubmit(draft);
            setDraft(emptyDraft());
            setTouched(false);
          }
        }}
        className="mt-3.5 h-12 w-full rounded-xl bg-brand text-sm font-bold text-brand-content disabled:opacity-50"
      >
        {pending ? '등록 중…' : '후기 등록'}
      </button>
    </section>
  );
}
