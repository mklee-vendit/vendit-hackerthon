import { describe, expect, test } from 'bun:test';
import { judge } from './filter';
import { recommend } from './recommend';
import { PROVISIONAL_RULES, type RecommendRules } from './rules';
import type { Candidate, SearchCriteria } from './types';

const NOW = new Date('2026-10-02T12:00:00Z');

const rules = (over: Partial<RecommendRules> = {}): RecommendRules => ({
  ...PROVISIONAL_RULES,
  ...over,
});

let seq = 0;
/** 조건을 전부 만족하는 기본 식당. 테스트마다 한 군데씩만 어긋나게 만든다. */
const candidate = (over: Partial<Candidate> = {}): Candidate => {
  seq += 1;
  return {
    restaurantId: `r${String(seq).padStart(3, '0')}`,
    name: `식당${seq}`,
    category: '한식',
    walkSeconds: 300,
    reviewCount: 4,
    recommendCount: 4,
    avgRating: 4.5,
    partySizeMax: 10,
    latestReviewAt: new Date('2026-10-01T12:00:00Z'),
    prices: { min: 8000, max: 12000, avg: 10000, median: 9000 },
    dietTags: [],
    menu: [],
    photoPath: null,
    lon: 127.03,
    lat: 37.5,
    naverPlaceId: null,
    naverPrices: null,
    naverPhotoUrl: null,
    naverMenu: [],
    ...over,
  };
};

const lunch = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({
  situation: 'lunch',
  headcount: 4,
  budgetPerPerson: 10_000,
  maxWalkMinutes: 10,
  dietOptionIds: [],
  ...over,
});

