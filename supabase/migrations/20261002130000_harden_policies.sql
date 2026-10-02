-- `supabase db advisors` 가 잡은 두 가지를 고친다.
--
-- 1. **노출된 SECURITY DEFINER 함수** — 트리거 전용 함수가 `/rest/v1/rpc/...` 로 호출
--    가능한 상태였다. 트리거는 테이블 소유자 권한으로 돌므로 클라이언트 EXECUTE 는
--    필요 없다. 쓰지 않는 권한은 공격면일 뿐이다.
--
-- 2. **정책 안의 `auth.uid()` 가 행마다 재평가된다** — `(select auth.uid())` 로 감싸면
--    한 번만 평가된다. 식당 883곳 × 후기가 쌓이면 차이가 난다.
--    https://supabase.com/docs/guides/database/postgres/row-level-security

-- ── 1. 쓰지 않는 EXECUTE 회수 ───────────────────────────────────────────────

-- 가입 시 멤버를 등록하는 트리거 함수. 직접 부를 일이 없다.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 도메인 판정. 훅(supabase_auth_admin)과 트리거(소유자)만 부른다.
revoke execute on function public.is_vendit_email(text) from anon, authenticated, public;

-- 멤버십 판정은 **정책이 쓰므로 authenticated 에게 남겨야 한다** — 정책 표현식은 질의하는
-- 롤의 권한으로 평가된다. anon 은 정책을 평가할 일이 없다(모든 정책이 to authenticated).
revoke execute on function public.is_member() from anon, public;
grant execute on function public.is_member() to authenticated;

-- ── 2. 정책에서 auth 호출을 한 번만 평가하게 ────────────────────────────────

drop policy "profiles: 멤버는 서로를 볼 수 있다" on public.profiles;
drop policy "profiles: 자기 행만 수정" on public.profiles;
create policy "profiles: 멤버는 서로를 볼 수 있다" on public.profiles
  for select to authenticated using ((select public.is_member()));
create policy "profiles: 자기 행만 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "restaurants: 멤버만 읽기" on public.restaurants;
create policy "restaurants: 멤버만 읽기" on public.restaurants
  for select to authenticated using ((select public.is_member()));

drop policy "walk_times: 멤버만 읽기" on public.walk_times;
create policy "walk_times: 멤버만 읽기" on public.walk_times
  for select to authenticated using ((select public.is_member()));

drop policy "diet_options: 멤버만 읽기" on public.diet_options;
drop policy "diet_options: 멤버가 추가" on public.diet_options;
create policy "diet_options: 멤버만 읽기" on public.diet_options
  for select to authenticated using ((select public.is_member()));
create policy "diet_options: 멤버가 추가" on public.diet_options
  for insert to authenticated with check ((select public.is_member()));

drop policy "reviews: 멤버만 읽기" on public.reviews;
drop policy "reviews: 멤버가 작성" on public.reviews;
drop policy "reviews: 작성자만 수정" on public.reviews;
create policy "reviews: 멤버만 읽기" on public.reviews
  for select to authenticated using ((select public.is_member()));
create policy "reviews: 멤버가 작성" on public.reviews
  for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "reviews: 작성자만 수정" on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy "review_diet_tags: 멤버만 읽기" on public.review_diet_tags;
drop policy "review_diet_tags: 내 후기에만 추가" on public.review_diet_tags;
drop policy "review_diet_tags: 내 후기에서만 제거" on public.review_diet_tags;
create policy "review_diet_tags: 멤버만 읽기" on public.review_diet_tags
  for select to authenticated using ((select public.is_member()));
create policy "review_diet_tags: 내 후기에만 추가" on public.review_diet_tags
  for insert to authenticated with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.author_id = (select auth.uid())
        and r.deleted_at is null
    )
  );
create policy "review_diet_tags: 내 후기에서만 제거" on public.review_diet_tags
  for delete to authenticated using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.author_id = (select auth.uid())
        and r.deleted_at is null
    )
  );

drop policy "posts: 멤버만 읽기" on public.posts;
drop policy "posts: 멤버가 작성" on public.posts;
drop policy "posts: 작성자만 수정" on public.posts;
create policy "posts: 멤버만 읽기" on public.posts
  for select to authenticated using ((select public.is_member()));
create policy "posts: 멤버가 작성" on public.posts
  for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "posts: 작성자만 수정" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy "comments: 멤버만 읽기" on public.comments;
drop policy "comments: 멤버가 작성" on public.comments;
drop policy "comments: 작성자만 수정" on public.comments;
create policy "comments: 멤버만 읽기" on public.comments
  for select to authenticated using ((select public.is_member()));
create policy "comments: 멤버가 작성" on public.comments
  for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "comments: 작성자만 수정" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy "likes: 멤버만 읽기" on public.likes;
drop policy "likes: 본인만 추가" on public.likes;
drop policy "likes: 본인만 취소" on public.likes;
create policy "likes: 멤버만 읽기" on public.likes
  for select to authenticated using ((select public.is_member()));
create policy "likes: 본인만 추가" on public.likes
  for insert to authenticated
  with check ((select public.is_member()) and profile_id = (select auth.uid()));
create policy "likes: 본인만 취소" on public.likes
  for delete to authenticated using (profile_id = (select auth.uid()));
