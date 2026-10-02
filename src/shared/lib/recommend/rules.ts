/**
 * 추천 판정에 쓰이는 **모든 수치가 이 파일에만 있다**(§10.1 단일 기준).
 * 화면이나 쿼리에서 따로 계산하지 마세요.
 *
 * ⚠️ **아래 값은 전부 잠정이고 jhey 결정 대기 중입니다**(§10.4 — 임의 임계값 금지).
 * 로직과 테스트는 값을 **주입받게** 짜여 있어서, 정해지면 이 파일만 고치면 됩니다.
 * 코드가 돌아가야 하므로 자리를 비워 두지 않고 중립적인 자리값을 넣었고, 각 항목에
 * 그 자리값을 고른 이유를 적었습니다 — 근거가 있는 확정값이 아닙니다.
 */

/** 1인 가격을 후기들에서 어떻게 접을지. */
export type PriceAggregate = 'min' | 'max' | 'avg' | 'median';

/** 네이버 메뉴판 가격 중 예산과 견줄 값. */
export type MenuPriceAggregate =
  /** 가장 싼 메뉴. "예산 이하로 먹을 수 있는 메뉴가 하나라도 있나" */
  | 'min'
  /** 중앙값. "보통 시키면 예산을 넘나" */
  | 'median';

/** 제약 태그가 후기끼리 엇갈릴 때의 판정. */
export type DietConflictRule =
  /** 한 명이라도 "불가" 라고 했으면 위반으로 본다 */
  | 'anyUnavailableBlocks'
  /** "가능" 이 "불가" 보다 많으면 통과 */
  | 'majorityWins';

export type RecommendRules = {
  priceAggregate: PriceAggregate;
  /** 네이버 메뉴판으로 예산을 볼 때 쓸 값. 후기가 없는 식당에만 적용된다 */
  menuPriceAggregate: MenuPriceAggregate;
  dietConflict: DietConflictRule;
  /** 추천픽으로 상단에 고정할 개수 */
  pickCount: number;
  /** 이 수보다 후기가 적으면 추천픽 후보에서 뺀다 (통과 목록에는 남는다) */
  minReviewsForPick: number;
  /** 최근성 점수가 0 이 되는 기간(일). 그 안쪽은 선형으로 깎인다 */
  recencyWindowDays: number;
  /** 점수 가중치. 합이 1 이어야 한다 */
  weights: { rating: number; recommendRatio: number; recency: number };
  /** 하단 "첫 후기" 구역에 보여줄 최대 개수 */
  firstReviewLimit: number;
  /** 카드에 보여줄 대표 메뉴 줄 수 */
  menuCount: number;
};

export const PROVISIONAL_RULES: RecommendRules = {
  // ⚠️ 잠정 — 중앙값을 자리값으로 둔 이유: 한 명이 비싼 코스를 먹은 후기가 전체 판정을
  // 흔들지 않는다. 평균·최솟값·최댓값 중 무엇이 맞는지는 결정 사항이다.
  priceAggregate: 'median',

  // ⚠️ 잠정 — 'min' 은 **잘못 숨기지 않는** 쪽이다: 메뉴판에 예산 이하가 하나라도 있으면
  // 통과한다. 대신 거의 다 통과한다 — 실측해 보니 식당별 최저가가 사이드·주류·추가 메뉴인
  // 경우가 많았다("미니모밀추가 3,000" · "맥주 및 음료 10,000"). 더 조이려면 'median'.
  menuPriceAggregate: 'min',

  // ⚠️ 잠정 — 보수적인 쪽을 자리값으로 뒀다. 제약은 "못 먹는다" 가 틀렸을 때의 피해가
  // "먹을 수 있다" 가 틀렸을 때보다 크다.
  dietConflict: 'anyUnavailableBlocks',

  // ⚠️ 잠정 — 목업(§6·1c)이 3곳으로 그려져 있어 그 값을 따랐다. 1~5 범위로 설계돼 있다.
  pickCount: 3,

  // ⚠️ 잠정 — jhey 가 1 로 정했다(2026-10-02). 해커톤 초기에는 후기가 적어 2 이상이면
  // 추천픽이 계속 비어 보인다. 후기가 쌓이면 다시 볼 값이다.
  minReviewsForPick: 1,

  // ⚠️ 잠정 — "최근성" 의 기간 자체가 미정이다. 90일을 자리값으로 둔다.
  recencyWindowDays: 90,

  // ⚠️ 잠정 — 세 요소를 **동등하게** 둔 자리값이다. 어느 것이 더 중요한지는 결정 사항이라
  // 임의로 기울이지 않았다.
  weights: { rating: 1 / 3, recommendRatio: 1 / 3, recency: 1 / 3 },

  // ⚠️ 잠정 — 수집 반경 1,200m 안에 식당이 1,911곳이라 전부 늘어놓을 수 없다. 목업(1k)이
  // 5곳으로 그려져 있어 그 값을 따랐다.
  firstReviewLimit: 5,

  // ⚠️ 잠정 — 목업(1c)이 3줄로 그려져 있어 그 값을 따랐다.
  menuCount: 3,
};

/** 가중치 합이 1 에서 벗어나면 점수의 뜻이 달라진다 — 값을 고칠 때 여기서 걸린다. */
export function assertRules(rules: RecommendRules): void {
  const { rating, recommendRatio, recency } = rules.weights;
  const sum = rating + recommendRatio + recency;
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`가중치 합이 1 이 아닙니다: ${sum}`);
  }
  if (rules.pickCount < 0) throw new Error('pickCount 는 음수일 수 없습니다');
  if (rules.recencyWindowDays <= 0) {
    throw new Error('recencyWindowDays 는 0보다 커야 합니다');
  }
}
