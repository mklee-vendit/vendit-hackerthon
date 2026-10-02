-- 요구사항 §8 데이터 모델. 집계값(가격·단체 수용·제약)은 **저장하지 않고** 후기에서
-- 계산한다 — 그래야 후기를 지우면 집계가 자동으로 따라 빠진다(§9).
--
-- 글 삭제는 전부 **소프트 삭제**다. 글을 지워도 거기 달린 댓글을 살려 두기 위한 것이라
-- 행은 남기되 내용은 비운다. 비우는 일은 트리거가 하므로, 클라이언트가 "삭제 표시만 하고
-- 내용은 남겨 두는" 상태를 만들 수 없다 — RLS 는 행을 고르는 규칙이라 지워진 글의 본문을
-- 읽지 못하게 하는 일은 못 하고, 내용이 남아 있으면 REST 로 그대로 읽힌다.
--
-- 트리거는 테이블마다 컬럼을 **명시해서** 쓴다. 컬럼 이름을 인자로 받는 범용 트리거로
-- 묶으면 짧아지지만, 오타가 런타임까지 숨어서 "정규화가 조용히 안 걸린 컬럼"이 생긴다.

-- ── 식당 ────────────────────────────────────────────────────────────────────

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  -- 외부 출처 ID. 같은 식당을 두 번 넣지 않게 하는 유일 기준.
  kakao_place_id text not null unique,
  name text not null,
  category text not null,
  address text,
  road_address text,
  lon double precision not null,
  lat double precision not null,
  -- 수집일을 식당별로 남긴다(§7) — 1g 화면의 "정보 수집 2026.09.28" 이 이 값이다.
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.restaurants is
  '카카오 로컬에서 수집한 식당. 가격·단체 수용·제약은 여기 두지 않는다 — 후기 집계값이다(§8).';

-- 사무실 → 식당 보행자 도보 시간. **후기가 있는 식당만** 채운다(확정).
--
-- TMAP 약관이 결과를 저장 후 24시간 넘게 쓰지 못하게 해서 하루 1회 다시 측정한다.
-- `measured_at` 이 비어 있으면 아직 재본 적이 없다는 뜻이고, 있는데 `seconds` 가 비어
-- 있으면 재봤지만 실패한 것이다 — 그 둘을 구별해야 실패 목록을 만들 수 있다.
-- **직선거리로 대체하지 않는다**(§7). 화면에는 "도보 —" 로 나간다.
create table public.walk_times (
  restaurant_id uuid primary key
    references public.restaurants (id) on delete cascade,
  seconds integer check (seconds > 0),
  distance_m integer check (distance_m >= 0),
  measured_at timestamptz,
  failure text,
  updated_at timestamptz not null default now()
);

-- ── 식사 제약 ───────────────────────────────────────────────────────────────
-- **행 추가만으로 옵션이 늘어난다**(§8). 코드에 목록을 또 적지 않는다.

create table public.diet_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── 후기 ────────────────────────────────────────────────────────────────────

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  restaurant_id uuid not null
    references public.restaurants (id) on delete cascade,
  body text not null,
  rating smallint not null check (rating between 1 and 5),
  recommends boolean not null,
  -- 1인 가격은 필수(§3). 후기가 있으면 가격은 항상 있다.
  price_per_person integer not null check (price_per_person >= 0),
  -- 단체 정보 = 후기의 "함께 간 인원"(선택). 식당 단위 단체 수용력은 이 값의 **최대값**으로
  -- 본다 — 목업(1k)의 "단체 N명까지 확인" / "단체석 미확인" 이 이 집계다.
  party_size integer check (party_size >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 300자 상한(확정). 지운 글은 본문이 비므로 그때는 길이를 보지 않는다.
  constraint reviews_body_length
    check (deleted_at is not null or char_length(body) between 1 and 300)
);

create index reviews_by_restaurant
  on public.reviews (restaurant_id) where deleted_at is null;
create index reviews_by_author on public.reviews (author_id);

create table public.review_diet_tags (
  review_id uuid not null references public.reviews (id) on delete cascade,
  diet_option_id uuid not null
    references public.diet_options (id) on delete cascade,
  -- 가능/불가. 행이 없으면 "미확인" 이고, 미확인은 필터를 통과시킨다(§6).
  available boolean not null,
  primary key (review_id, diet_option_id)
);

-- ── 자유게시판 ──────────────────────────────────────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 제목 40자·본문 1,000자는 목업(3a) 제안값. ⚠️ 잠정.
  constraint posts_title_length
    check (deleted_at is not null or char_length(title) between 1 and 40),
  constraint posts_body_length
    check (deleted_at is not null or char_length(body) between 1 and 1000)
);

create index posts_recent on public.posts (created_at desc);

-- ── 댓글·공감 (글과 후기 **양쪽**에 붙는다 — §8) ───────────────────────────

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 대상은 정확히 하나. 둘 다거나 둘 다 아닌 행을 DB 가 막는다.
  constraint comments_single_target check (
    (post_id is not null)::int + (review_id is not null)::int = 1
  ),
  -- 댓글 300자는 목업(3a) 제안값. ⚠️ 잠정.
  constraint comments_body_length
    check (deleted_at is not null or char_length(body) between 1 and 300)
);

create index comments_by_post on public.comments (post_id, created_at);
create index comments_by_review on public.comments (review_id, created_at);

create table public.likes (
  profile_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_single_target check (
    (post_id is not null)::int + (review_id is not null)::int = 1
  )
);

-- 한 사람이 한 대상에 한 번만. 대상이 둘로 갈려 있어 부분 인덱스 두 개로 건다.
create unique index likes_once_per_post
  on public.likes (profile_id, post_id) where post_id is not null;
create unique index likes_once_per_review
  on public.likes (profile_id, review_id) where review_id is not null;