describe('하드 필터 — 걸린 이유를 돌려준다', () => {
  test('도보 상한을 넘으면 walk', () => {
    const v = judge(
      candidate({ walkSeconds: 11 * 60 }),
      lunch({ maxWalkMinutes: 10 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'blocked', reasons: ['walk'] });
  });

  test('상한과 같으면 통과한다 (≤ 경계)', () => {
    const v = judge(
      candidate({ walkSeconds: 10 * 60 }),
      lunch({ maxWalkMinutes: 10 }),
      rules(),
    );
    expect(v.kind).toBe('eligible');
  });

  test('1인 가격이 예산을 넘으면 price — 집계 방식은 rules 가 고른다', () => {
    const c = candidate({
      prices: { min: 8000, max: 30_000, avg: 19_000, median: 9000 },
    });
    // 중앙값으로 보면 통과, 최댓값으로 보면 탈락 — 같은 식당이 규칙에 따라 갈린다.
    expect(judge(c, lunch(), rules({ priceAggregate: 'median' })).kind).toBe(
      'eligible',
    );
    expect(judge(c, lunch(), rules({ priceAggregate: 'max' }))).toEqual({
      kind: 'blocked',
      reasons: ['price'],
    });
  });

  test('후기가 있는데 가격이 없으면 통과시키지 않는다 — 모르는 값을 싸다고 둥글리지 않는다', () => {
    const v = judge(candidate({ prices: null }), lunch(), rules());
    expect(v).toEqual({ kind: 'blocked', reasons: ['price'] });
  });

  test('여러 조건이 걸리면 이유를 다 담는다', () => {
    const v = judge(
      candidate({ walkSeconds: 20 * 60, prices: null }),
      lunch(),
      rules(),
    );
    expect(v.kind).toBe('blocked');
    expect(v.kind === 'blocked' && v.reasons).toEqual(['walk', 'price']);
  });
});

describe('단체 수용 — 파티에서만 본다', () => {
  test('인원보다 작으면 party 로 걸린다', () => {
    const v = judge(
      candidate({ partySizeMax: 6 }),
      lunch({ situation: 'party', headcount: 20, budgetPerPerson: 50_000 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'blocked', reasons: ['party'] });
  });

  test('점심에는 단체 조건을 보지 않는다', () => {
    const v = judge(
      candidate({ partySizeMax: 2 }),
      lunch({ headcount: 20 }),
      rules(),
    );
    expect(v.kind).toBe('eligible');
  });

  test('아무도 안 적었으면 **통과시키고 미확인으로 표시한다**(§6)', () => {
    const v = judge(
      candidate({ partySizeMax: null }),
      lunch({ situation: 'party', headcount: 20, budgetPerPerson: 50_000 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'eligible', unconfirmed: ['party'] });
  });
});

describe('식사 제약', () => {
  const vegan = 'opt-vegan';

  test('태그가 없으면 통과 + 미확인', () => {
    const v = judge(candidate(), lunch({ dietOptionIds: [vegan] }), rules());
    expect(v).toEqual({ kind: 'eligible', unconfirmed: ['diet'] });
  });

  test('가능하다는 후기가 있으면 미확인이 아니다', () => {
    const v = judge(
      candidate({
        dietTags: [
          { dietOptionId: vegan, availableCount: 2, unavailableCount: 0 },
        ],
      }),
      lunch({ dietOptionIds: [vegan] }),
      rules(),
    );
    expect(v).toEqual({ kind: 'eligible', unconfirmed: [] });
  });

  test('엇갈릴 때의 판정은 rules 가 고른다 — 아직 미정이라 둘 다 동작해야 한다', () => {
    const c = candidate({
      dietTags: [
        { dietOptionId: vegan, availableCount: 3, unavailableCount: 1 },
      ],
    });
    const criteria = lunch({ dietOptionIds: [vegan] });
    expect(
      judge(c, criteria, rules({ dietConflict: 'anyUnavailableBlocks' })),
    ).toEqual({ kind: 'blocked', reasons: ['diet'] });
    expect(
      judge(c, criteria, rules({ dietConflict: 'majorityWins' })).kind,
    ).toBe('eligible');
  });

  test('고른 제약이 없으면 제약 조건을 아예 보지 않는다', () => {
    const v = judge(
      candidate({
        dietTags: [
          { dietOptionId: vegan, availableCount: 0, unavailableCount: 5 },
        ],
      }),
      lunch({ dietOptionIds: [] }),
      rules(),
    );
    expect(v).toEqual({ kind: 'eligible', unconfirmed: [] });
  });
});

describe('후기 0개 식당', () => {
  // 사진·메뉴판이 있어야 하단 구역에 오른다(아래 describe 참고). 발굴 목록의 다른 성질을
  // 보는 테스트들이므로 기본값으로 둘을 채워 둔다.
  const noReview = (over: Partial<Candidate> = {}) =>
    candidate({
      reviewCount: 0,
      recommendCount: 0,
      avgRating: null,
      partySizeMax: null,
      latestReviewAt: null,
      prices: null,
      naverPhotoUrl: 'https://pstatic.net/a.jpg',
      naverMenu: [{ name: '메뉴', price: 9000 }],
      ...over,
    });

  test('가격·단체·제약을 판정하지 않고 noReviews 로 보낸다', () => {
    expect(judge(noReview(), lunch(), rules()).kind).toBe('noReviews');
  });

  test('도보 상한을 넘으면 하단 구역에도 올리지 않는다', () => {
    const v = judge(noReview(), lunch({ maxWalkMinutes: 1 }), rules());
    expect(v).toEqual({ kind: 'blocked', reasons: ['walk'] });
  });

  test('**추천픽에 절대 들어가지 않는다**(§6)', () => {
    const result = recommend({
      candidates: [noReview(), noReview(), noReview()],
      criteria: lunch(),
      rules: rules(),
      now: NOW,
    });
    expect(result.picks).toHaveLength(0);
    expect(result.rest).toHaveLength(0);
    expect(result.firstReview).toHaveLength(3);
  });

  test('상한만큼만 보여주고 자른 수를 알려준다', () => {
    const result = recommend({
      candidates: [noReview(), noReview(), noReview()].map((c, i) => ({
        ...c,
        restaurantId: `n${i}`,
      })),
      criteria: lunch(),
      rules: rules({ firstReviewLimit: 2 }),
      now: NOW,
    });
    expect(result.firstReview).toHaveLength(2);
    expect(result.firstReviewTruncated).toBe(1);
  });

  test('**매번 같은 집만 나오지 않게 섞는다** — 안 가본 집을 꺼내는 게 목적이다(§1·§2)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...noReview(),
      restaurantId: `n${String(i).padStart(2, '0')}`,
    }));
    const pick = (now: Date) =>
      recommend({
        candidates: many,
        criteria: lunch(),
        rules: rules({ firstReviewLimit: 5 }),
        now,
      }).firstReview.map((c) => c.restaurantId);

    // id 순으로 고정돼 있으면 발굴이 안 된다.
    expect(pick(NOW)).not.toEqual(many.slice(0, 5).map((c) => c.restaurantId));
    // 다음 날에는 다른 집이 앞에 온다.
    expect(pick(NOW)).not.toEqual(pick(new Date('2026-10-03T12:00:00Z')));
  });

  test('같은 날 같은 조건이면 흔들리지 않는다 — 공유한 링크를 연 사람도 같은 목록을 본다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...noReview(),
      restaurantId: `n${String(i).padStart(2, '0')}`,
    }));
    const pick = (now: Date) =>
      recommend({
        candidates: [...many].reverse(),
        criteria: lunch(),
        rules: rules({ firstReviewLimit: 5 }),
        now,
      }).firstReview.map((c) => c.restaurantId);

    // 시각이 달라도, 입력 순서가 달라도 같은 날이면 같은 결과다.
    expect(pick(new Date('2026-10-02T09:00:00'))).toEqual(
      pick(new Date('2026-10-02T23:30:00')),
    );
  });

  test('조건이 바뀌면 발굴 목록도 바뀐다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...noReview(),
      restaurantId: `n${String(i).padStart(2, '0')}`,
    }));
    const pick = (headcount: number) =>
      recommend({
        candidates: many,
        criteria: lunch({ headcount }),
        rules: rules({ firstReviewLimit: 5 }),
        now: NOW,
      }).firstReview.map((c) => c.restaurantId);
    expect(pick(4)).not.toEqual(pick(8));
  });
});

