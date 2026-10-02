import { describe, expect, test } from 'bun:test';
import { parseSupabaseEnv } from './env';

describe('parseSupabaseEnv', () => {
  test('URL 과 키를 꺼낸다', () => {
    expect(
      parseSupabaseEnv({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', key: 'sb_publishable_x' });
  });

  test('비어 있으면 어떤 키가 문제인지 알려준다', () => {
    expect(() =>
      parseSupabaseEnv({ VITE_SUPABASE_URL: 'https://abc.supabase.co' }),
    ).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  test('URL 형식이 아니면 거부한다', () => {
    expect(() =>
      parseSupabaseEnv({
        VITE_SUPABASE_URL: 'abc.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'k',
      }),
    ).toThrow(/VITE_SUPABASE_URL/);
  });
});
