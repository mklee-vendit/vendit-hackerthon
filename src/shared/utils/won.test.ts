import { describe, expect, test } from 'bun:test';
import { formatWon, parseWon } from './won';

describe('formatWon', () => {
  test('천 단위 쉼표', () => {
    expect(formatWon(10000)).toBe('10,000');
    expect(formatWon(950)).toBe('950');
  });
});

describe('parseWon', () => {
  test('쉼표·단위를 버리고 숫자만 읽는다', () => {
    expect(parseWon('10,000')).toBe(10000);
    expect(parseWon('9,500원')).toBe(9500);
  });

  test('숫자가 없으면 null — 빈 입력을 0원으로 바꾸지 않는다', () => {
    expect(parseWon('')).toBeNull();
    expect(parseWon('원')).toBeNull();
    expect(parseWon('0')).toBe(0);
  });
});