describe('발굴 목록은 보여 줄 것이 있는 식당만', () => {
  const noReview = (over: Partial<Candidate> = {}) =>
    candidate({
      reviewCount: 0,
      recommendCount: 0,
      avgRating: null,
      partySizeMax: null,
      latestReviewAt: null,
      prices: null,
      naverPhotoUrl: 'https://pstatic.net/a.jpg',
      naverMenu: [{ name: '메뉴', price: 9000 }],
      ...over,
    });

  const run = (candidates: Candidate[]) =>
    recommend({ candidates, criteria: lunch(), rules: rules(), now: NOW });

  test('사진과 메뉴판이 다 있으면 올라간다', () => {
    expect(run([noReview()]).firstReview).toHaveLength(1);
  });

  test('사진이 없으면 빠진다', () => {
    const result = run([noReview({ naverPhotoUrl: null })]);
    expect(result.firstReview).toEqual([]);
    expect(result.firstReviewNoInfo).toBe(1);
  });

  test('메뉴판이 없으면 빠진다', () => {
    const result = run([noReview({ naverMenu: [] })]);
    expect(result.firstReview).toEqual([]);
    expect(result.firstReviewNoInfo).toBe(1);
  });

  // 조건에 걸린 것과 **다른 이유**다 — blocked 에 섞으면 "걸린 조건" 화면이 거짓말을 한다.
  test('정보가 없어 빠진 것은 blocked 에 들어가지 않는다', () => {
    const result = run([noReview({ naverPhotoUrl: null, naverMenu: [] })]);
    expect(result.blocked).toEqual([]);
    expect(result.firstReviewNoInfo).toBe(1);
  });

  test('후기가 있는 식당에는 적용되지 않는다 — 사진·메뉴판이 없어도 통과한다', () => {
    const result = run([candidate({ naverPhotoUrl: null, naverMenu: [] })]);
    expect(result.picks).toHaveLength(1);
    expect(result.firstReviewNoInfo).toBe(0);
  });
});

