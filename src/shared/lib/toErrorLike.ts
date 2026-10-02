export type ErrorLike = {
  name?: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: string;
};

/**
 * 던져진 아무 값 → 로그/표시에 쓸 정규화된 형태.
 *
 * **호출부가 감싸지 않아도 되는 것이 요점이다.** 비동기 경계는 `Error` 가 아니라
 * `{ cause, code }` 같은 평범한 객체를 던지는 일이 흔한데, 호출부가 이걸
 * `new Error(String(error))` 로 감싸면 메시지가 `[object Object]` 가 되어 진단이 통째로
 * 사라진다. 그래서 정규화는 여기 한 곳에서만 하고, 호출부는 받은 값을 **그대로** 넘긴다.
 *
 * 인식하는 모양(위에서부터): `Error` → `{ message }` → `{ cause, code }` → 그 외 객체(JSON)
 * → 문자열·원시값.
 */
export const toErrorLike = (error: unknown): ErrorLike => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const code =
      typeof obj.code === 'string' || typeof obj.code === 'number'
        ? obj.code
        : undefined;

    if ('message' in obj) {
      return {
        name: typeof obj.name === 'string' ? obj.name : undefined,
        message: String(obj.message),
        stack: typeof obj.stack === 'string' ? obj.stack : undefined,
        code,
      };
    }

    // 사유가 유일한 정보다. 메시지 자리에 올려 로그에서 바로 읽히게.
    if (typeof obj.cause === 'string') {
      return {
        name: typeof obj.name === 'string' ? obj.name : undefined,
        message: obj.cause,
        code,
        cause: obj.cause,
      };
    }

    try {
      return { message: JSON.stringify(error), code };
    } catch {
      return { message: '[unserializable object]', code };
    }
  }

  if (typeof error === 'string') return { message: error };
  if (error === null || error === undefined) {
    return { message: 'Unknown error' };
  }
  return { message: String(error) };
};
