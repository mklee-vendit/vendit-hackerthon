import { expect, test } from 'bun:test';
import { avatarLabel } from './avatarLabel';

test('세 글자 이름은 성을 뗀다', () => {
  expect(avatarLabel('김지은')).toBe('지은');
});

test('두 글자 이하는 그대로', () => {
  expect(avatarLabel('지은')).toBe('지은');
  expect(avatarLabel(' 혁 ')).toBe('혁');
});
