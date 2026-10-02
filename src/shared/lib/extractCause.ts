/**
 * 던져진 값에서 **사람에게 보여줄 한 줄**을 뽑는다. 던져지는 모양은 세 가지로 갈린다 —
 * `{ cause, code }`(데이터 레이어 실패), 문자열(스키마 검증 실패), `Error`(그 외).
 * 호출부마다 벗기면 분기가 번지므로 여기서만 벗긴다.
 *
 * 로그에 넘길 구조화된 형태가 필요하면 [`toErrorLike`](./toErrorLike.ts) 를 쓰세요.
 */
export const extractCause = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.cause === 'string') return record.cause;
    if (typeof record.name === 'string' && record.name.length > 0) {
      // MutexPurgedError 처럼 name 을 채널 사유로 고정한 에러.
      if (record.name !== 'Error') return record.name;
    }
    if (typeof record.message === 'string') return record.message;
  }
  return '';
};
