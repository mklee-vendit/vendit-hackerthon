import type { NaverMapTarget } from '@/shared/lib/map/naverMap';

export type MenuItem = { name: string; price: number };

export type LatestReview = { body: string; author: string; when: string };

/** 후기가 0개라 판정하지 못한 식당. 하단 "첫 후기" 구역에 쓴다(§6) */
export type FirstReviewItem = {
  id: string;
  name: string;
  category: string;
  walkMinutes: number | null;
};

/** 결과 화면 카드 한 장에 필요한 값. 집계는 데이터 레이어에서 끝난 상태로 들어온다. */
export type RestaurantCardData = {
  id: string;
  rank: number;
  name: string;
  category: string;
  /** 경로 API 실패 시 null — 직선거리로 대체하지 않는다(§7). */
  walkMinutes: number | null;
  /** 집계 결과가 없으면 null — 0 원으로 둥글리지 않는다(§10.2) */
  pricePerPerson: number | null;
  /** 후기가 없으면 null */
  avgStar: number | null;
  /** 후기가 없으면 null */
  recommendRate: number | null;
  reviewCount: number;
  menu: MenuItem[];
  /** 근거가 비어 "미확인" 으로 **계속 표시해야 하는** 조건들(§3·§6) */
  unconfirmed: string[];
  photoUrl?: string;
  latestReview: LatestReview | null;
  /** 네이버 버튼이 갈 곳. 업체 페이지가 1순위, 없으면 좌표 길찾기. 둘 다 없으면 버튼을 안 그린다 */
  naverMap: NaverMapTarget | null;
};

export type SearchConditions = {
  situationLabel: string;
  headcount: number;
  budget: number;
  walkMinutes: number;
};
