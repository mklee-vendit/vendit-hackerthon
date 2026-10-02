import type {
  MenuPriceAggregate,
  PriceAggregate,
  RecommendRules,
} from './rules';
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

/** 네이버 메뉴판 쪽 가격. **후기의 `priceFor` 와 출처가 다르다**(§8) — 섞어 쓰지 않는다. */
export function menuPriceFor(
  candidate: Candidate,
  aggregate: MenuPriceAggregate,
): number | null {
  return candidate.naverPrices?.[aggregate] ?? null;
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
 * 도보 시간은 후기 유무와 무관하게 적용한다(측정값이 전 식당에 있다). 단체·제약은 후기
 * 집계라서 후기가 0개면 판정 자체가 불가능하다 → `noReviews`.
 *
 * 예산은 **두 출처를 순서대로** 본다. 네이버 메뉴판은 후기 유무와 무관하게 "예산 이하 메뉴가
 * 아예 없는" 집을 걸러내고, 후기가 있으면 그 위에 후기 1인 가격(§8 단일 기준)이 판정한다.
 */
export function judge(
  candidate: Candidate,
  criteria: SearchCriteria,
  rules: RecommendRules,
): Verdict {
  const reasons: BlockReason[] = [];
  // 같은 이유를 두 번 세지 않는다 — 메뉴판과 후기가 둘 다 예산에서 걸릴 수 있다.
  const block = (reason: BlockReason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  // 도보 — 재지 못한 식당(null)은 여기서 통과도 탈락도 하지 않는다. 호출부가 따로 센다.
  if (
    candidate.walkSeconds !== null &&
    candidate.walkSeconds > criteria.maxWalkMinutes * 60
  ) {
    block('walk');
  }

  // 메뉴판 기준 예산 판정. **후기 유무와 무관하게** 본다 — 후기가 쌓이기 전에도 "예산 안에서
  // 먹을 수 있는 메뉴가 하나도 없는" 집은 보여 줄 이유가 없다. 메뉴판이 없는 식당은 null 이고
  // 그때는 판정하지 않는다(모르는 것을 "비싸다" 로도 "싸다" 로도 바꾸지 않는다 — §10.2).
  const menuPrice = menuPriceFor(candidate, rules.menuPriceAggregate);
  if (menuPrice !== null && menuPrice > criteria.budgetPerPerson) {
    block('price');
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
    block('price');
  }

  if (criteria.situation === 'party') {
    if (candidate.partySizeMax === null) {
      unconfirmed.push('party');
    } else if (candidate.partySizeMax < criteria.headcount) {
      block('party');
    }
  }

  let dietUnconfirmed = false;
  let dietViolated = false;
  for (const dietOptionId of criteria.dietOptionIds) {
    const result = violatesDiet(candidate, dietOptionId, rules);
    if (result.violates) dietViolated = true;
    if (result.unconfirmed) dietUnconfirmed = true;
  }
  if (dietViolated) block('diet');
  else if (dietUnconfirmed) unconfirmed.push('diet');

  return reasons.length > 0
    ? { kind: 'blocked', reasons }
    : { kind: 'eligible', unconfirmed };
}
