import { useState } from 'react';
import {
  type AuthRedirectError,
  parseAuthRedirectError,
} from './authRedirectError';

/**
 * 구글에서 돌아온 URL 의 실패 사유를 한 번 읽고 **주소창에서 지운다.**
 * 안 지우면 새로고침마다 같은 에러가 되살아나고, 해결된 뒤에도 남는다.
 */
export function useAuthRedirectError(): AuthRedirectError | null {
  const [error] = useState(() => {
    const found = parseAuthRedirectError(
      window.location.search,
      window.location.hash,
    );
    if (found) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return found;
  });

  return error;
}
