import {
  normalizedBody,
  type ReviewDraft,
  validateDraft,
} from '@/shared/lib/reviews/draft';

/** `pending_review_requests` 뷰의 한 행. */
export type PendingReviewRequest = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  /** KST 날짜 `YYYY-MM-DD` — DB 가 정한다 */
  visited_on: string;
  created_at: string;
};

/** 2a 의 한 줄 코멘트 상한. 목업 값(잠정)이고, DB 상한 300자 안쪽이라 그대로 저장된다. */
export const QUICK_BODY_MAX = 50;

/** 점심/저녁을 가르는 KST 시각. 16시 전에 누른 길찾기는 점심으로 본다(잠정). */
const DINNER_FROM_HOUR = 16;

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toKst = (instant: Date) => new Date(instant.getTime() + KST_OFFSET_MS);

/** 지금의 KST 날짜 `YYYY-MM-DD`. DB 의 `visited_on` 과 같은 기준이다. */
export function kstDate(instant: Date): string {
  return toKst(instant).toISOString().slice(0, 10);
}

/** 한 번에 하나만 묻는다 — 가장 최근에 누른 식당. */
export function pickReviewRequest(
  rows: readonly PendingReviewRequest[],
): PendingReviewRequest | null {
  return rows.reduce<PendingReviewRequest | null>(
    (latest, row) =>
      latest === null || row.created_at > latest.created_at ? row : latest,
    null,
  );
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000));

/** "어제 · 10.01 (목) 점심". 이틀 이상 지났으면 날짜만 쓴다. */
export function visitLabel(
  request: Pick<PendingReviewRequest, 'visited_on' | 'created_at'>,
  now: Date,
): string {
  const [, month, day] = request.visited_on.split('-').map(Number);
  const weekday = WEEKDAY[new Date(`${request.visited_on}T00:00:00Z`).getUTCDay()];
  const meal =
    toKst(new Date(request.created_at)).getUTCHours() < DINNER_FROM_HOUR
      ? '점심'
      : '저녁';
  const date = `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday}) ${meal}`;

  const ago = daysBetween(request.visited_on, kstDate(now));
  if (ago === 0) return `오늘 · ${date}`;
  if (ago === 1) return `어제 · ${date}`;
  return date;
}

/**
 * 토스트로 보낼 수 있는 후기인가. 상세 화면과 같은 필수값(별점·추천·1인 가격·본문)을 받고,
 * 본문만 한 줄 상한으로 더 좁힌다.
 */
export function canSubmitQuickReview(draft: ReviewDraft): boolean {
  return (
    validateDraft(draft).length === 0 &&
    normalizedBody(draft.body).length <= QUICK_BODY_MAX
  );
}
