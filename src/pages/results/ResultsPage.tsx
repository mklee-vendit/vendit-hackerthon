import { useState } from 'react';
import { AppHeader } from '@/shared/components/AppHeader';
import { formatWon } from '@/shared/utils';
import { TicketCard } from './TicketCard';
import type { RestaurantCardData, SearchConditions } from './types';

/** 접힌 상태에서 요약 행으로 보여줄 나머지 식당 수 — 목업(1c) 기준 ⚠️ 잠정. */
const COLLAPSED_REST_COUNT = 5;

function ConditionBar({
  conditions: c,
  onEdit,
}: {
  conditions: SearchConditions;
  onEdit?: () => void;
}) {
  const parts = [
    `${c.headcount}명`,
    `1인 ${formatWon(c.budget)}원`,
    `도보 ${c.walkMinutes}분`,
  ];
  return (
    <div className="flex items-center gap-3 bg-ink py-2 pr-2.5 pl-5 text-ink-content">
      <p className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5 font-mono text-[13px] leading-[1.6]">
        <span className="font-bold">{c.situationLabel}</span>
        {parts.map((part) => (
          <span key={part} className="contents">
            <span className="text-ink-muted">·</span>
            <span>{part}</span>
          </span>
        ))}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="h-11 w-14 flex-none rounded-[10px] bg-ink-raised text-[13px] font-semibold"
      >
        수정
      </button>
    </div>
  );
}

function RestRow({ restaurant: r }: { restaurant: RestaurantCardData }) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold">{r.name}</span>
          <span className="flex-none text-xs text-content-muted">
            {r.category}
          </span>
        </div>
        <div className="mt-1 font-mono text-xs text-content-muted">
          도보 {r.walkMinutes ?? '—'}분 · 1인{' '}
          {r.pricePerPerson === null ? '—' : `${formatWon(r.pricePerPerson)}원`}
        </div>
      </div>
      <div className="flex-none text-right font-mono">
        <div className="text-[15px] font-semibold">
          {r.avgStar === null ? '★ —' : `★ ${r.avgStar.toFixed(1)}`}
        </div>
        <div className="mt-0.5 text-xs text-content-muted">
          추천 {r.recommendRate === null ? '—' : `${r.recommendRate}%`} ·{' '}
          {r.reviewCount}개
        </div>
      </div>
    </li>
  );
}

type ResultsPageProps = {
  displayName: string;
  conditions: SearchConditions;
  /** 점수순으로 정렬된 조건 통과 식당 전체. 앞의 pickCount 곳이 추천픽. */
  restaurants: RestaurantCardData[];
  pickCount: number;
  /** 후기가 0개라 판정하지 못한 식당. 하단 별도 구역에 **같은 식권 카드**로 그린다(§6) */
  firstReview?: RestaurantCardData[];
  /** 하단 구역에서 표시 개수를 넘겨 잘린 수 */
  firstReviewTruncated?: number;
  /** 통과 0곳일 때 보여줄 걸린 조건. 조건을 몰래 완화하지 않는다(§6) */
  blocked?: { label: string; count: number }[];
  /** 도보 시간을 재지 못해 판정에서 빠진 수. 조용히 사라지지 않게 알린다(§7·§10.5) */
  unmeasuredWalkCount?: number;
  onEditConditions?: () => void;
  onFirstReviewClick?: (restaurantId: string) => void;
};