describe('네이버 메뉴판 기준 예산 — 후기가 없어도 본다', () => {
  const noReview = (over: Partial<Candidate> = {}) =>
    candidate({
      reviewCount: 0,
      recommendCount: 0,
      avgRating: null,
      partySizeMax: null,
      latestReviewAt: null,
      prices: null,
      ...over,
    });

  test('예산 이하 메뉴가 **하나도 없으면** 하단 구역에도 올리지 않는다', () => {
    const v = judge(
      noReview({ naverPrices: { min: 15_000, median: 22_000, count: 20 } }),
      lunch({ budgetPerPerson: 10_000 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'blocked', reasons: ['price'] });
  });

  // 기본값이 median 인 이유가 여기 있다: 싼 메뉴 한 줄로 비싼 집이 통과하면 안 된다.
  test('싼 메뉴가 하나 있어도 보통 시켜 예산을 넘으면 걸린다 (median)', () => {
    const v = judge(
      noReview({ naverPrices: { min: 9000, median: 22_000, count: 20 } }),
      lunch({ budgetPerPerson: 10_000 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'blocked', reasons: ['price'] });
  });

  test('min 으로 바꾸면 느슨해진다 — 예산 이하 메뉴가 하나라도 있으면 통과', () => {
    const v = judge(
      noReview({ naverPrices: { min: 9000, median: 22_000, count: 20 } }),
      lunch({ budgetPerPerson: 10_000 }),
      rules({ menuPriceAggregate: 'min' }),
    );
    expect(v.kind).toBe('noReviews');
  });

  // 메뉴판을 아직 못 긁은 식당이 **조용히 사라지면 안 된다**. 모르는 것은 판정하지 않는다.
  test('메뉴판이 없으면 예산으로 거르지 않는다', () => {
    expect(judge(noReview({ naverPrices: null }), lunch(), rules()).kind).toBe(
      'noReviews',
    );
  });

  test('예산과 같으면 통과한다 (≤ 경계)', () => {
    const v = judge(
      noReview({ naverPrices: { min: 10_000, median: 10_000, count: 3 } }),
      lunch({ budgetPerPerson: 10_000 }),
      rules(),
    );
    expect(v.kind).toBe('noReviews');
  });

  // 메뉴판과 후기가 둘 다 걸려도 "1인 예산" 은 **한 번만** 세어야 한다. 두 번 세면
  // "맞는 곳 없음" 화면의 숫자가 식당 수보다 커진다.
  test('후기와 메뉴판이 둘 다 예산을 넘겨도 price 는 한 번만', () => {
    const v = judge(
      candidate({
        prices: { min: 20_000, max: 30_000, avg: 25_000, median: 25_000 },
        naverPrices: { min: 18_000, median: 24_000, count: 10 },
      }),
      lunch({ budgetPerPerson: 10_000 }),
      rules(),
    );
    expect(v).toEqual({ kind: 'blocked', reasons: ['price'] });
  });

  test('걸린 식당은 recommend 의 blocked 집계에 1곳으로 들어간다', () => {
    const result = recommend({
      candidates: [
        noReview({ naverPrices: { min: 15_000, median: 20_000, count: 5 } }),
      ],
      criteria: lunch({ budgetPerPerson: 10_000 }),
      rules: rules(),
      now: NOW,
    });
    expect(result.firstReview).toEqual([]);
    expect(result.blocked).toEqual([{ reason: 'price', count: 1 }]);
  });
});

describe('추천픽', () => {
  test('최소 후기 수에 미달하면 추천픽에서 빠지지만 통과 목록에는 남는다', () => {
    const thin = candidate({ reviewCount: 1, recommendCount: 1 });
    const result = recommend({
      candidates: [thin],
      criteria: lunch(),
      rules: rules({ minReviewsForPick: 2 }),
      now: NOW,
    });
    expect(result.picks).toHaveLength(0);
    expect(result.rest.map((s) => s.candidate.restaurantId)).toEqual([
      thin.restaurantId,
    ]);
  });

  test('pickCount 만큼만 고르고 나머지는 rest 로 — 겹치지 않는다', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      candidate({ avgRating: 5 - i * 0.1 }),
    );
    const result = recommend({
      candidates: many,
      criteria: lunch(),
      rules: rules({ pickCount: 3 }),
      now: NOW,
    });
    expect(result.picks).toHaveLength(3);
    expect(result.rest).toHaveLength(3);
    const ids = new Set([
      ...result.picks.map((s) => s.candidate.restaurantId),
      ...result.rest.map((s) => s.candidate.restaurantId),
    ]);
    expect(ids.size).toBe(6);
  });

  test('별점이 높고 추천 비율이 높고 최근일수록 앞에 온다', () => {
    const best = candidate({
      restaurantId: 'best',
      avgRating: 5,
      recommendCount: 4,
      latestReviewAt: NOW,
    });
    const worst = candidate({
      restaurantId: 'worst',
      avgRating: 2,
      recommendCount: 1,
      latestReviewAt: new Date('2026-07-01T00:00:00Z'),
    });
    const result = recommend({
      candidates: [worst, best],
      criteria: lunch(),
      rules: rules(),
      now: NOW,
    });
    expect(result.picks[0].candidate.restaurantId).toBe('best');
  });

  test('같은 입력이면 같은 순서다 — 동점도 흔들리지 않는다', () => {
    const twins = [
      candidate({ restaurantId: 'bbb' }),
      candidate({ restaurantId: 'aaa' }),
      candidate({ restaurantId: 'ccc' }),
    ];
    const run = () =>
      recommend({
        candidates: [...twins],
        criteria: lunch(),
        rules: rules({ pickCount: 3 }),
        now: NOW,
      }).picks.map((s) => s.candidate.restaurantId);
    expect(run()).toEqual(['aaa', 'bbb', 'ccc']);
    expect(run()).toEqual(run());
  });

  test('미확인 표시는 추천픽에서도 유지된다(§6)', () => {
    const result = recommend({
      candidates: [candidate({ partySizeMax: null })],
      criteria: lunch({
        situation: 'party',
        headcount: 20,
        budgetPerPerson: 50_000,
      }),
      rules: rules(),
      now: NOW,
    });
    expect(result.picks[0].unconfirmed).toEqual(['party']);
  });
});

