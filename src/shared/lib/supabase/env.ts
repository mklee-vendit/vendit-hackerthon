import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  // 새 publishable key(sb_publishable_…)와 레거시 anon key(JWT) 둘 다 받는다.
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type SupabaseEnv = { url: string; key: string };

export function parseSupabaseEnv(env: Record<string, unknown>): SupabaseEnv {
  const result = schema.safeParse(env);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(
      `Supabase 환경변수가 비었거나 잘못됐습니다: ${keys.join(', ')} — .env.local 을 확인하세요.`,
    );
  }
  return {
    url: result.data.VITE_SUPABASE_URL,
    key: result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
