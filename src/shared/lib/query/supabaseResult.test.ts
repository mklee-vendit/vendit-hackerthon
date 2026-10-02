import { describe, expect, test } from 'bun:test';
import type {
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
  PostgrestSingleResponse,
} from '@supabase/supabase-js';
import {
  isPostgrestError,
  shouldRetrySupabase,
  type Unwrapped,
  unwrapResult,
} from './supabaseResult';

const postgrestError = {
  name: 'PostgrestError',
  message: 'new row violates row-level security policy',
  details: '',
  hint: '',
  code: '42501',
};

const success = <T>(data: T) => ({
  success: true as const,
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
});

const failure = {
  success: false as const,
  data: null,
  error: postgrestError,
  count: null,
  status: 403,
  statusText: 'Forbidden',
};

describe('unwrapResult', () => {
  test('성공이면 data 를 돌려준다', () => {
    expect(unwrapResult(success([{ id: 1 }]))).toEqual([{ id: 1 }]);
  });

  test('행이 없는 maybeSingle 의 null 은 성공이다 — 에러로 바꾸지 않는다', () => {
    expect(unwrapResult(success(null))).toBeNull();
  });

  test('실패면 받은 에러 객체를 그대로 던진다', () => {
    expect(() => unwrapResult(failure)).toThrow(
      'new row violates row-level security policy',
    );
    try {
      unwrapResult(failure);
    } catch (error) {
      // 호출부가 code 로 분기할 수 있어야 한다 — 감싸면 그게 사라진다.
      expect(isPostgrestError(error) && error.code).toBe('42501');
    }
  });
});

describe('isPostgrestError', () => {
  test('모양으로 판정한다', () => {
    expect(isPostgrestError(postgrestError)).toBe(true);
  });

  test('일반 에러·원시값은 아니다', () => {
    expect(isPostgrestError(new Error('boom'))).toBe(false);
    expect(isPostgrestError(null)).toBe(false);
    expect(isPostgrestError('42501')).toBe(false);
  });
});

describe('shouldRetrySupabase', () => {
  test('서버가 거절한 요청은 재시도하지 않는다', () => {
    expect(shouldRetrySupabase(0, postgrestError)).toBe(false);
  });

  test('네트워크 실패는 두 번까지 재시도한다', () => {
    const networkError = new TypeError('Failed to fetch');
    expect(shouldRetrySupabase(0, networkError)).toBe(true);
    expect(shouldRetrySupabase(1, networkError)).toBe(true);
    expect(shouldRetrySupabase(2, networkError)).toBe(false);
  });
});

// `= true` 가 컴파일되지 않으면 추론이 깨진 것이다 — 런타임이 아니라 타입을 박제한다.
type AssertEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

type Row = { id: number; name: string };

describe('Unwrapped', () => {
  test('응답 종류별로 성공 분기의 data 타입만 뽑는다', () => {
    const list: AssertEqual<Unwrapped<PostgrestResponse<Row>>, Row[]> = true;
    const single: AssertEqual<
      Unwrapped<PostgrestSingleResponse<Row>>,
      Row
    > = true;
    const maybeSingle: AssertEqual<
      Unwrapped<PostgrestMaybeSingleResponse<Row>>,
      Row | null
    > = true;

    expect([list, single, maybeSingle]).toEqual([true, true, true]);
  });
});
