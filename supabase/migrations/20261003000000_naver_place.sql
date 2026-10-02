-- 네이버 플레이스에서 가져온 메뉴판과 대표 사진 1장. `bun run collect:naver` 가 채운다.
--
-- 후기 메뉴(`review_menu_items`)와 섞지 않는다 — 그쪽은 벤더가 먹은 값이고 1인 가격 집계의
-- 단일 기준이다(§8). 이쪽은 가게가 내건 메뉴판일 뿐이라 따로 둔다.

create table public.restaurant_naver (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  -- null = 이름·좌표가 맞는 네이버 업체를 못 찾음. 행이 없으면 아직 시도 안 함.
  naver_place_id text,
  photo_url text,
  collected_at timestamptz not null default now()
);

create table public.naver_menu_items (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  position int not null,
  name text not null,
  -- null = "시가"·"변동" 처럼 숫자가 아닌 가격. 원문은 price_text 에 그대로.
  price int,
  price_text text,
  primary key (restaurant_id, position)
);

alter table public.restaurant_naver enable row level security;
alter table public.naver_menu_items enable row level security;
revoke all on public.restaurant_naver from anon, authenticated;
revoke all on public.naver_menu_items from anon, authenticated;
grant select on public.restaurant_naver to authenticated;
grant select on public.naver_menu_items to authenticated;

create policy "restaurant_naver: 멤버만 읽기" on public.restaurant_naver
  for select to authenticated using (public.is_member());
create policy "naver_menu_items: 멤버만 읽기" on public.naver_menu_items
  for select to authenticated using (public.is_member());
