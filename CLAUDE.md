# Vendit Hackerton — AI & Developer Guide

사내 해커톤용 프로젝트입니다. React 프론트엔드 1개 + Supabase(Postgres) 구성이며, 별도 서버 없이
브라우저에서 DB 에 직접 붙습니다 — 그래서 **모든 테이블은 RLS 를 켜고 정책을 적어야 합니다.**

## 쓰는 것 / 안 쓰는 것

- 패키지 매니저·런타임·테스트는 **모두 bun**. npm/yarn/pnpm 금지.
- **사내 전용 라이브러리(`@vendit-dev/*`)는 금지.** 공용 컴포넌트·토큰은 이 레포에서 직접 만든다.
- React Compiler 가 켜져 있으므로 `useMemo` / `useCallback` / `React.memo` 를 쓰지 않는다.

## 설계 규칙

1. 순수 함수로 먼저 쓴다.
2. 순수한 부분은 가능한 많이 테스트로 박제한다 (`bun test`).
3. 박제할 수 없는 부수효과는 경계(훅·transport·store)로 밀어낸다.

### 서버 상태와 클라이언트 상태를 섞지 않기

서버 상태(DB/API 응답)를 클라이언트 상태 스토어(zustand)에 **복사하지 않습니다.** 복사하면
서버가 바뀌어도 화면이 옛 값을 들고 있게 됩니다. 서버 데이터는 데이터 레이어에서 바로 읽으세요.

```tsx
// 금지
const { data } = useQuery(...);
useEffect(() => { store.set(data); }, [data]);

// 올바름
const { data } = useQuery(...);
return <div>{data.name}</div>;
```

### 함수형 우선

순수 함수 · 불변 데이터 · 함수 합성을 기본으로. 클래스는 인프라 레이어에서만.

### 버튼은 너비를 명시하기

flex item 의 `min-width:auto` 기본값 때문에 너비를 안 적으면 긴 텍스트에서 버튼이 콘텐츠만큼
늘어나 레이아웃이 깨집니다. 균등 분할 버튼은 `flex-1 min-w-0` 을 명시하세요.

### 주석은 코드가 말할 수 없는 것만

**남길 것** — 실측·사고 이력, 기각된 대안과 그 이유, 미문서화된 외부 계약, 비직관적 타이밍
제약, 수치의 근거, `TODO`.

**지울 것** — 코드를 한국어로 옮긴 줄, 타입에 이미 있는 `@param`/`@returns`, 섹션 배너,
스캐폴딩이 남긴 영어 주석.

근거 하나당 1~3줄. 그보다 길면 주석이 아니라 문서이므로 `docs/` 로 옮기고 링크만 남기세요.

## Supabase

클라이언트는 `@/shared/lib/supabase` 에서 import 한다. `shared/lib/index.ts` 로 재노출하지 않는 건
의도적 — 배럴에 넣으면 무관한 import 에도 환경변수 검증이 돌아 앱이 죽는다.

새 테이블은 **GRANT 와 RLS 둘 다** 있어야 브라우저에서 접근된다. 이 프로젝트는 `public` 에
새 테이블을 만들어도 `anon` 에 자동 GRANT 가 붙지 않는다 (실측: 정책만 만들면 42501).

```sql
alter table public.x enable row level security;
grant select, insert on public.x to anon;          -- 필요한 동작만
create policy "x: anon read" on public.x for select to anon using (true);
```

브라우저에 넣는 키는 `sb_publishable_…` 뿐. `service_role` / `sb_secret_…` 은 RLS 를 무시한다.

## 구조

```
src/
  app/        App · router · provider (앱 조립 경계)
  pages/      라우트 단위 화면
  shared/
    components/  공용 컴포넌트
    hooks/       공용 훅
    lib/         도메인 로직 · 외부 연동 (store + hooks 쌍으로 묶는 패턴)
    store/       zustand 스토어
    utils/       순수 유틸
    types/       공용 타입
```

`@/` 는 `src/` 를 가리킵니다 (vite alias + tsconfig paths 양쪽에 등록).

