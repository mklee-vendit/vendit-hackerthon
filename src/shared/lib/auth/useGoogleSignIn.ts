import { useState } from 'react';
import { extractCause } from '@/shared/lib/extractCause';
import { signInWithGoogle, signOut } from './signIn';

export function useGoogleSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      // 먼저 로그아웃한다 — 사내 계정이 아닌 세션으로 들어온 사람이 "다시 시도" 를 누르는
      // 경로에서 기존 세션이 남아 있으면 그대로 되돌아온다. 세션이 없을 때는 실패하는데,
      // 그건 지울 게 없다는 뜻이라 무시한다.
      await signOut().catch(() => undefined);
      await signInWithGoogle();
      // 성공하면 구글로 떠나므로 pending 을 내리지 않는다 — 내리면 화면이 깜빡이고
      // 버튼이 한 번 더 눌릴 수 있다.
    } catch (cause) {
      setError(
        extractCause(cause) || '로그인에 실패했어요. 다시 시도해주세요.',
      );
      setPending(false);
    }
  };

  return { start, pending, error };
}
