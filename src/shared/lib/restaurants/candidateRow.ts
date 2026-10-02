import type { Candidate, DietTagStat, MenuStat } from '@/shared/lib/recommend';

/**
 * `restaurant_candidates` 뷰의 한 행. 조인과 집계는 DB 가 끝낸 상태로 온다.
 *
 * Postgres 의 `numeric` 은 PostgREST 가 **문자열로** 내려준다(정밀도를 잃지 않기 위해).
 * 그래서 별점·가격 집계는 `string | number | null` 을 다 받아야 한다 — 숫자라고 가정하면
 * `"4.50" * 1` 같은 곳에서 조용히 NaN 이 된다.
 */
export type CandidateRow = {
  id: string;
  name: string;
  category: string;
  /** 측정에 성공한 값만 온다. null 이면 **재지 못한 것**이다(§7) */
  walk_seconds: number | string | null;
  review_count: number | string | null;
  recommend_count: number | string | null;
  avg_rating: number | string | null;
  party_size_max: number | string | null;
  latest_review_at: string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  price_avg: number | string | null;
  price_median: number | string | null;
  diet_tags: {
    diet_option_id: string;
    available_count: number | string | null;
    unavailable_count: number | string | null;
  }[];
  /** 가장 최근 후기의 첫 사진. 없으면 null — 카드가 회색 사선 자리를 그린다 */
  photo_path: string | null;
  /** 길찾기 링크용. `restaurants` 에서 not null 이지만 뷰를 거치므로 타입은 열어 둔다 */
  lon: number | string | null;
  lat: number | string | null;
  /** 언급이 많은 순 → 최근 순으로 정렬돼 온다. 몇 개를 보여줄지는 화면이 자른다 */
  menu: {
    name: string;
    mention_count: number | string | null;
    price_min: number | string | null;
    price_max: number | string | null;
    price_avg: number | string | null;
    price_median: number | string | null;
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
  const reviewCount = toCount(row.review_count);

  const priceMin = toNumber(row.price_min);
  const priceMax = toNumber(row.price_max);
  const priceAvg = toNumber(row.price_avg);
  const priceMedian = toNumber(row.price_median);

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

  const dietTags: DietTagStat[] = (row.diet_tags ?? []).map((tag) => ({
    dietOptionId: tag.diet_option_id,
    availableCount: toCount(tag.available_count),
    unavailableCount: toCount(tag.unavailable_count),
  }));

  // 가격이 하나라도 비면 그 줄은 버린다 — "메뉴 —원" 을 만들지 않는다(§10.2).
  const menu: MenuStat[] = (row.menu ?? []).flatMap((item) => {
    const min = toNumber(item.price_min);
    const max = toNumber(item.price_max);
    const avg = toNumber(item.price_avg);
    const median = toNumber(item.price_median);
    if (min === null || max === null || avg === null || median === null) {
      return [];
    }
    return [
      {
        name: item.name,
        mentionCount: toCount(item.mention_count),
        prices: { min, max, avg, median },
      },
    ];
  });

  const latest = row.latest_review_at ? new Date(row.latest_review_at) : null;

  return {
    restaurantId: row.id,
    name: row.name,
    category: row.category,
    walkSeconds: toNumber(row.walk_seconds),
    reviewCount,
    recommendCount: toCount(row.recommend_count),
    avgRating: toNumber(row.avg_rating),
    partySizeMax: toNumber(row.party_size_max),
    latestReviewAt: latest && !Number.isNaN(latest.getTime()) ? latest : null,
    prices,
    dietTags,
    menu,
    photoPath: row.photo_path,
    lon: toNumber(row.lon),
    lat: toNumber(row.lat),
  };
}
