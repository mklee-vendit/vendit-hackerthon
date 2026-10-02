import { describe, expect, test } from 'bun:test';
import { criteriaToParams, defaultCriteria, parseCriteria } from './criteria';

describe('criteriaToParams ↔ parseCriteria', () => {
  test('왕복해도 그대로다', () => {
    const criteria = {
      situation: 'party' as const,
      headcount: 24,
      budgetPerPerson: 50_000,
      maxWalkMinutes: 15,
      dietOptionIds: ['a', 'b'],
    };
    const parsed = parseCriteria(criteriaToParams(criteria));
    expect(parsed).toEqual({ ok: true, criteria });
  });

  test('제약이 없으면 diet 를 URL 에 넣지 않는다', () => {
    const params = criteriaToParams(defaultCriteria());
    expect(params.has('diet')).toBe(false);
    const parsed = parseCriteria(params);
    expect(parsed.ok && parsed.criteria.dietOptionIds).toEqual([]);
  });
});

describe('망가진 URL — 조용히 기본값으로 바꾸지 않는다', () => {
  const base = () => criteriaToParams(defaultCriteria());

  test('없는 상황 값은 거절한다', () => {
    const params = base();
    params.set('situation', 'dinner');
    const parsed = parseCriteria(params);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.issues.join()).toContain('situation');
  });

  test('목록에 없는 도보 상한은 거절한다', () => {
    const params = base();
    params.set('walk', '7');
    const parsed = parseCriteria(params);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.issues.join()).toContain('도보 상한');
  });

  test('인원이 0 이거나 음수면 거절한다', () => {
    for (const value of ['0', '-3']) {
      const params = base();
      params.set('headcount', value);
      expect(parseCriteria(params).ok).toBe(false);
    }
  });

  test('숫자가 아닌 값은 거절한다', () => {
    const params = base();
    params.set('budget', '만원');
    expect(parseCriteria(params).ok).toBe(false);
  });

  test('비어 있으면 거절한다 — 기본값으로 메우지 않는다', () => {
    const parsed = parseCriteria(new URLSearchParams());
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.issues.length).toBeGreaterThan(0);
  });

  test('예산 0 은 허용한다 — 공짜 식사를 찾는 것도 조건이다', () => {
    const params = base();
    params.set('budget', '0');
    expect(parseCriteria(params).ok).toBe(true);
  });

  test('diet 의 빈 조각과 공백은 흘리지 않는다', () => {
    const params = base();
    params.set('diet', ' a , , b ,');
    const parsed = parseCriteria(params);
    expect(parsed.ok && parsed.criteria.dietOptionIds).toEqual(['a', 'b']);
  });
});

describe('defaultCriteria', () => {
  test('상황별 1인 예산 기본값을 따른다 (§3)', () => {
    expect(defaultCriteria('lunch').budgetPerPerson).toBe(10_000);
    expect(defaultCriteria('party').budgetPerPerson).toBe(50_000);
  });
});
