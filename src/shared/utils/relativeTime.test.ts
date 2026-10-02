import { describe, expect, test } from 'bun:test';
import { relativeKo } from './relativeTime';

const NOW = new Date('2026-10-02T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe('relativeKo', () => {
  test('1분 미만은 방금', () => {
    expect(relativeKo(ago(0), NOW)).toBe('방금');
    expect(relativeKo(ago(59_000), NOW)).toBe('방금');
  });

  test('분·시간·일·주 단위로 내려 적는다', () => {
    expect(relativeKo(ago(40 * MIN), NOW)).toBe('40분 전');
    expect(relativeKo(ago(5 * HOUR), NOW)).toBe('5시간 전');
    expect(relativeKo(ago(2 * DAY), NOW)).toBe('2일 전');
    expect(relativeKo(ago(2 * WEEK), NOW)).toBe('2주 전');
  });

  test('경계에서 단위가 넘어간다', () => {
    expect(relativeKo(ago(MIN), NOW)).toBe('1분 전');
    expect(relativeKo(ago(HOUR), NOW)).toBe('1시간 전');
    expect(relativeKo(ago(DAY), NOW)).toBe('1일 전');
    expect(relativeKo(ago(WEEK), NOW)).toBe('1주 전');
  });

  test('4주를 넘기면 날짜를 그대로 적는다 — "13주 전" 은 언제인지 모른다', () => {
    expect(relativeKo(new Date('2026-06-15T00:00:00Z'), NOW)).toMatch(
      /^2026\.06\.1[45]$/,
    );
  });

  test('미래 시각은 방금으로 — 시계 차이로 "-1일 전" 이 나오면 안 된다', () => {
    expect(relativeKo(new Date(NOW.getTime() + DAY), NOW)).toBe('방금');
  });
});