export function ResultsPage({
  displayName,
  conditions,
  restaurants,
  pickCount,
  firstReview = [],
  firstReviewTruncated = 0,
  blocked = [],
  unmeasuredWalkCount = 0,
  onEditConditions,
  onFirstReviewClick,
}: ResultsPageProps) {
  const [restOpen, setRestOpen] = useState(false);

  const picks = restaurants.slice(0, pickCount);
  const rest = restaurants.slice(pickCount);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
      <AppHeader activeTab="recommend" displayName={displayName} />
      <ConditionBar conditions={conditions} onEdit={onEditConditions} />

      <main className="pb-7">
        <h1 className="px-5 pt-5 text-xl font-bold tracking-[-0.3px]">
          조건에 맞는 식당{' '}
          <span className="font-mono">{restaurants.length}</span>곳
        </h1>

        {restaurants.length === 0 && (
          <section className="px-5 pt-4">
            <div className="rounded-2xl bg-surface px-5 py-6 shadow-ticket">
              <h2 className="text-base font-bold">조건에 맞는 곳이 없어요</h2>
              {blocked.length > 0 ? (
                <>
                  <p className="mt-1.5 text-[13px] text-content-muted">
                    이 조건에 걸린 식당이에요. 조건을 바꿔보세요.
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5 font-mono text-[13px]">
                    {blocked.map(({ label, count }) => (
                      <li key={label} className="flex justify-between">
                        <span>{label}</span>
                        <span className="text-content-muted">{count}곳</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] text-content-muted">
                  조건을 바꿔보세요.
                </p>
              )}
            </div>
          </section>
        )}

        {restaurants.length > 0 && (
          <section>
            <div className="flex items-baseline gap-2 px-5 pt-[22px] pb-3">
              <h2 className="font-display text-xl leading-none text-brand">
                추천픽
              </h2>
              <span className="text-xs text-content-muted">
                점수 상위 {picks.length}곳 · 별점·추천 비율·최근성
              </span>
            </div>
            <div className="flex flex-col gap-3.5 px-5">
              {picks.map((r) => (
                <TicketCard key={r.id} restaurant={r} highlighted />
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section className="px-5">
            <div className="flex items-baseline justify-between pt-[30px] pb-1">
              <h2 className="text-base font-bold">
                나머지 <span className="font-mono">{rest.length}</span>곳
              </h2>
              <span className="text-xs text-content-muted">점수순</span>
            </div>

            {restOpen ? (
              <div className="flex flex-col gap-3.5 pt-2.5">
                {rest.map((r) => (
                  <TicketCard key={r.id} restaurant={r} />
                ))}
              </div>
            ) : (
              <ul>
                {rest.slice(0, COLLAPSED_REST_COUNT).map((r) => (
                  <RestRow key={r.id} restaurant={r} />
                ))}
              </ul>
            )}

            <button
              type="button"
              aria-expanded={restOpen}
              onClick={() => setRestOpen((open) => !open)}
              className="mt-3 h-12 w-full rounded-xl border border-line text-sm font-semibold active:bg-track"
            >
              {restOpen ? '접기' : `더 보기 · ${rest.length}곳 자세히`}
            </button>
          </section>
        )}

        {firstReview.length > 0 && (
          <section className="px-5">
            <div className="flex items-baseline justify-between pt-[30px] pb-1">
              <h2 className="text-base font-bold">
                아직 후기가 없는 식당{' '}
                <span className="font-mono">{firstReview.length}</span>곳
              </h2>
              <span className="text-xs text-content-muted">매일 바뀌어요</span>
            </div>

            <div className="flex flex-col gap-3.5 pt-2.5">
              {firstReview.map((r) => (
                <TicketCard
                  key={r.id}
                  restaurant={r}
                  onFirstReviewClick={() => onFirstReviewClick?.(r.id)}
                />
              ))}
            </div>
            {firstReviewTruncated > 0 && (
              <p className="pt-3 font-mono text-xs text-content-muted">
                가까운 {firstReview.length}곳만 보여줘요 · 조건 안에{' '}
                {firstReviewTruncated}곳 더 있어요
              </p>
            )}
          </section>
        )}

        {/* 도보를 재지 못한 식당은 판정에서 빠진다 — 숨기지 않고 센 수를 알린다(§7) */}
        {unmeasuredWalkCount > 0 && (
          <p className="px-5 pt-6 font-mono text-xs text-content-muted">
            도보 시간을 재지 못한 {unmeasuredWalkCount}곳은 판정에서 빠졌어요
          </p>
        )}

        {/* ODbL 의무 — 도보 시간이 OSM 에서 왔다는 표시 */}
        <p className="px-5 pt-6 text-[11px] text-content-muted">
          도보 경로 © OpenStreetMap 기여자
        </p>
      </main>
    </div>
  );
}
