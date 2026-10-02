import { describe, expect, test } from 'bun:test';
import { parseAuthRedirectError } from './authRedirectError';

describe('parseAuthRedirectError', () => {
  test('쿼리스트링에서 읽는다', () => {
    const r = parseAuthRedirectError(
      '?error=server_error&error_code=403&error_description=%EC%82%AC%EB%82%B4+%EA%B3%84%EC%A0%95%EB%A7%8C',
      '',
    );
    expect(r).toEqual({ code: '403', message: '사내 계정만' });
  });

  test('해시에서도 읽는다 — 흐름에 따라 여기로 온다', () => {
    const r = parseAuthRedirectError(
      '',
      '#error=server_error&error_code=403&error_description=%EC%82%AC%EB%82%B4+%EA%B3%84%EC%A0%95%EB%A7%8C',
    );
    expect(r?.message).toBe('사내 계정만');
  });

  test('에러가 없으면 null', () => {
    expect(parseAuthRedirectError('?code=abc123', '')).toBeNull();
    expect(parseAuthRedirectError('', '')).toBeNull();
  });

  test('취소(access_denied)는 에러가 아니다', () => {
    expect(parseAuthRedirectError('?error=access_denied', '')).toBeNull();
    expect(
      parseAuthRedirectError(
        '?error=server_error&error_code=access_denied',
        '',
      ),
    ).toBeNull();
  });

  test('설명이 없으면 코드별 문구로, 그것도 없으면 일반 문구로 메운다', () => {
    expect(parseAuthRedirectError('?error=server_error', '')?.message).toBe(
      '로그인 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
    );
    expect(parseAuthRedirectError('?error=weird_thing', '')?.message).toBe(
      '로그인에 실패했어요. 다시 시도해주세요.',
    );
  });

  test('설명이 공백뿐이면 비어 있는 것으로 본다', () => {
    expect(
      parseAuthRedirectError('?error=server_error&error_description=%20%20', '')
        ?.message,
    ).toBe('로그인 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
  });
});
