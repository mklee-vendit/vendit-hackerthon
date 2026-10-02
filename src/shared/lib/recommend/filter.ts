import type { PriceAggregate, RecommendRules } from './rules';
import type {
  BlockReason,
  Candidate,
  SearchCriteria,
  Unconfirmed,
  Verdict,
} from './types';

export function priceFor(
  candidate: Candidate,
  aggregate: PriceAggregate,
): number | null {
  return candidate.prices?.[aggregate] ?? null;
}

/**
 * 이 식당이 제약 하나를 위반하는가.
 *   - 태그가 아예 없으면 **미확인** → 위반이 아니다(§6: 조건 통과 + "미확인" 표시)
 *   - 엇갈릴 때의 규칙은 아직 미정이라 `rules.dietConflict` 가 고른다(§13)
 */
function violatesDiet(
  candidate: Candidate,
  dietOptionId: string,
  rules: RecommendRules,
): { violates: boolean; unconfirmed: boolean } {
  const stat = candidate.dietTags.find((t) => t.dietOptionId === dietOptionId);
  if (!stat || stat.availableCount + stat.unavailableCount === 0) {
    return { violates: false, unconfirmed: true };
  }

  const violates =
    rules.dietConflict === 'anyUnavailableBlocks'
      ? stat.unavailableCount > 0
      : stat.unavailableCount > stat.availableCount;

  return { violates, unconfirmed: false };
}

/**
 * §6 의 하드 필터. **조건을 몰래 완화하지 않는다** — 걸리면 걸린 이유를 돌려주고,
 * 근거가 비어 있으면 통과시키되 "미확인" 으로 표시하게 남긴다.
 *
 * 도보 시간은 후기 유무와 무관하게 적용한다(측정값이 전 식당에 있다). 가격·단체·제약은
 * 후기 집계라서 후기가 0개면 판정 자체가 불가능하다 → `noReviews`.
 */
export function judge(
  candidate: Candidate,
  criteria: SearchCriteria,
  rules: RecommendRules,
): Verdict {
  const reasons: BlockReason[] = [];

  // 도보 — 재지 못한 식당(null)은 여기서 통과도 탈락도 하지 않는다. 호출부가 따로 센다.
  if (
    candidate.walkSeconds !== null &&
    candidate.walkSeconds > criteria.maxWalkMinutes * 60
  ) {
    reasons.push('walk');
  }

  if (candidate.reviewCount === 0) {
    // 도보가 걸렸으면 하단 구역에도 올리지 않는다 — 조건을 벗어난 식당이다.
    return reasons.length > 0
      ? { kind: 'blocked', reasons }
      : { kind: 'noReviews' };
  }

  const unconfirmed: Unconfirmed[] = [];

  const price = priceFor(candidate, rules.priceAggregate);
  // 후기가 있으면 1인 가격은 필수라 항상 있다(§3). 없으면 데이터가 어긋난 것이므로
  // 통과시키지 않는다 — 모르는 것을 "싸다" 로 둥글리면 안 된다.
  if (price === null || price > criteria.budgetPerPerson) {
    reasons.push('price');
  }

  if (criteria.situation === 'party') {
    if (candidate.partySizeMax === null) {
      unconfirmed.push('party');
    } else if (candidate.partySizeMax < criteria.headcount) {
      reasons.push('party');
    }
  }

  let dietUnconfirmed = false;
  let dietViolated = false;
  for (const dietOptionId of criteria.dietOptionIds) {
    const result = violatesDiet(candidate, dietOptionId, rules);
    if (result.violates) dietViolated = true;
    if (result.unconfirmed) dietUnconfirmed = true;
  }
  if (dietViolated) reasons.push('diet');
  else if (dietUnconfirmed) unconfirmed.push('diet');

  return reasons.length > 0
    ? { kind: 'blocked', reasons }
    : { kind: 'eligible', unconfirmed };
}
