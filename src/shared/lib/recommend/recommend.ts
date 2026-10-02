import { discoverySeed, seededShuffle } from './discovery';
import { judge } from './filter';
import { assertRules, type RecommendRules } from './rules';
import { scoreParts, weightedScore } from './score';
import type {
  BlockReason,
  Candidate,
  Recommendation,
  Scored,
  SearchCriteria,
} from './types';

const BLOCK_ORDER: BlockReason[] = ['walk', 'price', 'party', 'diet'];

/**
 * §6 의 전체 판정. 하드 필터 → 점수 → 세 구역.
 *
 * **통과가 0곳이면 조건을 몰래 완화하지 않는다** — `blocked` 에 걸린 이유와 수를 담아
 * 돌려주고, 화면이 "맞는 곳 없음 + 걸린 조건" 을 그린다(§6).
 *
 * `now` 를 인자로 받는 이유: 최근성 점수가 시간에 의존하면 테스트가 날짜에 따라 깨진다.
 */
export function recommend({
  candidates,
  criteria,
  rules,
  now,
}: {
  candidates: Candidate[];
  criteria: SearchCriteria;
  rules: RecommendRules;
  now: Date;
}): Recommendation {
  assertRules(rules);

  const eligible: Scored[] = [];
  const firstReviewAll: Candidate[] = [];
  const blockedCounts = new Map<BlockReason, number>();
  let unmeasuredWalkCount = 0;

  for (const candidate of candidates) {
    // 도보를 재지 못한 식당은 판정에서 빼되 **수를 센다**. 결과에 넣을지는 미정이고,
    // 조용히 사라지는 것만은 막는다(§10.5).
    if (candidate.walkSeconds === null) {
      unmeasuredWalkCount += 1;
      continue;
    }

    const verdict = judge(candidate, criteria, rules);

    if (verdict.kind === 'blocked') {
      for (const reason of verdict.reasons) {
        blockedCounts.set(reason, (blockedCounts.get(reason) ?? 0) + 1);
      }
      continue;
    }

    if (verdict.kind === 'noReviews') {
      firstReviewAll.push(candidate);
      continue;
    }

    const parts = scoreParts(candidate, now, rules);
    eligible.push({
      candidate,
      unconfirmed: verdict.unconfirmed,
      score: weightedScore(parts, rules),
      parts,
    });
  }

  // 점수 내림차순. 동점은 후기 수 → 식당 id 로 갈라 **같은 입력이면 같은 순서**가 되게 한다.
  eligible.sort(
    (a, b) =>
      b.score - a.score ||
      b.candidate.reviewCount - a.candidate.reviewCount ||
      a.candidate.restaurantId.localeCompare(b.candidate.restaurantId),
  );

  // 추천픽은 후기가 일정 수 이상인 식당에서만 고른다. 미달 식당은 통과 목록에 남는다 —
  // 조건을 만족한 사실은 바뀌지 않는다.
  const pickable = eligible.filter(
    (s) => s.candidate.reviewCount >= rules.minReviewsForPick,
  );
  const picks = pickable.slice(0, rules.pickCount);
  const pickIds = new Set(picks.map((s) => s.candidate.restaurantId));
  const rest = eligible.filter((s) => !pickIds.has(s.candidate.restaurantId));

  // 하단 "첫 후기" 구역은 **날짜와 조건을 씨앗으로 섞는다**.
  //
  // 도보순으로 고정하면 매번 같은 집만 나와 "안 가본 집을 꺼내 준다" 는 목적이 성립하지
  // 않는다(§1·§2). 여기 있는 식당은 **이미 도보 상한을 통과했으므로** 어느 것을 앞에 둬도
  // 조건을 어기지 않는다. 씨앗이 날짜라서 같은 날에는 흔들리지 않고(공유한 링크를 연 사람도
  // 같은 목록을 본다) 다음 날에는 다른 집이 앞에 온다.
  //
  // 먼저 id 로 정렬해 **입력 순서에 의존하지 않게** 한 뒤 섞는다 — DB 가 행 순서를 바꿔도
  // 같은 날 같은 조건이면 같은 결과여야 한다.
  firstReviewAll.sort((a, b) => a.restaurantId.localeCompare(b.restaurantId));
  const firstReview = seededShuffle(
    firstReviewAll,
    discoverySeed(criteria, now),
  ).slice(0, rules.firstReviewLimit);

  return {
    picks,
    rest,
    firstReview,
    firstReviewTruncated: firstReviewAll.length - firstReview.length,
    blocked: BLOCK_ORDER.filter((reason) => blockedCounts.has(reason)).map(
      (reason) => ({ reason, count: blockedCounts.get(reason) ?? 0 }),
    ),
    unmeasuredWalkCount,
  };
}
