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
  MenuSource,
  PhotoSource,
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

/**
 * 메뉴 줄. **후기가 이긴다** — 벤더가 먹은 메뉴가 이 서비스의 값이고, 메뉴판은 가게가 내건
 * 값이다. 후기에 아무도 안 적었으면 메뉴판으로 채우고 화면이 라벨을 가른다.
 */
export function toMenu(
  candidate: Candidate,
  rules: RecommendRules,
): { items: MenuItem[]; source: MenuSource } {
  const fromReview = toMenuItems(candidate, rules);
  if (fromReview.length > 0) return { items: fromReview, source: 'review' };
  return {
    items: candidate.naverMenu.slice(0, rules.menuCount),
    source: 'naver',
  };
}

/** 사진도 후기가 먼저다. 둘 다 없으면 카드가 회색 사선 자리를 그린다. */
export function toPhoto(candidate: Candidate): {
  url: string | undefined;
  source: PhotoSource;
} {
  const fromReview = photoPublicUrl(candidate.photoPath);
  if (fromReview) return { url: fromReview, source: 'review' };
  if (candidate.naverPhotoUrl) {
    return { url: candidate.naverPhotoUrl, source: 'naver' };
  }
  return { url: undefined, source: null };
}

/** 후기 0개 카드의 메뉴판 줄 수. `rules.menuCount` 와 같은 뜻이지만 이 함수는 rules 를 받지 않는다 */
const NAVER_MENU_LINES = 3;

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
  const menu = toMenu(candidate, rules);
  const photo = toPhoto(candidate);
  return {
    id: candidate.restaurantId,
    rank,
    name: candidate.name,
    category: candidate.category,
    walkMinutes: toWalkMinutes(candidate.walkSeconds),
    pricePerPerson: priceFor(candidate, rules.priceAggregate),
    menuPricePerPerson: candidate.naverPrices?.median ?? null,
    avgStar: candidate.avgRating,
    recommendRate: toRecommendRate(
      candidate.recommendCount,
      candidate.reviewCount,
    ),
    reviewCount: candidate.reviewCount,
    menu: menu.items,
    menuSource: menu.source,
    unconfirmed: scored.unconfirmed.map((kind) => UNCONFIRMED_LABEL[kind]),
    photoUrl: photo.url,
    photoSource: photo.source,
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
 * 별점·추천 비율은 후기에서 나오는 값이라 null 이다 — 0 으로 채우면 ★0.0 · 0% 가 되어
 * "나쁜 식당" 이라는 **다른 뜻**이 된다(§10.2). 순위도 없다(점수가 없으므로).
 *
 * 1인 가격·메뉴·사진은 **메뉴판에서** 채운다. 출처가 후기와 다르므로 화면이 라벨을 가른다.
 */
export function toUnreviewedCardData(candidate: Candidate): RestaurantCardData {
  const photo = toPhoto(candidate);
  return {
    id: candidate.restaurantId,
    rank: 0,
    name: candidate.name,
    category: candidate.category,
    walkMinutes: toWalkMinutes(candidate.walkSeconds),
    pricePerPerson: null,
    // 후기가 없어도 **메뉴판이 있으면** 금액을 보여 줄 수 있다. 라벨로 출처를 밝힌다.
    menuPricePerPerson: candidate.naverPrices?.median ?? null,
    avgStar: null,
    recommendRate: null,
    reviewCount: 0,
    menu: candidate.naverMenu.slice(0, NAVER_MENU_LINES),
    menuSource: 'naver',
    unconfirmed: [],
    photoUrl: photo.url,
    photoSource: photo.source,
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
  /** 사진·메뉴판이 없어 하단 구역에서 빠진 수. 조건에 걸린 것과는 다른 이유다 */
  firstReviewNoInfo: number;
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
    firstReviewNoInfo: recommendation.firstReviewNoInfo,
    blocked: recommendation.blocked.map(({ reason, count }) => ({
      label: BLOCK_LABEL[reason],
      count,
    })),
    unmeasuredWalkCount: recommendation.unmeasuredWalkCount,
  };
}
