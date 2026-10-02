# 배포 (Vercel)

이 앱은 **서버가 없는 SPA** 입니다. Vercel 은 정적 파일만 서빙하고, 데이터·인증은 전부
Supabase 가 맡습니다.

## 1. 왜 `vercel.json` 이 필요한가

`createBrowserRouter` 를 쓰므로 `/results` · `/community` · `/restaurants/:id` 는 **브라우저
안에서만 존재하는 주소**입니다. 그 주소로 바로 들어오거나 새로고침하면 Vercel 은 그런 파일이
없다며 **404 를 돌려줍니다** — 링크를 공유받은 사람이 가장 먼저 밟는 함정입니다.

그래서 `assets/` 를 뺀 모든 경로를 `index.html` 로 돌립니다. `assets/` 를 빼는 이유는 거기까지
돌리면 없는 js·css 요청이 **200 + HTML** 로 와서 "문법 오류" 처럼 보이기 때문입니다.

빌드 결과물의 파일 이름에는 해시가 들어 있어 내용이 바뀌면 이름이 바뀝니다. 그래서 1년 캐시를
겁니다.

## 2. Vercel 프로젝트 설정

| | |
|---|---|
| Repository | `github.com/mklee-vendit/vendit-hackerthon` (`master`) |
| Framework Preset | Vite |
| Build Command | `bun run build` (기본값으로 두면 `vite build` 만 돌아 타입 검사가 빠진다) |
| Output Directory | `dist` |
| Install Command | 기본값 (`bun.lock` 이 있어 bun 으로 잡힌다) |

**환경변수는 `VITE_` 두 개만** 넣습니다.

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

나머지(`KAKAO_REST_API_KEY` · `TMAP_APP_KEY` · `SUPABASE_ACCESS_TOKEN` 등)는 **로컬 도구용이고
Vercel 에 올리지 않습니다.** 수집·측정은 사람이 로컬에서 돌립니다.

> `VITE_` 가 붙은 값은 번들에 그대로 들어갑니다. 공개돼도 되는 값만 붙이세요 —
> publishable key 는 RLS 가 있어 공개 전제입니다.

**env 를 바꾸면 반드시 재배포해야 반영됩니다**(§12). push 했다고 배포된 것이 아니므로,
Ready 상태와 실제 응답을 보고 나서 완료로 칩니다.

## 3. Supabase 에 배포 주소 등록 — 이걸 빼면 로그인이 조용히 실패합니다

로그인 후 돌아올 주소가 Supabase 의 허용 목록에 없으면 **아무 설명 없이 되돌아오지 않습니다.**

`supabase/config.toml` 의 `[auth]` 를 고치고 `supabase config push` 로 올립니다.

**적용 완료** (2026-10-02, `config push` 로 올라갔습니다). 올라간 값:

```toml
site_url = "https://vendit-hackerthon.vercel.app"
additional_redirect_urls = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://vendit-hackerthon.vercel.app/**",
  "https://vendit-hackerthon-*.vercel.app/**",   # 프리뷰 배포
]
```

- 코드는 항상 `redirectTo: window.location.origin` 을 넘깁니다(`shared/lib/auth/signIn.ts`).
  그 주소가 허용 목록에 없으면 Supabase 는 **거부 메시지 대신** `site_url` 로 돌려보냅니다 —
  그래서 목록이 틀렸을 때의 증상이 "로그인했는데 엉뚱한 곳으로 갔다" 입니다.
- `site_url` 은 그 폴백이자 메일 링크의 기준 주소입니다. 로컬은 `redirectTo` 로 돌아오므로
  이 값을 배포 도메인으로 바꿔도 개발에 지장이 없습니다.
- 와일드카드는 `*`(구분자 `.`·`/` 를 넘지 않음) 과 `**`(아무거나) 입니다. 프리뷰 배포는 URL 이
  매번 달라지므로 필요하고, 슬러그를 몰라도 `vendit-hackerthon-*` 로 **우리 프로젝트만** 걸립니다.

`config push` 는 `[auth.external.google]` 의 값도 함께 올립니다. `.env.local` 을 읽히지 않고
돌리면 client_id 가 빈 값으로 덮일 수 있으니, 환경변수를 올린 상태에서 `supabase config diff` 로
**바뀔 항목이 의도한 것뿐인지** 먼저 확인하세요.

Google Cloud Console 쪽은 **바꿀 것이 없습니다** — 구글이 돌아오는 곳은 우리 도메인이 아니라
`https://<project-ref>.supabase.co/auth/v1/callback` 이고, 그건 이미 등록돼 있습니다.

## 4. 배포 후 확인 (§10.9)

| 확인 | 왜 |
|---|---|
| `/results?...` 를 **새 탭에 직접** 열기 | rewrite 가 걸렸는지. 404 면 `vercel.json` 이 안 먹은 것 |
| 로그인 → 홈으로 돌아오는지 | redirect 허용 목록 |
| 외부 구글 계정으로 로그인 | 도메인 제한이 배포본에서도 도는지 |
| 검색 → 결과 → 상세 → 후기 등록 | 데이터 경로 전체 |
| **모바일에서도** 같은 확인 | 요구사항이 모바일 우선이다 |

안 돌려 본 것은 안 돌렸다고 적습니다.

## 5. 아직 안 정한 것

- 커스텀 도메인 사용 여부 — 지금은 `vendit-hackerthon.vercel.app`
