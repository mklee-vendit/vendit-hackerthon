-- 후기 사진.
--
-- §9 는 원래 "사진 첨부 없음(텍스트 전용 → 스토리지 비용 없음)" 이었다. 비용을 재 보고
-- 뒤집은 결정이다(jhey, 2026-10-02) — 클라이언트에서 1280px WebP 로 줄이면 장당 약 250KB
-- 라서 500장이 125MB, Free 1GB 의 12% 다.
--
-- **비용은 저장이 아니라 전송에서 난다.** Free egress 가 월 5GB 인데 카드마다 사진을 띄우면
-- 조회할 때마다 나간다. 그래서 파일 이름을 내용과 함께 고정하고 긴 캐시를 건다 —
-- 사진은 바뀌지 않으므로 사용자당 한 번만 내려가면 된다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  -- 공개 버킷이 아니다. 멤버만 보게 하려면 서명 URL 로 내보내야 한다(§10.8).
  false,
  -- 클라이언트가 줄여서 올린다. 그래도 넘치면 **서버가 거절한다** — 줄이기를 빠뜨린 코드가
  -- 조용히 4MB 짜리를 올리는 것을 막는다.
  2 * 1024 * 1024,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  /** 버킷 안의 경로. `{auth.uid()}/{review_id}/{uuid}.webp` */
  storage_path text not null unique,
  width integer check (width > 0),
  height integer check (height > 0),
  byte_size integer check (byte_size > 0),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index review_photos_by_review on public.review_photos (review_id);

alter table public.review_photos enable row level security;
revoke all on public.review_photos from anon, authenticated;
grant select on public.review_photos to authenticated;
grant insert (review_id, storage_path, width, height, byte_size, position)
  on public.review_photos to authenticated;
grant delete on public.review_photos to authenticated;

create policy "review_photos: 멤버만 읽기" on public.review_photos
  for select to authenticated using ((select public.is_member()));
create policy "review_photos: 내 후기에만 추가" on public.review_photos
  for insert to authenticated with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.author_id = (select auth.uid())
        and r.deleted_at is null
    )
  );
create policy "review_photos: 내 후기에서만 제거" on public.review_photos
  for delete to authenticated using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.author_id = (select auth.uid())
    )
  );

-- ── 버킷 권한 ───────────────────────────────────────────────────────────────
-- 경로 첫 칸이 올린 사람의 id 다. 남의 칸에는 못 쓴다.

create policy "review-photos: 멤버만 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'review-photos' and (select public.is_member()));

create policy "review-photos: 본인 폴더에만 업로드" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (select public.is_member())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "review-photos: 본인 것만 삭제" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

/*
 * 후기를 지우면 사진 **행도 지운다.** 본문을 비우는 것과 같은 이유다 — 지운 글의 내용이
 * 읽히면 안 된다(§9).
 *
 * **스토리지의 파일 자체는 여기서 지우지 못한다.** DB 트리거가 S3 를 건드릴 수 없기 때문이고,
 * 그래서 파일은 남는다. 지금은 그 사실을 적어 두는 선에서 멈춘다 — 남은 파일은 경로를 아는
 * 사람만 서명 URL 로 볼 수 있고 화면 어디에도 연결되지 않는다. 주기적으로 치우는 일은
 * 따로 만들어야 한다(docs/next-steps.md).
 */
create or replace function public.reviews_cleanup_photos()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.review_photos where review_id = new.id;
  end if;
  return new;
end;
$fn$;

create trigger reviews_cleanup_photos
  after update on public.reviews
  for each row execute function public.reviews_cleanup_photos();

revoke execute on function public.reviews_cleanup_photos() from anon, authenticated, public;

/*
 * 식당 카드에 쓸 사진 한 장 — **가장 최근 후기의 첫 사진**이다.
 *
 * 카드가 한 장만 쓰므로 여기서 한 장으로 줄인다. 목록이 1,911행이라 전부 내보내면 쓰지도
 * 않을 경로가 그대로 전송량이 된다.
 */
create view public.restaurant_photo with (security_invoker = true) as
select distinct on (rv.restaurant_id)
  rv.restaurant_id,
  p.storage_path,
  p.width,
  p.height
from public.review_photos p
join public.reviews rv on rv.id = p.review_id and rv.deleted_at is null
order by rv.restaurant_id, rv.created_at desc, p.position, p.id;

revoke all on public.restaurant_photo from anon, authenticated;
grant select on public.restaurant_photo to authenticated;
