/**
 * bun test 용 환경 보정 preload (`bunfig.toml` 의 `[test].preload`).
 *
 * 두 가지를 맞춘다.
 *
 * 1. **MODE** — `bun test` 는 `NODE_ENV` 만 'test' 로 세우고 `import.meta.env.MODE` 는
 *    비워 둔다(vite 가 주입하는 값이라 bun 런타임엔 없다). 런타임 코드는 vite 기준으로
 *    `MODE` 를 보므로, 보정하지 않으면 테스트가 프로덕션 분기를 탄다.
 *
 * 2. **Supabase 접속 대상** — bun 은 `.env.local` 을 자동으로 읽는다. 그대로 두면
 *    `@/shared/lib/supabase` 를 import 한 테스트가 **실제 프로젝트**를 가리키는 클라이언트를
 *    만든다. insert 하나가 실수로 들어가면 실제 데이터가 바뀌고, 더 나쁘게는 네트워크가
 *    없을 때만 깨지는 테스트가 된다. 그래서 기본값을 로컬 스택으로 덮는다.
 *
 *    `supabase start` 로 띄운 로컬 스택을 상대로 돌리는 통합 테스트는 그대로 동작하고,
 *    정말 원격을 찔러야 하면 `SUPABASE_TEST_REAL=1 bun test` 로 이 보정을 끈다.
 *
 * bun 이 `import.meta.env` 를 `process.env` 로 매핑하므로, 런타임 코드에 테스트 전용
 * 분기를 더하지 않고 전제만 갈아끼울 수 있다.
 */
process.env.MODE ??= 'test';

if (!process.env.SUPABASE_TEST_REAL) {
  // `supabase start` 의 기본 포트.
  process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
}
