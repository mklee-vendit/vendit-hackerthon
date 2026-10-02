import type { NaverMapTarget } from '@/shared/lib/map/naverMap';

export type MenuItem = { name: string; price: number };

export type MenuSource = 'review' | 'naver';
export type PhotoSource = 'review' | 'naver' | null;

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
  /** 후기 집계. 없으면 null — 0 원으로 둥글리지 않는다(§10.2) */
  pricePerPerson: number | null;
  /**
   * 후기가 없을 때 쓰는 **메뉴판 기준** 1인 금액. 출처가 다르므로 화면이 라벨을 붙이고,
   * 후기 값이 있으면 쓰지 않는다(§8 단일 기준).
   */
  menuPricePerPerson: number | null;
  /** 후기가 없으면 null */
  avgStar: number | null;
  /** 후기가 없으면 null */
  recommendRate: number | null;
  reviewCount: number;
  menu: MenuItem[];
  /** 메뉴 줄의 출처. 'naver' 면 "대표 메뉴" 가 아니라 "메뉴판" 이다 */
  menuSource: MenuSource;
  /** 근거가 비어 "미확인" 으로 **계속 표시해야 하는** 조건들(§3·§6) */
  unconfirmed: string[];
  photoUrl?: string;
  /** 사진의 출처. 벤더가 찍은 것과 가게 사진을 섞어 보여 주지 않기 위해 */
  photoSource: PhotoSource;
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
