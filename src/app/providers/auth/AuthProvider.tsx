import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session };

export const SessionContext = createContext<SessionState | null>(null);

/**
 * 세션은 Supabase 구독에서 온다 — 쿼리로 가져오는 서버 상태가 아니라 **클라이언트 상태**라서
 * react-query 가 아니라 여기 둔다. 멤버십(profiles 행)은 서버 상태이므로 `useProfile` 이
 * react-query 로 따로 읽는다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    // getSession 을 먼저 부르지 않는다 — onAuthStateChange 가 구독 직후 INITIAL_SESSION
    // 으로 현재 세션(또는 null)을 한 번 내려주므로, 둘 다 하면 경합이 생긴다.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session ? { status: 'signedIn', session } : { status: 'signedOut' },
      );
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
