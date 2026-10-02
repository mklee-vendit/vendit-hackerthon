export type AuthRedirectError = {
  code: string | null;
  message: string;
};

const FALLBACK_BY_CODE: Record<string, string> = {
  server_error: '로그인 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
};

const GENERIC = '로그인에 실패했어요. 다시 시도해주세요.';

/**
 * 구글에서 돌아온 URL 에서 실패 사유를 꺼낸다.
 *
 * **쿼리스트링과 해시를 둘 다 본다.** OAuth 실패는 흐름(PKCE/implicit)에 따라 `?error=…` 로도
 * `#error=…` 로도 오는데, 어느 쪽인지 공식 문서에서 확정하지 못했다. 한쪽만 읽으면 그 경우에
 * 에러가 조용히 사라져 사용자는 아무 일도 안 일어난 로그인 화면만 본다 — 그게 제일 나쁘다.
 *
 * `access_denied` 는 **에러로 취급하지 않는다.** 사용자가 구글 동의 화면에서 취소를 누른
 * 것이므로 알릴 사고가 없다.
 */
export function parseAuthRedirectError(
  search: string,
  hash: string,
): AuthRedirectError | null {
  for (const raw of [search, hash]) {
    const params = new URLSearchParams(raw.replace(/^[?#]/, ''));
    const error = params.get('error');
    if (!error) continue;

    const code = params.get('error_code') ?? error;
    if (code === 'access_denied' || error === 'access_denied') return null;

    const description = params.get('error_description')?.trim();
    return {
      code,
      message: description || FALLBACK_BY_CODE[code] || GENERIC,
    };
  }

  return null;
}
