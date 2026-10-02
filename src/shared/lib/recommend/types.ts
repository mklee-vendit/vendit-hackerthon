export type Situation = 'lunch' | 'party';

/** 후기 태그를 식당 단위로 접은 값. `restaurant_diet_stats` 뷰 모양 그대로. */
export type DietTagStat = {
  dietOptionId: string;
  availableCount: number;
  unavailableCount: number;
};

/**
 * 1인 가격 집계. **어느 값으로 판정할지는 아직 정해지지 않았으므로**(§13) 뷰가 재료를 다
 * 내놓고 `rules` 가 고른다 — 고르는 자리를 한 곳으로 모으기 위한 것이다(§10.1).
 */
export type PriceStat = {
  min: number;
  max: number;
  avg: number;
  median: number;
};

/** 메뉴 한 줄의 집계. 가격이 후기마다 다를 수 있어 같은 재료를 다 들고 있다. */
export type MenuStat = {
  name: string;
  mentionCount: number;
  prices: PriceStat;
};

/**
 * 판정에 들어가는 식당 한 곳. DB 의 `restaurants` + `restaurant_stats` +
 * `walk_times_valid` + `restaurant_diet_stats` 를 합친 모양이다.
 *
 * **없는 값은 `null` 이고 0 이나 추측으로 메우지 않는다**(§10.2). `walkSeconds` 가 null 이면
 * 측정하지 못한 것이고, 직선거리로 대신하지 않는다(§7).
 */
export type Candidate = {
  restaurantId: string;
  name: string;
  category: string;
  walkSeconds: number | null;
  reviewCount: number;
  recommendCount: number;
  avgRating: number | null;
  /** 후기에 적힌 "함께 간 인원"의 최대값. null 이면 아무도 안 적었다 = 단체석 미확인 */
  partySizeMax: number | null;
  latestReviewAt: Date | null;
  /** 후기가 0개면 null. 후기가 있으면 1인 가격이 필수라 항상 있다(§3) */
  prices: PriceStat | null;
  dietTags: DietTagStat[];
  /** 후기에 적힌 메뉴 집계. 언급이 많은 순이고, 어느 가격을 쓸지는 rules 가 고른다 */
  menu: MenuStat[];
  /** 버킷 안의 사진 경로. 없으면 null — 판정에는 쓰지 않고 화면에만 쓴다 */
  photoPath: string | null;
};

export type SearchCriteria = {
  situation: Situation;
  headcount: number;
  budgetPerPerson: number;
  maxWalkMinutes: number;
  /** 고른 식사 제약. 비어 있으면 제약 조건을 보지 않는다 */
  dietOptionIds: string[];
};

/** 하드 필터에서 걸린 이유. 통과 0곳일 때 **무엇이 걸렸는지** 보여주기 위한 것이다(§6). */
export type BlockReason = 'walk' | 'price' | 'party' | 'diet';

/** 통과했지만 근거가 비어 있는 조건. 화면에 "미확인" 으로 **계속 표시해야 한다**(§3·§6). */
export type Unconfirmed = 'party' | 'diet';

export type Verdict =
  | { kind: 'eligible'; unconfirmed: Unconfirmed[] }
  | { kind: 'blocked'; reasons: BlockReason[] }
  /** 후기가 0개라 가격·단체·제약을 판정할 수 없다. 하단 "첫 후기" 구역으로 간다(§6) */
  | { kind: 'noReviews' };

/**
 * 점수가 붙은 식당. **문장을 만들지 않는다** — 추천 근거는 숫자 그대로 보여준다(§6·§10.2).
 * `score` 는 정렬용이고 화면에 노출할 값이 아니다.
 */
export type Scored = {
  candidate: Candidate;
  unconfirmed: Unconfirmed[];
  score: number;
  /** 점수를 이룬 조각. 디버깅과 "왜 이 순서인가" 를 설명하기 위해 그대로 남긴다 */
  parts: { rating: number; recommendRatio: number; recency: number };
};

export type Recommendation = {
  /** 상단 고정. 점수 상위. 후기 0개 식당은 **절대 들어가지 않는다**(§6) */
  picks: Scored[];
  /** 통과했지만 추천픽에 들지 못한 식당. picks 와 겹치지 않는다 */
  rest: Scored[];
  /** 후기가 0개라 판정하지 못한 식당. 도보 상한은 적용된 뒤의 목록이다 */
  firstReview: Candidate[];
  /** 후기 0개 구역에서 표시 개수를 넘겨 잘린 수. 0 이면 다 보여주고 있다 */
  firstReviewTruncated: number;
  /** 하드 필터에 걸린 식당 수를 이유별로. 통과 0곳일 때 이걸 보여준다(§6) */
  blocked: { reason: BlockReason; count: number }[];
  /**
   * 도보 시간을 재지 못해 판정에서 빠진 식당 수. **조용히 사라지지 않게** 세어 둔다 —
   * 이들을 결과에 넣을지는 아직 정해지지 않았다(목업 메모의 "확인 필요").
   */
  unmeasuredWalkCount: number;
};