describe('통과 0곳', () => {
  test('조건을 완화하지 않고 **걸린 이유와 수**를 돌려준다(§6)', () => {
    const result = recommend({
      candidates: [
        candidate({ walkSeconds: 30 * 60 }),
        candidate({ walkSeconds: 40 * 60 }),
        candidate({
          prices: { min: 50_000, max: 50_000, avg: 50_000, median: 50_000 },
        }),
      ],
      criteria: lunch(),
      rules: rules(),
      now: NOW,
    });
    expect(result.picks).toHaveLength(0);
    expect(result.rest).toHaveLength(0);
    expect(result.firstReview).toHaveLength(0);
    expect(result.blocked).toEqual([
      { reason: 'walk', count: 2 },
      { reason: 'price', count: 1 },
    ]);
  });
});

describe('도보 시간을 재지 못한 식당', () => {
  test('판정에서 빠지지만 **수가 드러난다** — 조용히 사라지지 않는다', () => {
    const result = recommend({
      candidates: [candidate({ walkSeconds: null }), candidate()],
      criteria: lunch(),
      rules: rules(),
      now: NOW,
    });
    expect(result.unmeasuredWalkCount).toBe(1);
    expect(result.picks.length + result.rest.length).toBe(1);
  });
});

describe('rules 검증', () => {
  test('가중치 합이 1 이 아니면 던진다 — 점수의 뜻이 달라진다', () => {
    expect(() =>
      recommend({
        candidates: [],
        criteria: lunch(),
        rules: rules({ weights: { rating: 1, recommendRatio: 1, recency: 1 } }),
        now: NOW,
      }),
    ).toThrow(/가중치/);
  });

  test('잠정 기본값은 그 자체로 유효하다', () => {
    expect(() =>
      recommend({
        candidates: [candidate()],
        criteria: lunch(),
        rules: PROVISIONAL_RULES,
        now: NOW,
      }),
    ).not.toThrow();
  });
});
