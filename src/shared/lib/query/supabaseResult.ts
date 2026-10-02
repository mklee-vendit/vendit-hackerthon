import type { PostgrestError } from '@supabase/supabase-js';

/**
 * postgrest 응답의 공통 모양. `success` 가 판별자이고, 실패 시 `data` 가 `null` 이다.
 * `PostgrestSingleResponse` · `PostgrestResponse` · `PostgrestMaybeSingleResponse` 가 모두
 * 이 제약을 만족한다.
 *
 * `error` 를 `PostgrestError` 클래스로 못 박지 않는다 — 클래스에는 `toJSON` 같은 멤버가
 * 있어서 같은 모양의 평문 객체(테스트 픽스처, 직접 만든 RPC 응답)가 거절된다. 벗기는 데
 * 필요한 건 "에러가 있는가"와 진단에 쓰는 두 필드뿐이다.
 */
export type SupabaseResponse = {
  success: boolean;
  data: unknown;
  error: { message: string; code: string } | null;
};

/**
 * 응답 유니온에서 **성공 분기의 data 타입만** 뽑는다.
 *
 * 응답을 `{ data: T | null }` 로 받아 `data as T` 로 돌려주는 흔한 방식은 `.maybeSingle()`
 * 에서 거짓말이 된다(행이 없으면 `null` 인데 타입은 `T`). 판별자로 분배하면 maybeSingle 은
 * `T | null`, single 은 `T`, select 는 `T[]` 가 그대로 나온다.
 */
export type Unwrapped<R> = R extends { success: true; data: infer D }
  ? D
  : never;

/** `{ data, error }` 를 벗긴다 — error 를 throw 로 바꿔야 react-query 가 실패를 안다. */
export function unwrapResult<R extends SupabaseResponse>(
  response: R,
): Unwrapped<R> {
  if (response.error) throw response.error;
  return response.data as Unwrapped<R>;
}

/**
 * `instanceof PostgrestError` 를 쓰지 않는다 — postgrest-js 사본이 둘이면(중첩 설치·번들
 * 분리) 같은 에러인데도 false 가 나온다. 모양으로 판정하는 쪽이 경계를 안 넘는다.
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.details === 'string'
  );
}

/** 네트워크 실패만 재시도할 횟수. */
const MAX_NETWORK_RETRIES = 2;

/**
 * **서버가 답한 거절은 재시도하지 않는다.** RLS 거부(42501)·unique 위반(23505)·행 없음
 * (PGRST116) 은 같은 요청을 다시 보내도 같은 답이 온다 — 재시도는 실패를 늦게 보여주는
 * 것 말고 하는 일이 없고, 쓰기 요청이면 같은 mutation 을 한 번 더 발사한다.
 *
 * 반대로 요청이 서버에 닿지도 못한 경우(fetch 실패)는 다시 보낼 가치가 있다.
 */
export function shouldRetrySupabase(
  failureCount: number,
  error: unknown,
): boolean {
  if (isPostgrestError(error)) return false;
  return failureCount < MAX_NETWORK_RETRIES;
}
