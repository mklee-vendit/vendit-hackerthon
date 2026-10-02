import { describe, expect, test } from 'bun:test';
import {
  type Candidate,
  PROVISIONAL_RULES,
  recommend,
  type SearchCriteria,
} from '@/shared/lib/recommend';
import {
  toRecommendRate,
  toResultsViewModel,
  toWalkMinutes,
} from './mapRecommendation';

const NOW = new Date('2026-10-02T12:00:00Z');

let seq = 0;
const candidate = (over: Partial<Candidate> = {}): Candidate => {
  seq += 1;
  return {
    restaurantId: `r${seq}`,
    name: `식당${seq}`,
    category: '한식',
    walkSeconds: 300,
    reviewCount: 4,
    recommendCount: 3,
    avgRating: 4.5,
    partySizeMax: 10,
    latestReviewAt: new Date('2026-10-01T00:00:00Z'),
    prices: { min: 8000, max: 12000, avg: 10000, median: 9000 },
    dietTags: [],
    menu: [],
    photoPath: null,
    lon: 127.03,
    lat: 37.5,
    ...over,
  };
};

const criteria: SearchCriteria = {
  situation: 'lunch',
  headcount: 4,
  budgetPerPerson: 10_000,
  maxWalkMinutes: 10,
  dietOptionIds: [],
};

const view = (candidates: Candidate[], over: Partial<SearchCriteria> = {}) =>
  toResultsViewModel({
    recommendation: recommend({
      candidates,
      criteria: { ...criteria, ...over },
      rules: PROVISIONAL_RULES,
      now: NOW,
    }),
    criteria: { ...criteria, ...over },
    rules: PROVISIONAL_RULES,
    latestReviews: new Map(),
  });

describe('toWalkMinutes', () => {
  test('올림한다 — 11분을 10분으로 보여주면 상한이 거짓말이 된다', () => {
    expect(toWalkMinutes(601)).toBe(11);
    expect(toWalkMinutes(600)).toBe(10);
    expect(toWalkMinutes(541)).toBe(10);
  });

  test('1분 미만도 1분으로 — 0분은 걸어가지 않았다는 뜻이 된다', () => {
    expect(toWalkMinutes(34)).toBe(1);
    expect(toWalkMinutes(1)).toBe(1);
  });

  test('재지 못했으면 null 이다. 0 으로 메우지 않는다', () => {
    expect(toWalkMinutes(null)).toBeNull();
  });
});

describe('toRecommendRate', () => {
  test('후기가 없으면 null — 0% 는 "아무도 추천 안 함" 이라는 뜻이 된다', () => {
    expect(toRecommendRate(0, 0)).toBeNull();
  });

  test('비율을 퍼센트로 반올림한다', () => {
    expect(toRecommendRate(3, 4)).toBe(75);
    expect(toRecommendRate(1, 3)).toBe(33);
  });
});

describe('toResultsViewModel', () => {
  test('추천픽이 앞에 오고 순위는 1부터 이어진다', () => {
    const vm = view([
      candidate({ avgRating: 3 }),
      candidate({ avgRating: 5 }),
      candidate({ avgRating: 4 }),
    ]);
    expect(vm.restaurants.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(vm.restaurants[0].avgStar).toBe(5);
    expect(vm.pickCount).toBe(3);
  });

  test('1인 가격은 rules 가 고른 집계값이다', () => {
    const vm = view([candidate()]);
    // PROVISIONAL_RULES.priceAggregate === 'median'
    expect(vm.restaurants[0].pricePerPerson).toBe(9000);
  });

  test('사진·대표 메뉴는 소스가 없어 비워 둔다 — 지어내지 않는다', () => {
    const vm = view([candidate()]);
    expect(vm.restaurants[0].menu).toEqual([]);
    expect(vm.restaurants[0].photoUrl).toBeUndefined();
  });

  test('미확인 조건이 사람이 읽는 말로 붙는다', () => {
    const vm = view([candidate({ partySizeMax: null })], {
      situation: 'party',
      headcount: 20,
      budgetPerPerson: 50_000,
    });
    expect(vm.restaurants[0].unconfirmed).toEqual(['단체석 미확인']);
  });

  test('후기 0개 식당은 카드가 아니라 "첫 후기" 구역으로 간다', () => {
    const noReview = candidate({
      reviewCount: 0,
      recommendCount: 0,
      avgRating: null,
      partySizeMax: null,
      latestReviewAt: null,
      prices: null,
      walkSeconds: 120,
    });
    const vm = view([noReview]);
    expect(vm.restaurants).toHaveLength(0);
    expect(vm.firstReview).toEqual([
      {
        id: noReview.restaurantId,
        name: noReview.name,
        category: '한식',
        walkMinutes: 2,
      },
    ]);
  });

  test('후기 0개 식당도 **같은 식권 카드**로 그릴 수 있게 나온다', () => {
    const noReview = candidate({
      reviewCount: 0,
      recommendCount: 0,
      avgRating: null,
      partySizeMax: null,
      latestReviewAt: null,
      prices: null,
      walkSeconds: 240,
    });
    const [card] = view([noReview]).firstReviewCards;
    expect(card.name).toBe(noReview.name);
    expect(card.walkMinutes).toBe(4);
    // 0 으로 채우면 ★0.0 · 0% 가 되어 "나쁜 식당" 이라는 다른 뜻이 된다.
    expect(card.avgStar).toBeNull();
    expect(card.recommendRate).toBeNull();
    expect(card.pricePerPerson).toBeNull();
    expect(card.reviewCount).toBe(0);
    expect(card.latestReview).toBeNull();
  });

  test('걸린 조건이 사람이 읽는 말로 온다 (통과 0곳일 때 쓴다)', () => {
    const vm = view([candidate({ walkSeconds: 40 * 60 })]);
    expect(vm.restaurants).toHaveLength(0);
    expect(vm.blocked).toEqual([{ label: '도보 시간', count: 1 }]);
  });

  test('도보를 재지 못한 수가 그대로 넘어온다 — 화면에서 알려야 한다', () => {
    const vm = view([candidate({ walkSeconds: null }), candidate()]);
    expect(vm.unmeasuredWalkCount).toBe(1);
  });

  test('조건 바에 쓸 값이 그대로 옮겨진다', () => {
    const vm = view([], {
      situation: 'party',
      headcount: 24,
      budgetPerPerson: 50_000,
    });
    expect(vm.conditions).toEqual({
      situationLabel: '파티·회식',
      headcount: 24,
      budget: 50_000,
      walkMinutes: 10,
    });
  });
});