## 스타일

Tailwind CSS v4 — `tailwind.config.js` 가 없고 `src/index.css` 의 `@theme` 블록이 설정입니다.
색은 토큰 유틸리티(`bg-surface`, `text-content-muted`, `bg-brand` 등)로 쓰고, 다크 모드는
`prefers-color-scheme` 에 따라 `:root` 변수만 갈립니다 — 컴포넌트에 `dark:` 를 뿌리지 마세요.

## 이미 들어있는 공용 자산

`vendit-kiosk-frontend` 에서 가져온 것들입니다 (사내 라이브러리 의존 없음, 전부 순수).

| 위치 | 무엇 |
|------|------|
| `shared/store/storeRegistry.ts` | `createStore()` — zustand + `reset()` + `resetAllStores()` |
| `shared/lib/singleFlight.ts` | "한 번에 하나만" 래치. 재진입 시 진행 중인 약속에 **합류**한다 |
| `shared/lib/extractCause.ts` | 던져진 값 → 사용자에게 보여줄 한 줄 |
| `shared/lib/toErrorLike.ts` | 던져진 값 → 로그용 구조화된 형태 |
| `shared/hooks/useConst.ts` | 마운트당 1회 초기화. `useRef` 대신 — React Compiler 가 제외하지 않는다 |
| `shared/hooks/useAbortableEffect.ts` | `useEffect` + `AbortController` 주입 |
| `shared/hooks/useAbortController.ts` | 컴포넌트 수명에 묶인 `AbortController` |
| `shared/utils/koreanParticle.ts` | 받침 유무로 조사 고르기 (`을/를`, `이/가`) |
| `shared/utils/isWithinHHMMRange.ts` | `"HH:mm"` 범위 판정 (자정 넘김 포함) |
| `shared/utils/mixArray.ts` | Fisher–Yates 셔플 (불변) |
| `shared/utils/cn.ts` | `clsx` + `tailwind-merge` |
| `shared/components/AutoFitText.tsx` | 클리핑 조상을 찾아 넘치지 않는 최대 폰트로 이분 탐색 |
| `shared/lib/modal/*` | 전역 모달 — 아래 참고 |
| `shared/lib/toast/store.ts` | 전역 토스트 — 아래 참고 |
| `shared/lib/query/*` | Supabase × react-query 래퍼 — 아래 참고 |
| `shared/testing/viteEnv-setup.ts` | `bun test` preload — 아래 참고 |

`singleFlight` · `koreanParticle` · `modalStateStore` 는 테스트가 같이 왔습니다 (`bun test`).

## 전역 모달

모달은 `useState(false)` 로 열지 않습니다. **레지스트리에 등록하고 타입으로 엽니다.**

```tsx
const { openModal, closeModal } = useModal();
openModal(MODAL_TYPE.CONFIRM, { title: '삭제할까요?', onConfirm }, { closeOnOverlayClick: true });
```

새 모달 추가는 두 군데: `shared/constants/modal.ts` 에 키를, `app/providers/modal/registry.ts`
에 컴포넌트를. `defineExactMap` 이 둘을 대조하므로 **한쪽만 적으면 컴파일이 깨집니다** —
등록을 잊은 모달이 런타임에 `undefined` 컴포넌트로 터지는 걸 타입으로 막습니다.

props 는 컴포넌트에서 추론됩니다. 필수 props 가 있으면 인자를 반드시 넘겨야 하고,
없으면 생략할 수 있습니다(`store.ts` 의 오버로드).

`ModalOptions`: `closeOnOverlayClick` · `showCloseButton` · `flowToken`. 옵션에 부수효과를
붙일 자리는 `app/providers/modal/useModalContainer.ts` 한 곳입니다.

**`types.ts` 의 빈 `interface` 두 개를 `type` 으로 바꾸지 마세요.** biome 의
`noEmptyInterface` 가 "안전한 수정"으로 제안하지만, `declare module` 확장이 깨져서 모달
타입이 전부 `never` 가 됩니다. 억제 주석이 붙어 있습니다.

