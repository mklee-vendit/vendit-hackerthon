import { describe, expect, test } from 'bun:test';
import { fitWithin, MAX_EDGE_PX, photoPath } from './image';

describe('fitWithin', () => {
  test('긴 변을 상한에 맞추고 비율을 지킨다', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  test('원본보다 키우지 않는다 — 용량만 늘고 화질은 그대로다', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1280, 1280, 1280)).toEqual({ width: 1280, height: 1280 });
  });

  test('아주 길쭉한 사진도 0px 이 되지 않는다', () => {
    const got = fitWithin(10_000, 3, 1280);
    expect(got.width).toBe(1280);
    expect(got.height).toBeGreaterThanOrEqual(1);
  });

  test('크기를 읽을 수 없으면 조용히 넘기지 않고 던진다', () => {
    expect(() => fitWithin(Number.NaN, 100)).toThrow();
    expect(() => fitWithin(0, 100)).toThrow();
    expect(() => fitWithin(-10, 100)).toThrow();
  });

  test('기본 상한은 1280px', () => {
    expect(MAX_EDGE_PX).toBe(1280);
    expect(fitWithin(4000, 4000)).toEqual({ width: 1280, height: 1280 });
  });
});

describe('photoPath', () => {
  test('첫 칸이 올린 사람 id 다 — RLS 가 남의 칸을 막는 기준', () => {
    expect(photoPath('user-1', 'review-2', 'file-3')).toBe(
      'user-1/review-2/file-3.webp',
    );
  });
});
