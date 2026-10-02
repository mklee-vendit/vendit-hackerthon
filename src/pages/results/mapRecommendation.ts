import { SITUATION_LABEL } from '@/shared/constants/search';
import { naverMapTarget } from '@/shared/lib/map/naverMap';
import {
  type BlockReason,
  type Candidate,
  priceFor,
  type Recommendation,
  type RecommendRules,
  type Scored,
  type SearchCriteria,
  type Unconfirmed,
} from '@/shared/lib/recommend';
import { photoPublicUrl } from '@/shared/lib/reviews/photoUrl';
import type {
  FirstReviewItem,
  LatestReview,
  MenuItem,
  RestaurantCardData,
  SearchConditions,
} from './types';

/** 초를 분으로. **반올림이 아니라 올림**이다 — "도보 10분" 상한에 11분을 10분으로 보여주면 거짓말이 된다. */
export function toWalkMinutes(seconds: number | null): number | null {
  if (seconds === null) return null;
  return Math.max(1, Math.ceil(seconds / 60));
}

export function toRecommendRate(
  recommendCount: number,
  reviewCount: number,
): number | null {
  if (reviewCount <= 0) return null;
  return Math.round((recommendCount / reviewCount) * 100);
}

const UNCONFIRMED_LABEL: Record<Unconfirmed, string> = {
  party: '단체석 미확인',
  diet: '식사 제약 미확인',
};

export const BLOCK_LABEL: Record<BlockReason, string> = {
  walk: '도보 시간',
  price: '1인 예산',
  party: '단체 수용 인원',
  diet: '식사 제약',
};

/** 카드에 보여줄 대표 메뉴. 몇 줄을 보여줄지와 어느 가격을 쓸지는 rules 가 정한다. */
export function toMenuItems(
  candidate: Candidate,
  rules: RecommendRules,
): MenuItem[] {
  return candidate.menu.slice(0, rules.menuCount).map((item) => ({
    name: item.name,
    price: item.prices[rules.priceAggregate],
  }));
}

const toNaverMap = (candidate: Candidate) =>
  naverMapTarget({
    name: candidate.name,
    lon: candidate.lon,
    lat: candidate.lat,
    naverPlaceId: candidate.naverPlaceId,
  });

export function toCardData(
  scored: Scored,
  rank: number,
  rules: RecommendRules,
  latestReview: LatestReview | null,
): RestaurantCardData {
  const { candidate } = scored;
  return {
    id: candidate.restaurantId,
    rank,
    name: candidate.name,
    category: candidate.category,
    walkMinutes: toWalkMinutes(candidate.walkSeconds),
    pricePerPerson: priceFor(candidate, rules.priceAggregate),
    avgStar: candidate.avgRating,
    recommendRate: toRecommendRate(
      candidate.recommendCount,
      candidate.reviewCount,
    ),
    reviewCount: candidate.reviewCount,
    // 대표 메뉴는 후기에 적힌 것에서 쌓인다(§3 의 패턴). 아무도 안 적었으면 비어 있고,
    // 목업이 "메뉴 —" 으로 그 상태를 그려 뒀다.
    menu: toMenuItems(candidate, rules),
    unconfirmed: scored.unconfirmed.map((kind) => UNCONFIRMED_LABEL[kind]),
    photoUrl: photoPublicUrl(candidate.photoPath),
    latestReview,
    naverMap: toNaverMap(candidate),
  };
}

export function toFirstReviewItem(candidate: Candidate): FirstReviewItem {
  return {
    id: candidate.restaurantId,
    name: candidate.name,
    category: candidate.category,
    walkMinutes: toWalkMinutes(candidate.walkSeconds),
  };
}

/**
 * 후기 0개 식당을 **같은 식권 카드**로 그리기 위한 모양.
 *
 * 가격·별점·추천 비율은 후기에서 나오는 값이라 전부 null 이다 — 0 으로 채우면 ★0.0 · 0% 가
 * 되어 "나쁜 식당" 이라는 **다른 뜻**이 된다(§10.2). 순위도 없다(점수가 없으므로).
 */
export function toUnreviewedCardData(candidate: Candidate): RestaurantCardData {
  return {
    id: candidate.restaurantId,
    rank: 0,
    name: candidate.name,
    category: candidate.category,
    walkMinutes: toWalkMinutes(candidate.walkSeconds),
    pricePerPerson: null,
    avgStar: null,
    recommendRate: null,
    reviewCount: 0,
    menu: [],
    unconfirmed: [],
    photoUrl: photoPublicUrl(candidate.photoPath),
    latestReview: null,
    naverMap: toNaverMap(candidate),
  };
}

export function toConditions(criteria: SearchCriteria): SearchConditions {
  return {
    situationLabel: SITUATION_LABEL[criteria.situation],
    headcount: criteria.headcount,
    budget: criteria.budgetPerPerson,
    walkMinutes: criteria.maxWalkMinutes,
  };
}

export type ResultsViewModel = {
  conditions: SearchConditions;
  /** 점수순. 앞의 pickCount 곳이 추천픽이다(화면이 그렇게 자른다) */
  restaurants: RestaurantCardData[];
  pickCount: number;
  firstReview: FirstReviewItem[];
  /** 같은 목록을 식권 카드로도 그릴 수 있게 */
  firstReviewCards: RestaurantCardData[];
  firstReviewTruncated: number;
  /** 통과 0곳일 때 보여줄 "걸린 조건". 사람이 읽는 말로 바꿔 둔다 */
  blocked: { label: string; count: number }[];
  unmeasuredWalkCount: number;
};

export function toResultsViewModel({
  recommendation,
  criteria,
  rules,
  latestReviews,
}: {
  recommendation: Recommendation;
  criteria: SearchCriteria;
  rules: RecommendRules;
  /** 식당 id → 최근 후기 1건. §6 이 추천픽 근거로 요구한다 */
  latestReviews: Map<string, LatestReview>;
}): ResultsViewModel {
  const ordered = [...recommendation.picks, ...recommendation.rest];

  return {
    conditions: toConditions(criteria),
    restaurants: ordered.map((scored, index) =>
      toCardData(
        scored,
        index + 1,
        rules,
        latestReviews.get(scored.candidate.restaurantId) ?? null,
      ),
    ),
    pickCount: recommendation.picks.length,
    firstReview: recommendation.firstReview.map(toFirstReviewItem),
    firstReviewCards: recommendation.firstReview.map(toUnreviewedCardData),
    firstReviewTruncated: recommendation.firstReviewTruncated,
    blocked: recommendation.blocked.map(({ reason, count }) => ({
      label: BLOCK_LABEL[reason],
      count,
    })),
    unmeasuredWalkCount: recommendation.unmeasuredWalkCount,
  };
}
