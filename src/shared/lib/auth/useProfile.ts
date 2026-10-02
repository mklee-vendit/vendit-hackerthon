import { useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import type { Profile } from './types';

/**
 * 내 멤버십. **`null` 은 "사내 계정이 아니다"** 를 뜻한다 — 로그인은 됐지만 profiles 행이
 * 없으면 RLS 가 0행을 돌려주기 때문이다(가입 거절 훅이 꺼져 있을 때 들어오는 경로).
 * 에러와 구별되는 정상 결과이므로 maybeSingle 로 받는다.
 */
export function useProfile(userId: string | undefined) {
  return useSupabaseQuery(
    ['profile', userId],
    () =>
      supabase
        .from('profiles')
        .select('id, email, display_name')
        .eq('id', userId ?? '')
        .maybeSingle()
        .returns<Profile>(),
    { enabled: Boolean(userId) },
  );
}
