import { QueryClient } from '@tanstack/react-query';
import { shouldRetrySupabase } from './supabaseResult';

/**
 * 기본값을 여기 한 곳에 둔다 — 화면마다 `retry` / `staleTime` 을 적기 시작하면 왜 저 화면만
 * 다른지 아무도 모르게 된다.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetrySupabase,
        staleTime: 30_000,
        // 데모 중 창을 왔다갔다 하면 매번 다시 불러와 화면이 깜빡인다.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // 쓰기는 재시도하지 않는다 — 중복 insert 가 되기 때문. 멱등한 mutation 만 개별로 켜세요.
        retry: false,
      },
    },
  });
}
