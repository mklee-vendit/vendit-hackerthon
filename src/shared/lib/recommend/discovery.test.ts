import { describe, expect, test } from 'bun:test';
import { discoverySeed, localDateKey, seededShuffle } from './discovery';
import type { SearchCriteria } from './types';

const criteria = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({
  situation: 'lunch',
  headcount: 6,
  budgetPerPerson: 10_000,
  maxWalkMinutes: 10,
  dietOptionIds: [],
  ...over,
});

const items = Array.from({ length: 40 }, (_, i) => `r${i}`);

describe('localDateKey', () => {
  test('로컬 시각 기준 YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 9, 2, 12, 0))).toBe('2026-10-02');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('discoverySeed', () => {
  const now = new Date(2026, 9, 2, 12, 0);

  test('같은 날 같은 조건이면 같은 씨앗', () => {
    expect(discoverySeed(criteria(), now)).toBe(discoverySeed(criteria(), now));
  });

  test('날짜가 바뀌면 씨앗이 바뀐다', () => {
    const tomorrow = new Date(2026, 9, 3, 12, 0);
    expect(discoverySeed(criteria(), now)).not.toBe(
      discoverySeed(criteria(), tomorrow),
    );
  });

  test('같은 날 안에서는 시각이 달라도 같은 씨앗 — 새로고침마다 흔들리지 않는다', () => {
    expect(discoverySeed(criteria(), new Date(2026, 9, 2, 9, 0))).toBe(
      discoverySeed(criteria(), new Date(2026, 9, 2, 23, 30)),
    );
  });

  test('조건이 바뀌면 씨앗이 바뀐다', () => {
    const base = discoverySeed(criteria(), now);
    expect(discoverySeed(criteria({ headcount: 7 }), now)).not.toBe(base);
    expect(discoverySeed(criteria({ maxWalkMinutes: 15 }), now)).not.toBe(base);
    expect(discoverySeed(criteria({ situation: 'party' }), now)).not.toBe(base);
  });

  test('제약 목록은 순서에 흔들리지 않는다', () => {
    expect(discoverySeed(criteria({ dietOptionIds: ['a', 'b'] }), now)).toBe(
      discoverySeed(criteria({ dietOptionIds: ['b', 'a'] }), now),
    );
  });
});

describe('seededShuffle', () => {
  test('씨앗이 같으면 항상 같은 순서', () => {
    expect(seededShuffle(items, 'seed-1')).toEqual(
      seededShuffle(items, 'seed-1'),
    );
  });

  test('씨앗이 다르면 순서가 달라진다', () => {
    expect(seededShuffle(items, 'seed-1')).not.toEqual(
      seededShuffle(items, 'seed-2'),
    );
  });

  test('실제로 섞인다 — 원본 순서 그대로가 아니다', () => {
    expect(seededShuffle(items, '2026-10-02:lunch:6:10000:10:')).not.toEqual(
      items,
    );
  });

  test('하나도 잃거나 더하지 않는다', () => {
    const shuffled = seededShuffle(items, 'seed');
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  test('원본을 건드리지 않는다', () => {
    const original = [...items];
    seededShuffle(items, 'seed');
    expect(items).toEqual(original);
  });

  test('빈 배열과 한 개짜리도 안전하다', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['only'], 'seed')).toEqual(['only']);
  });

  test('앞자리가 특정 항목에 쏠리지 않는다', () => {
    // 씨앗을 바꿔 가며 1등을 세어 본다. 한 항목이 절반 넘게 1등이면 치우친 것이다.
    const firstCounts = new Map<string, number>();
    const rounds = 400;
    for (let i = 0; i < rounds; i += 1) {
      const first = seededShuffle(items, `day-${i}`)[0];
      firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
    }
    const most = Math.max(...firstCounts.values());
    expect(most).toBeLessThan(rounds / 4);
    // 40개 중 상당수가 1등을 해 봐야 "발굴" 이 된다.
    expect(firstCounts.size).toBeGreaterThan(items.length / 2);
  });
});
