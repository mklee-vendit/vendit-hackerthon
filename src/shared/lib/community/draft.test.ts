import { describe, expect, test } from 'bun:test';
import {
  COMMENT_BODY_MAX,
  normalized,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  validateComment,
  validatePost,
} from './draft';

describe('validatePost', () => {
  const valid = { title: '금요일 회식 어디로', body: '18명 정도예요.' };

  test('다 채우면 통과', () => {
    expect(validatePost(valid)).toEqual([]);
  });

  test('빈 글은 둘 다 짚는다', () => {
    expect(validatePost({ title: '', body: '' }).sort()).toEqual([
      'body',
      'title',
    ]);
  });

  test('공백만이면 비어 있는 것으로 본다', () => {
    expect(validatePost({ title: '  ', body: '\n ' }).sort()).toEqual([
      'body',
      'title',
    ]);
  });

  test(`제목 ${POST_TITLE_MAX}자는 통과, 한 자 넘으면 거절`, () => {
    expect(
      validatePost({ ...valid, title: '가'.repeat(POST_TITLE_MAX) }),
    ).toEqual([]);
    expect(
      validatePost({ ...valid, title: '가'.repeat(POST_TITLE_MAX + 1) }),
    ).toEqual(['titleTooLong']);
  });

  test(`본문 ${POST_BODY_MAX}자는 통과, 한 자 넘으면 거절`, () => {
    expect(
      validatePost({ ...valid, body: '가'.repeat(POST_BODY_MAX) }),
    ).toEqual([]);
    expect(
      validatePost({ ...valid, body: '가'.repeat(POST_BODY_MAX + 1) }),
    ).toEqual(['bodyTooLong']);
  });

  test('자모 분리로 들어와도 NFC 로 세어 DB 와 같은 판정이 된다', () => {
    const nfd = '가'.repeat(POST_TITLE_MAX).normalize('NFD');
    expect(nfd.length).toBeGreaterThan(POST_TITLE_MAX);
    expect(validatePost({ ...valid, title: nfd })).toEqual([]);
  });
});

describe('validateComment', () => {
  test('내용이 있으면 통과', () => {
    expect(validateComment('고기요')).toBeNull();
  });

  test('빈 댓글은 거절', () => {
    expect(validateComment('')).toBe('body');
    expect(validateComment('   ')).toBe('body');
  });

  test(`${COMMENT_BODY_MAX}자 경계`, () => {
    expect(validateComment('가'.repeat(COMMENT_BODY_MAX))).toBeNull();
    expect(validateComment('가'.repeat(COMMENT_BODY_MAX + 1))).toBe(
      'bodyTooLong',
    );
  });
});

describe('normalized', () => {
  test('앞뒤 공백을 떼고 NFC 로 맞춘다', () => {
    expect(normalized('  가나다 ')).toBe('가나다');
    expect(normalized('가'.normalize('NFD'))).toBe('가');
  });
});
