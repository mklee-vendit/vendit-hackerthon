import type { RecommendRules } from './rules';
import type { Candidate } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 별점 1~5 를 0~1 로. 후기가 없으면 점수를 **지어내지 않고** 0 으로 둔다(§10.2). */
export function ratingScore(avgRating: number | null): number {
  if (avgRating === null) return 0;
  return clamp01((avgRating - 1) / 4);
}

export function recommendRatioScore(
  recommendCount: number,
  reviewCount: number,
): number {
  if (reviewCount <= 0) return 0;
  return clamp01(recommendCount / reviewCount);
}

/**
 * 최근 후기가 오늘이면 1, `recencyWindowDays` 만큼 지났으면 0. 그 사이는 선형.
 * 기간 자체가 ⚠️ 잠정이라 `rules` 에서 받는다.
 */
export function recencyScore(
  latestReviewAt: Date | null,
  now: Date,
  windowDays: number,
): number {
  if (latestReviewAt === null) return 0;
  const ageDays = (now.getTime() - latestReviewAt.getTime()) / DAY_MS;
  // 미래 날짜는 1 로 본다 — 시계 차이로 음수가 나오면 점수가 1을 넘는다.
  return clamp01(1 - Math.max(0, ageDays) / windowDays);
}

export function scoreParts(
  candidate: Candidate,
  now: Date,
  rules: RecommendRules,
) {
  return {
    rating: ratingScore(candidate.avgRating),
    recommendRatio: recommendRatioScore(
      candidate.recommendCount,
      candidate.reviewCount,
    ),
    recency: recencyScore(
      candidate.latestReviewAt,
      now,
      rules.recencyWindowDays,
    ),
  };
}

export function weightedScore(
  parts: { rating: number; recommendRatio: number; recency: number },
  rules: RecommendRules,
): number {
  return (
    parts.rating * rules.weights.rating +
    parts.recommendRatio * rules.weights.recommendRatio +
    parts.recency * rules.weights.recency
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
