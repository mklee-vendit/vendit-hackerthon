import { describe, expect, test } from 'bun:test';
import {
  emptyDraft,
  filledMenu,
  MENU_NAME_MAX,
  normalizedBody,
  REVIEW_BODY_MAX,
  type ReviewDraft,
  remainingChars,
  validateDraft,
} from './draft';

const valid = (over: Partial<ReviewDraft> = {}): ReviewDraft => ({
  rating: 4,
  body: '국물이 진하고 양이 많아요.',
  recommends: true,
  pricePerPerson: 9500,
  partySize: null,
  menu: [],
  photo: null,
  ...over,
});

describe('validateDraft', () => {
  test('다 채우면 통과한다', () => {
    expect(validateDraft(valid())).toEqual([]);
  });

  test('빈 초안은 필수 항목을 전부 짚는다', () => {
    expect([...validateDraft(emptyDraft())].sort()).toEqual([
      'body',
      'price',
      'rating',
      'recommends',
    ]);
  });

  test('**1인 가격은 필수다** — 없으면 가격 집계에서 빠진다(§3)', () => {
    expect(validateDraft(valid({ pricePerPerson: null }))).toEqual(['price']);
  });

  test('**추천 여부는 필수다** — 없으면 추천 비율 점수에서 빠진다(§6)', () => {
    expect(validateDraft(valid({ recommends: null }))).toEqual(['recommends']);
  });

  test('별점은 1~5 정수만', () => {
    for (const rating of [0, 6, 2.5]) {
      expect(validateDraft(valid({ rating }))).toEqual(['rating']);
    }
    for (const rating of [1, 3, 5]) {
      expect(validateDraft(valid({ rating }))).toEqual([]);
    }
  });

  test('본문은 공백만이면 비어 있는 것으로 본다', () => {
    expect(validateDraft(valid({ body: '   \n ' }))).toEqual(['body']);
  });

  test(`${REVIEW_BODY_MAX}자는 통과, 한 자 넘으면 거절`, () => {
    expect(validateDraft(valid({ body: '가'.repeat(300) }))).toEqual([]);
    expect(validateDraft(valid({ body: '가'.repeat(301) }))).toEqual([
      'bodyTooLong',
    ]);
  });

  test('자모 분리로 들어온 입력도 NFC 로 세어 DB 와 같은 판정이 된다', () => {
    // NFD 로 쓴 300자는 코드포인트로는 더 길지만 NFC 로는 300자다.
    const nfd = '가'.repeat(300).normalize('NFD');
    expect(nfd.length).toBeGreaterThan(300);
    expect(validateDraft(valid({ body: nfd }))).toEqual([]);
  });

  test('함께 간 인원은 선택이지만 적으면 1명 이상이어야 한다', () => {
    expect(validateDraft(valid({ partySize: null }))).toEqual([]);
    expect(validateDraft(valid({ partySize: 6 }))).toEqual([]);
    expect(validateDraft(valid({ partySize: 0 }))).toEqual(['partySize']);
  });

  test('가격 0 은 허용한다 — 공짜로 먹은 것도 사실이다', () => {
    expect(validateDraft(valid({ pricePerPerson: 0 }))).toEqual([]);
  });
});

describe('normalizedBody / remainingChars', () => {
  test('앞뒤 공백을 떼고 NFC 로 맞춘다', () => {
    expect(normalizedBody('  가나다  ')).toBe('가나다');
    expect(normalizedBody('가'.normalize('NFD'))).toBe('가');
  });

  test('남은 글자 수는 음수가 될 수 있다 — 넘긴 만큼 보여줘야 지울 수 있다', () => {
    expect(remainingChars('')).toBe(300);
    expect(remainingChars('가'.repeat(305))).toBe(-5);
  });
});

describe('메뉴', () => {
  test('안 적어도 된다 — 선택이다', () => {
    expect(validateDraft(valid({ menu: [] }))).toEqual([]);
  });

  test('이름이 빈 줄은 안 적은 것으로 보고 저장하지 않는다', () => {
    expect(filledMenu([{ name: '  ', price: null }])).toEqual([]);
    expect(validateDraft(valid({ menu: [{ name: '', price: null }] }))).toEqual(
      [],
    );
  });

  test('이름을 적었으면 가격도 받는다 — 카드에 "메뉴 —원" 이 남지 않게', () => {
    expect(
      validateDraft(valid({ menu: [{ name: '버섯솥밥', price: null }] })),
    ).toEqual(['menuPrice']);
    expect(
      validateDraft(valid({ menu: [{ name: '버섯솥밥', price: 9000 }] })),
    ).toEqual([]);
  });

  test(`이름은 ${MENU_NAME_MAX}자까지`, () => {
    expect(
      validateDraft(
        valid({
          menu: [{ name: '가'.repeat(MENU_NAME_MAX + 1), price: 1000 }],
        }),
      ),
    ).toEqual(['menuName']);
  });

  test('가격 0 은 허용한다 — 서비스로 받은 것도 사실이다', () => {
    expect(
      validateDraft(valid({ menu: [{ name: '누룽지', price: 0 }] })),
    ).toEqual([]);
  });
});
