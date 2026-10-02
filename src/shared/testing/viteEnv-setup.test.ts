import { describe, expect, test } from 'bun:test';
import { parseSupabaseEnv } from '@/shared/lib/supabase/env';

// preload 가 실제로 걸렸는지 확인한다 — bunfig.toml 의 preload 는 조용히 빠질 수 있고,
// 빠지면 테스트가 .env.local 의 실제 프로젝트를 상대로 돌기 시작한다.
describe('viteEnv-setup preload', () => {
  test('MODE 를 test 로 세운다', () => {
    expect(import.meta.env.MODE).toBe('test');
  });

  test('Supabase 접속 대상이 로컬 스택으로 덮인다', () => {
    const { url, key } = parseSupabaseEnv(import.meta.env);
    expect(url).toBe('http://127.0.0.1:54321');
    expect(key).toBe('sb_publishable_test');
  });
});
