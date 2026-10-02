import { useState } from 'react';
import { AppHeader, type AppTab } from '@/shared/components/AppHeader';
import {
  DEFAULT_BUDGET,
  DEFAULT_WALK_MINUTES,
  SITUATION_LABEL,
  type Situation,
  WALK_MINUTE_OPTIONS,
} from '@/shared/constants/search';
import type { SearchCriteria } from '@/shared/lib/recommend';
import { cn, formatWon, parseWon } from '@/shared/utils';

const SITUATIONS: Situation[] = ['lunch', 'party'];

const stepButton =
  'flex size-11 items-center justify-center rounded-xl border border-line text-xl disabled:text-content-muted';

type SearchPageProps = {
  displayName: string;
  /** 하단 수집 상태 줄 — 수집 실패를 숨기지 않기 위한 표시(§7). */
  collectionNote: string;
  /** 누른 시점의 조건을 그대로 넘긴다. 화면은 조건을 어디로 보낼지 모른다 */
  onSubmit?: (criteria: SearchCriteria) => void;
  onTabChange?: (tab: AppTab) => void;
};
export function SearchPage({
  displayName,
  collectionNote,
  onSubmit,
  onTabChange,
}: SearchPageProps) {
  const [situation, setSituation] = useState<Situation>('lunch');
  const [headcount, setHeadcount] = useState(6);
  const [budget, setBudget] = useState<number | null>(DEFAULT_BUDGET.lunch);
  const [walkMinutes, setWalkMinutes] = useState(DEFAULT_WALK_MINUTES);

  // 상황을 바꾸면 예산이 그 상황 기본값으로 돌아간다 (1b 목업 메모).
  const changeSituation = (next: Situation) => {
    setSituation(next);
    setBudget(DEFAULT_BUDGET[next]);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
      <AppHeader
        activeTab="recommend"
        displayName={displayName}
        onTabChange={onTabChange}
      />

      <main className="flex flex-1 flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-2xl leading-[1.3] font-bold tracking-[-0.4px]">
            오늘 {SITUATION_LABEL[situation]}, 어디 갈까요?
          </h1>
          <p className="mt-1.5 text-sm text-content-muted">
            조건을 넣으면 벤더 후기로 골라드려요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-track p-1">
          {SITUATIONS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === situation}
              onClick={() => changeSituation(key)}
              className={cn(
                'h-[46px] min-w-0 rounded-[10px] text-[15px]',
                key === situation
                  ? 'bg-ink font-semibold text-ink-content'
                  : 'font-medium text-content-muted',
              )}
            >
              {SITUATION_LABEL[key]}
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-surface px-[18px] py-0.5">
          <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-dash py-3.5">
            <span className="text-sm font-semibold">인원</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="인원 줄이기"
                disabled={headcount <= 1}
                onClick={() => setHeadcount((n) => Math.max(1, n - 1))}
                className={cn(stepButton, 'text-content-muted')}
              >
                −
              </button>
              <output className="min-w-14 text-center font-mono text-lg font-semibold">
                {headcount}명
              </output>
              <button
                type="button"
                aria-label="인원 늘리기"
                onClick={() => setHeadcount((n) => n + 1)}
                className={stepButton}
              >
                +
              </button>
            </div>
          </div>

          <div className="border-b-[1.5px] border-dashed border-dash py-3.5">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold">1인 예산</span>
              <span className="flex h-11 w-[150px] items-center justify-end gap-1 rounded-xl border border-line px-3.5 focus-within:border-content">
                <input
                  inputMode="numeric"
                  value={budget === null ? '' : formatWon(budget)}
                  onChange={(e) => setBudget(parseWon(e.target.value))}
                  className="w-full min-w-0 bg-transparent text-right font-mono text-lg font-semibold outline-none"
                />
                <span className="text-sm text-content-muted">원</span>
              </span>
            </label>
            <p className="mt-2 text-right text-xs text-content-muted">
              {SITUATION_LABEL[situation]} 기본값 · 바꿀 수 있어요
            </p>
          </div>

          <div className="pt-3.5 pb-[18px]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">최대 도보</span>
              <span className="text-xs text-content-muted">
                보행자 경로 실측 기준
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-sm">
              {WALK_MINUTE_OPTIONS.map((min) => (
                <button
                  key={min}
                  type="button"
                  aria-pressed={min === walkMinutes}
                  onClick={() => setWalkMinutes(min)}
                  className={cn(
                    'h-11 min-w-0 rounded-xl',
                    min === walkMinutes
                      ? 'bg-ink font-semibold text-ink-content'
                      : 'border border-line',
                  )}
                >
                  {min}분
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="flex-1" />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            // 예산을 비운 채로는 검색하지 않는다 — 빈 칸을 0 원으로 읽으면 결과가 0곳이 되고,
            // 사용자는 조건이 비었다는 걸 모른 채 "맞는 곳 없음" 을 본다(§10.5).
            disabled={budget === null}
            onClick={() =>
              budget !== null &&
              onSubmit?.({
                situation,
                headcount,
                budgetPerPerson: budget,
                maxWalkMinutes: walkMinutes,
                dietOptionIds: [],
              })
            }
            className="h-14 w-full rounded-[14px] bg-brand text-base font-bold text-brand-content disabled:opacity-50"
          >
            식당 찾기
          </button>
          <p className="text-center font-mono text-xs text-content-muted">
            {collectionNote}
          </p>
        </div>
      </main>
    </div>
  );
}
