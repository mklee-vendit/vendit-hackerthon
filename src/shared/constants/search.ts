export type Situation = 'lunch' | 'party';

export const SITUATION_LABEL: Record<Situation, string> = {
  lunch: '점심',
  party: '파티·회식',
};

/** docs/venparty.md §3 — 상황별 1인 예산 기본값. 검색 때 수정 가능. */
export const DEFAULT_BUDGET: Record<Situation, number> = {
  lunch: 10_000,
  party: 50_000,
};

/** 기본 10분은 §3 확정값. 나머지 단계는 목업(1b) 기준 ⚠️ 잠정. */
export const WALK_MINUTE_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_WALK_MINUTES = 10;
