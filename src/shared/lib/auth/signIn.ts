import { supabase } from '@/shared/lib/supabase';

/** 구글 계정 선택창을 사내 도메인으로 좁히는 힌트. **경계가 아니다** — 막는 건 DB 쪽이다. */
const GOOGLE_HOSTED_DOMAIN = 'vendit.co.kr';

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        hd: GOOGLE_HOSTED_DOMAIN,
        // 계정이 여러 개면 자동 선택되지 않게 — 사내 계정을 고르게 해야 한다.
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
