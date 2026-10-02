-- 구글 로그인 + @vendit.co.kr 사내 계정만 허용.
--
-- 세 겹이고, **겹마다 사는 곳이 다르다**.
--   1. `hd` 파라미터 (프론트)  — 구글 계정 선택창을 좁힌다. UX 일 뿐 경계가 아니다.
--   2. before-user-created 훅   — 외부 계정의 가입 자체를 거절한다. 단, 켜는 설정이
--                                 대시보드/config.toml 에 있어서 **조용히 꺼질 수 있다.**
--   3. profiles 행 + RLS        — 이 파일 안에 있어서 꺼질 수 없다. 데이터의 실제 경계.
--
-- 그래서 2번이 꺼져 외부 계정이 만들어져도 3번에서 profiles 행이 생기지 않고, 모든
-- 정책이 멤버십을 요구하므로 읽을 것도 쓸 것도 없는 계정이 된다.

-- ── 도메인 판정 (단일 기준) ──────────────────────────────────────────────────

create or replace function public.is_vendit_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- `like '%@vendit.co.kr'` 를 쓰지 않는다 — `%` 가 `a@evil.` 까지 먹어서
  -- `a@evil.vendit.co.kr` 이 통과한다. 마지막 @ 뒤만 떼어 정확히 비교한다.
  select coalesce(email, '') like '%@%'
     and lower(regexp_replace(coalesce(email, ''), '^.*@', '')) = 'vendit.co.kr';
$$;

comment on function public.is_vendit_email(text) is
  '사내 계정 판정의 단일 기준. 훅과 트리거가 둘 다 이 함수만 본다.';

-- ── 2겹: 가입 거절 훅 ────────────────────────────────────────────────────────
-- config.toml 의 [auth.hook.before_user_created] 로 연결한다(아래 주석 참고).

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if public.is_vendit_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'message', '벤디트 사내 구글 계정(@vendit.co.kr)만 로그인할 수 있습니다.',
      'http_code', 403
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.is_vendit_email(text) to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_by_email_domain(jsonb)
  to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb)
  from authenticated, anon, public;

-- ── 3겹: profiles (요구사항 §8 의 `User`) ────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  '멤버십 그 자체. 행이 있으면 사내 계정이고, 없으면 아무것도 할 수 없다.';

alter table public.profiles enable row level security;

-- 정책 안에서 profiles 를 다시 읽으면 재귀가 되므로 security definer 로 RLS 를 우회한다.
create or replace function public.is_member()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create policy "profiles: 멤버는 서로를 볼 수 있다"
  on public.profiles for select
  to authenticated
  using (public.is_member());

create policy "profiles: 자기 행만 수정"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- insert·delete 정책이 없다 = 클라이언트가 멤버를 만들거나 지울 수 없다. 생성은 아래
-- 트리거(security definer)만 한다. RLS 는 행을 고르는 규칙이라 "컬럼" 은 못 막으므로,
-- 수정 가능 범위는 컬럼 GRANT 로 좁힌다 — 이메일을 바꿔치기하면 멤버십이 뚫린다.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ── 가입 시 멤버 등록 ────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 사내 계정이 아니면 **예외를 던지지 않고 그냥 넘긴다.** 여기서 raise 하면 구글
  -- 콜백이 500 으로 깨져 사용자는 이유를 못 본다. 행을 안 만들면 RLS 가 전부 거절하고,
  -- 프론트는 "멤버 아님" 을 읽어 안내 후 로그아웃시킨다.
  if not public.is_vendit_email(new.email) then
    return new;
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
