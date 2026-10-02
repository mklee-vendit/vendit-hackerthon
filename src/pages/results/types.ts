export type MenuItem = { name: string; price: number };

export type LatestReview = { body: string; author: string; when: string };

/** 결과 화면 카드 한 장에 필요한 값. 집계는 데이터 레이어에서 끝난 상태로 들어온다. */
export type RestaurantCardData = {
  id: string;
  rank: number;
  name: string;
  category: string;
  /** 경로 API 실패 시 null — 직선거리로 대체하지 않는다(§7). */
  walkMinutes: number | null;
  pricePerPerson: number;
  avgStar: number;
  recommendRate: number;
  reviewCount: number;
  menu: MenuItem[];
  photoUrl?: string;
  latestReview: LatestReview | null;
};

export type SearchConditions = {
  situationLabel: string;
  headcount: number;
  budget: number;
  walkMinutes: number;
};