### 선택적인 두 겹 (안 쓰면 몰라도 됩니다)

- **`flowToken`** — 여러 모달이 한 플로우를 이룰 때 그들끼리만 공유하는 상태.
  `createFlowToken<T>()` 로 만들고 `openModal(..., { flowToken })`, 모달 안에서
  `useModalFlowState(TOKEN)`. 플로우의 마지막 모달이 닫히면 자동으로 버려집니다.
- **`modalState`** — "여는 쪽 ↔ 그 모달"이 주고받는 값. `ModalStateRegistry` 에 선언하면
  `useModal(KEY).modalState.field` 가 `[값, setter]` 튜플로 열립니다. 모달이 닫힌 뒤에도
  여는 쪽이 마운트돼 있는 동안 값이 살아 있어서 **결과 회수**에 쓸 수 있습니다.

## 전역 토스트

```tsx
const { openToast } = useToast();
openToast(TOAST_TYPE.SUCCESS, '저장했습니다'); // 기본 3초 후 자동 닫힘
```

`timeout` 을 `0` 으로 주면 자동으로 닫히지 않으므로 `closeToast(id)` 로 직접 닫아야 합니다.

## Supabase × react-query

`shared/lib/query` 는 **클라이언트를 import 하지 않습니다** — 빌더를 호출부가 넘깁니다.
그래서 이 모듈을 import 해도 환경변수 검증이 돌지 않습니다(`shared/lib/supabase` 쪽 주의사항과
같은 이유).

```tsx
const { data } = useSupabaseQuery(['rooms'], () =>
  supabase.from('rooms').select('id, name').order('name'),
);

const { mutate } = useSupabaseMutation(
  (name: string) => supabase.from('rooms').insert({ name }).select().single(),
  { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }) },
);
```

**빌더가 아니라 빌더를 만드는 함수를 넘깁니다.** postgrest 빌더는 `then` 될 때 요청을 보내므로
빌더를 그대로 넘기면 react-query 가 쓰기 전에 이미 떠 있고, 재시도·refetch 가 같은 빌더를 다시
await 하게 됩니다.

반환 타입은 빌더에서 추론됩니다 — `.select()` 는 배열, `.single()` 은 객체, `.maybeSingle()` 은
`| null`. `{ data, error }` 를 `data as T` 로 벗기는 방식이 `.maybeSingle()` 에서 거짓말이 되는
것을 `Unwrapped<R>` 가 막고, 그 추론은 타입 레벨 테스트로 박제돼 있습니다.

기본값은 `createQueryClient()` 한 곳입니다. **서버가 답한 거절(RLS 42501, unique 23505,
행 없음 PGRST116)은 재시도하지 않습니다** — 같은 답이 올 뿐이고 쓰기면 중복 발사가 됩니다.
요청이 서버에 닿지 못한 경우만 두 번까지 재시도합니다.

## bun test 환경

`bunfig.toml` 의 preload 가 `shared/testing/viteEnv-setup.ts` 를 먼저 돌려 두 가지를 맞춥니다.

- `import.meta.env.MODE` → `'test'` (vite 가 주입하는 값이라 bun 런타임엔 없습니다)
- Supabase 접속 대상 → **로컬 스택**(`http://127.0.0.1:54321`). bun 이 `.env.local` 을 자동으로
  읽기 때문에, 덮지 않으면 테스트가 실제 프로젝트를 상대로 돕니다. 원격을 찔러야 하면
  `SUPABASE_TEST_REAL=1 bun test`.

preload 가 조용히 빠지면 위 전제가 사라지므로 그 자체를 검사하는 테스트가 있습니다.

`@/` alias 는 **세 곳**에 적혀 있습니다 — `vite.config.ts`(번들), `tsconfig.app.json`(tsc),
그리고 루트 `tsconfig.json`(bun 이 읽는 곳). 루트에 없으면 `bun test` 에서만 모듈을 못 찾습니다.
