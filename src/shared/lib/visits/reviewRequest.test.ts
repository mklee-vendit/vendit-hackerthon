import { describe, expect, test } from 'bun:test';
import { emptyDraft } from '@/shared/lib/reviews/draft';
import {
  canSubmitQuickReview,
  kstDate,
  type PendingReviewRequest,
  pickReviewRequest,
  QUICK_BODY_MAX,
  visitLabel,
} from './reviewRequest';

const row = (
  id: string,
  created_at: string,
  visited_on = '2026-10-01',
): PendingReviewRequest => ({
  id,
  restaurant_id: `r-${id}`,
  restaurant_name: `식당 ${id}`,
  visited_on,
  created_at,
});

describe('kstDate', () => {
  test('UTC 15시는 KST 다음 날 0시다', () => {
    expect(kstDate(new Date('2026-10-01T14:59:59Z'))).toBe('2026-10-01');
    expect(kstDate(new Date('2026-10-01T15:00:00Z'))).toBe('2026-10-02');
  });
});

describe('pickReviewRequest', () => {
  const OPENED = new Date('2026-10-02T04:00:00Z');

  test('없으면 null', () => {
    expect(pickReviewRequest([], OPENED)).toBeNull();
  });

  test('가장 최근에 누른 것 하나', () => {
    const picked = pickReviewRequest(
      [
        row('a', '2026-10-01T03:00:00Z'),
        row('b', '2026-10-02T03:00:00Z'),
        row('c', '2026-10-01T09:00:00Z'),
      ],
      OPENED,
    );
    expect(picked?.id).toBe('b');
  });

  // 길찾기를 누른 그 자리에서 토스트가 뜨면 안 된다 — 다음에 앱을 열 때 묻는다.
  test('앱을 연 뒤에 누른 방문은 묻지 않는다', () => {
    expect(
      pickReviewRequest([row('a', '2026-10-02T05:00:00Z')], OPENED),
    ).toBeNull();
  });

  test('연 시각 이전 것만 골라낸다', () => {
    const picked = pickReviewRequest(
      [row('old', '2026-10-02T03:00:00Z'), row('new', '2026-10-02T06:00:00Z')],
      OPENED,
    );
    expect(picked?.id).toBe('old');
  });

  // PostgREST 는 `+00:00`, toISOString 은 `Z` 로 끝난다. 문자열로 견주면 '+' < 'Z' 라서
  // 1분 전에 누른 방문도 "앱을 연 뒤" 로 잘못 읽힌다.
  test('시간대 표기가 달라도 같은 기준으로 견준다', () => {
    const picked = pickReviewRequest(
      [row('a', '2026-10-02T03:59:00+00:00')],
      new Date('2026-10-02T04:00:00.000Z'),
    );
    expect(picked?.id).toBe('a');
  });
});

describe('visitLabel', () => {
  // 2026-10-02 (금) 12:00 KST
  const now = new Date('2026-10-02T03:00:00Z');

  test('어제 점심 — 목업 2a 문구', () => {
    expect(
      visitLabel(row('a', '2026-10-01T02:30:00Z', '2026-10-01'), now),
    ).toBe('어제 · 10.01 (목) 점심');
  });

  test('당일 클릭은 오늘', () => {
    expect(
      visitLabel(row('a', '2026-10-02T02:30:00Z', '2026-10-02'), now),
    ).toBe('오늘 · 10.02 (금) 점심');
  });

  test('KST 16시 이후 클릭은 저녁', () => {
    // 2026-10-01 18:00 KST
    expect(
      visitLabel(row('a', '2026-10-01T09:00:00Z', '2026-10-01'), now),
    ).toBe('어제 · 10.01 (목) 저녁');
  });

  test('이틀 이상 지나면 날짜만', () => {
    expect(
      visitLabel(row('a', '2026-09-28T03:00:00Z', '2026-09-28'), now),
    ).toBe('09.28 (월) 점심');
  });
});

describe('canSubmitQuickReview', () => {
  const filled = {
    ...emptyDraft(),
    rating: 4,
    body: '반찬이 매번 바뀌어서 좋아요',
    recommends: true,
    pricePerPerson: 9000,
  };

  test('별점·한 줄·추천·1인 가격이 다 있으면 보낼 수 있다', () => {
    expect(canSubmitQuickReview(filled)).toBe(true);
  });

  test('목업에 없던 추천·1인 가격도 필수다', () => {
    expect(canSubmitQuickReview({ ...filled, recommends: null })).toBe(false);
    expect(canSubmitQuickReview({ ...filled, pricePerPerson: null })).toBe(
      false,
    );
  });

  test('한 줄은 50자까지', () => {
    expect(
      canSubmitQuickReview({ ...filled, body: '가'.repeat(QUICK_BODY_MAX) }),
    ).toBe(true);
    expect(
      canSubmitQuickReview({
        ...filled,
        body: '가'.repeat(QUICK_BODY_MAX + 1),
      }),
    ).toBe(false);
  });
});
