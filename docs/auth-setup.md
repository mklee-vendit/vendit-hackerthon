# 구글 로그인 + 사내 계정 제한 — 설정 절차

코드·마이그레이션은 레포에 있습니다. 아래는 **사람이 콘솔에서 해야 하는 것**과 적용 명령입니다.
키는 문서·커밋에 적지 않습니다(요구사항 §10.11).

## 막는 지점이 세 겹이고, 겹마다 사는 곳이 다르다

| 겹 | 무엇 | 어디 | 꺼질 수 있나 |
|---|---|---|---|
| 1 | `hd=vendit.co.kr` — 구글 계정 선택창을 좁힘 | `src/shared/lib/auth/signIn.ts` | — (UX 일 뿐, 경계 아님) |
| 2 | before-user-created 훅 — 외부 계정 **가입 거절** | DB 함수 + `config.toml` | **예** (설정이라 꺼질 수 있음) |
| 3 | `profiles` 행 + RLS — 데이터 접근 거절 | 마이그레이션 | 아니오 |

2번이 꺼지면 외부 구글 계정도 세션까지는 만들어집니다. 그 계정은 `profiles` 행이 없어
RLS 가 전부 거절하고, 화면은 "사내 계정이 아닙니다 + 로그아웃"을 보여줍니다
(`src/app/RequireMember.tsx`). **빈 화면이 아니라 이유가 나오는 것이 의도된 동작입니다.**

## 1. Google Cloud Console

OAuth 2.0 클라이언트 ID(웹 애플리케이션)를 만들고 **승인된 리디렉션 URI** 에 Supabase 콜백을
넣습니다. 구글이 돌아오는 곳은 우리 앱이 아니라 Supabase 입니다.

```
https://<project-ref>.supabase.co/auth/v1/callback   # 호스팅 프로젝트
http://127.0.0.1:54321/auth/v1/callback              # 로컬 스택을 쓸 때만
```

발급된 client ID / secret 을 환경변수로 둡니다 (커밋하지 않음).

```sh
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

> `hd` 파라미터는 구글에게 주는 **힌트**입니다. 사용자가 URL 을 직접 고쳐 다른 도메인 계정으로
> 올 수 있으므로 이것만으로 막지 않습니다(요구사항 §10.8).

## 2. 마이그레이션 적용

```sh
bunx supabase link --project-ref <ref>
bunx supabase db push
```

## 3. 인증 설정 적용

`config.toml` 에 구글 프로바이더와 훅이 이미 선언돼 있습니다. 린크된 프로젝트에 밀어넣습니다.

```sh
bunx supabase config diff    # 먼저 확인
bunx supabase config push
```

대시보드로 할 경우 세 군데입니다.

- Authentication → Sign In / Providers → **Google** 활성화 + client ID/secret
- Authentication → URL Configuration → Site URL 과 Redirect URLs 에 **배포 주소와
  `http://localhost:5173`** 를 등록 (여기 없는 주소로 돌아오면 로그인이 조용히 실패합니다)
- Authentication → Hooks → **Before User Created** → Postgres 함수
  `public.hook_restrict_signup_by_email_domain` 선택

## 4. 실물 확인 (요구사항 §10.9)

| 시나리오 | 기대 |
|---|---|
| `@vendit.co.kr` 계정으로 로그인 | 홈 진입 |
| 외부 구글 계정으로 로그인 | 구글 콜백에서 403 + "벤디트 사내 구글 계정만…" (2번이 켜진 경우) |
| 2번을 끈 상태에서 외부 계정 | 로그인은 되지만 "사내 계정이 아닙니다" + 로그아웃 버튼 |
| 로그아웃 후 `/` 접근 | `/login` 으로 리다이렉트 |

**데스크톱과 모바일 양쪽에서 확인하고, 안 돌린 검증은 안 돌렸다고 적습니다.**

검증용으로 만든 외부 계정 행은 확인 직후 `auth.users` 에서 지웁니다(§10.3 — 검증 데이터는
삭제까지가 한 단위).

## 도메인 판정은 한 곳에만 있다

SQL 의 `public.is_vendit_email()` 하나이고, 훅과 트리거가 둘 다 이 함수만 봅니다.
프론트엔드에는 **같은 규칙을 다시 구현하지 않습니다** — `useProfile()` 이 멤버십 행이 있는지만
읽습니다. 규칙이 두 곳에 있으면 한쪽만 고쳐져서 갈립니다(§10.1 단일 기준).

`like '%@vendit.co.kr'` 를 쓰지 않는 이유는 마이그레이션 주석에 있습니다 — `%` 가
`a@evil.` 까지 먹어서 `a@evil.vendit.co.kr` 이 통과합니다.
