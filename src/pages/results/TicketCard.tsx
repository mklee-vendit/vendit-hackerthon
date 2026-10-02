import { cn, formatWon } from '@/shared/utils';
import type { RestaurantCardData } from './types';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-track">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function NaverDirectionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="#FFFFFF" />
      <path
        d="M9.5 15v-2.6a1.6 1.6 0 0 1 1.6-1.6h4.2"
        stroke="#03C75A"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.4 8.7 2.1 2.1-2.1 2.1"
        stroke="#03C75A"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type TicketCardProps = {
  restaurant: RestaurantCardData;
  /** 추천픽은 순위 숫자를 브랜드색으로, 나머지는 본문색으로. */
  highlighted?: boolean;
  onDirectionsClick?: () => void;
  onFirstReviewClick?: () => void;
};

/**
 * 1c 식권 카드 — 위는 식당과 근거 숫자, 절취선 아래는 최근 후기 원문.
 *
 * **후기가 0개인 식당도 같은 카드로 보여준다.** 목록으로 따로 빼면 "아직 아무것도 없는
 * 서비스" 처럼 보이는데, 식당 자체는 이미 있고 도보 시간도 재 뒀다. 다만 가격·별점·추천
 * 비율은 **후기에서 나오는 값이라 비워 두고**(§10.2) 절취선 아래에 그 사실을 적는다.
 */
export function TicketCard({
  restaurant: r,
  highlighted = false,
  onDirectionsClick,
  onFirstReviewClick,
}: TicketCardProps) {
  const unreviewed = r.reviewCount === 0;

  return (
    <article className="rounded-[18px] bg-surface shadow-ticket">
      {/* 사진 위 오버레이는 사진 색과 무관하게 읽혀야 해서 다크 모드에서도 고정색이다. */}
      <div
        className="mx-2.5 mt-2.5 flex h-44 flex-col overflow-hidden rounded-xl bg-[repeating-linear-gradient(135deg,var(--color-border)_0_10px,var(--color-track)_10px_20px)] bg-cover bg-center"
        style={
          r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined
        }
      >
        {!r.photoUrl && (
          <span className="m-2.5 self-start rounded-[5px] bg-surface px-[7px] py-[3px] font-mono text-[11px] text-content-muted">
            사진 없음
          </span>
        )}
        <div className="mt-auto bg-linear-to-b from-ink/0 to-ink/84 to-45% px-3.5 pt-[30px] pb-3 font-mono text-ink-content">
          {unreviewed ? (
            // 숫자를 0 으로 채우지 않는다 — ★0.0 · 0% 는 "나쁜 식당" 이라는 다른 뜻이다.
            <div className="text-[13px] leading-tight">아직 후기가 없어요</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="평균 별점"
                value={r.avgStar === null ? '—' : `★ ${r.avgStar.toFixed(1)}`}
              />
              <Stat
                label="추천 비율"
                value={r.recommendRate === null ? '—' : `${r.recommendRate}%`}
              />
              <Stat label="후기 수" value={`${r.reviewCount}개`} />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3.5 px-[18px] pt-3.5 pb-4">
        {!unreviewed && (
          <div
            className={cn(
              'min-w-[26px] flex-none font-display text-[44px] leading-[0.9]',
              highlighted ? 'text-brand' : 'text-content',
            )}
          >
            {r.rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <h3 className="text-lg font-bold tracking-[-0.3px]">{r.name}</h3>
              <span className="text-xs text-content-muted">{r.category}</span>
            </div>
            <button
              type="button"
              aria-label={`${r.name} 네이버 길찾기`}
              onClick={onDirectionsClick}
              className="-my-1.5 -mr-1.5 flex size-11 flex-none items-center justify-center rounded-full bg-naver"
            >
              <NaverDirectionsIcon />
            </button>
          </div>
          {r.unconfirmed.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.unconfirmed.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[11px] text-content-muted"
                >
                  ? {label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 flex gap-3.5 font-mono text-[13px]">
            <span>도보 {r.walkMinutes ?? '—'}분</span>
            <span>
              {r.pricePerPerson === null
                ? '1인 —'
                : `1인 ${formatWon(r.pricePerPerson)}원`}
            </span>
          </div>
          <div className="mt-3 text-[13px] leading-normal">
            <div className="text-xs text-content-muted">대표 메뉴</div>
            {r.menu.length === 0 ? (
              <div className="mt-1">—</div>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {r.menu.map((m) => (
                  <li key={m.name} className="flex items-baseline gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="min-w-3 flex-1 border-b border-dotted border-line" />
                    <span className="font-mono">{formatWon(m.price)}원</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(r.latestReview || unreviewed) && (
        <>
          <div className="relative mx-4 border-t-2 border-dashed border-dash">
            <span className="absolute -top-3 -left-[27px] size-[22px] rounded-full bg-bg" />
            <span className="absolute -top-3 -right-[27px] size-[22px] rounded-full bg-bg" />
          </div>
          <div className="px-[18px] pt-3.5 pb-[18px]">
            {r.latestReview ? (
              <>
                <p className="text-sm leading-[1.55] text-pretty">
                  “{r.latestReview.body}”
                </p>
                <p className="mt-1.5 text-xs text-content-muted">
                  최근 후기 · {r.latestReview.author} · {r.latestReview.when}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] leading-[1.5] text-content-muted">
                  가격·단체 정보를 몰라 판정하지 못했어요
                </p>
                <button
                  type="button"
                  onClick={onFirstReviewClick}
                  className="flex-none text-[13px] font-semibold text-brand"
                >
                  첫 후기 쓰기 →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}
