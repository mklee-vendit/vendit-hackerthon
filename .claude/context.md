# Project Context

## React Compiler

이 프로젝트는 **React Compiler** 를 사용합니다. 메모이제이션은 컴파일러가 처리합니다.

- `useMemo`, `useCallback`, `React.memo` 를 **쓰지 마세요.**
- 수동 성능 최적화 대신 읽기 쉬운 코드를 쓰세요.

## Tech Stack

- React 19 + TypeScript
- Vite 8 (+ React Compiler via Babel 패스)
- Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first 설정 — `tailwind.config.js` 없음)
- Bun (패키지 매니저 & 런타임 & 테스트)
- Biome (린터 / 포매터)
- zustand (클라이언트 상태), zod (스키마), react-router-dom

## Development Workflow

**모든 작업에 Bun 을 쓰세요. npm/yarn/pnpm 금지.**

- 설치: `bun install`
- 개발 서버: `bun run dev`
- 빌드: `bun run build` (typecheck 포함)
- 타입 체크: `bun run typecheck`
- 린트/포맷: `bun run lint:fix`
- 테스트: `bun test`

## 금지 사항

- **사내 전용 라이브러리(`@vendit-dev/*` — VDS, lottie 패키지 등)는 사용 금지입니다.**
  디자인 토큰과 공용 컴포넌트는 이 레포 안에서 직접 만듭니다.
