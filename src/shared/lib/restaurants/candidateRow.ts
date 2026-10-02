import type { Candidate, DietTagStat } from '@/shared/lib/recommend';

/**
 * DB 에서 한 식당에 대해 읽어 오는 모양. `restaurants` 에 집계 뷰들을 붙인 결과다.
 *
 * Postgres 의 `numeric` 은 PostgREST 가 **문자열로** 내려준다(정밀도를 잃지 않기 위해).
 * 그래서 별점·가격 집계는 `string | number | null` 을 다 받아야 한다 — 숫자라고 가정하면
 * `"4.50" * 1` 같은 곳에서 조용히 NaN 이 된다.
 */
export type CandidateRow = {
  id: string;
  name: string;
  category: string;
  restaurant_stats: {
    review_count: number | string | null;
    recommend_count: number | string | null;
    avg_rating: number | string | null;
    party_size_max: number | string | null;
    latest_review_at: string | null;
    price_min: number | string | null;
    price_max: number | string | null;
    price_avg: number | string | null;
    price_median: number | string | null;
  } | null;
  /** 측정에 성공한 행만 오는 뷰다. 없으면 **재지 못한 것**이고 0 이 아니다(§7) */
  walk_times_valid: { seconds: number | string | null } | null;
  restaurant_diet_stats: {
    diet_option_id: string;
    available_count: number | string | null;
    unavailable_count: number | string | null;
  }[];
};

/** `numeric` 이 문자열로 와도 숫자로 만든다. 못 만들면 **0 으로 메우지 않고** null 이다. */
export function toNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 개수처럼 "없으면 0" 이 맞는 값에만 쓴다. */
function toCount(value: number | string | null | undefined): number {
  return toNumber(value) ?? 0;
}

export function toCandidate(row: CandidateRow): Candidate {
  const stats = row.restaurant_stats;
  const reviewCount = toCount(stats?.review_count);

  const priceMin = toNumber(stats?.price_min);
  const priceMax = toNumber(stats?.price_max);
  const priceAvg = toNumber(stats?.price_avg);
  const priceMedian = toNumber(stats?.price_median);

  // 후기가 있으면 1인 가격은 필수라 네 값이 다 있어야 한다(§3). 하나라도 비면 데이터가
  // 어긋난 것이므로 **일부만 채운 객체를 만들지 않는다** — 판정은 그걸 탈락으로 다룬다.
  const prices =
    reviewCount > 0 &&
    priceMin !== null &&
    priceMax !== null &&
    priceAvg !== null &&
    priceMedian !== null
      ? { min: priceMin, max: priceMax, avg: priceAvg, median: priceMedian }
      : null;

  const dietTags: DietTagStat[] = row.restaurant_diet_stats.map((tag) => ({
    dietOptionId: tag.diet_option_id,
    availableCount: toCount(tag.available_count),
    unavailableCount: toCount(tag.unavailable_count),
  }));

  const latest = stats?.latest_review_at;
  const latestReviewAt = latest ? new Date(latest) : null;

  return {
    restaurantId: row.id,
    name: row.name,
    category: row.category,
    walkSeconds: toNumber(row.walk_times_valid?.seconds ?? null),
    reviewCount,
    recommendCount: toCount(stats?.recommend_count),
    avgRating: toNumber(stats?.avg_rating),
    partySizeMax: toNumber(stats?.party_size_max),
    latestReviewAt:
      latestReviewAt && !Number.isNaN(latestReviewAt.getTime())
        ? latestReviewAt
        : null,
    prices,
    dietTags,
  };
}
