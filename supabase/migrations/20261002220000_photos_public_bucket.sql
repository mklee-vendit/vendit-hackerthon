-- 사진 버킷을 공개로 바꾼다.
--
-- 비공개로 두면 서명 URL 로 내보내야 하는데, **서명 URL 은 만료가 있어서 캐시를 깬다.**
-- 사진 비용의 대부분은 저장이 아니라 전송(Free egress 월 5GB)이고, 그 비용을 줄이는 수단이
-- "한 번 받으면 다시 안 받는 것" 이다. 만료마다 다시 받으면 그 수단이 사라진다.
--
-- 맞바꾸는 것: 경로를 아는 사람은 로그인 없이 볼 수 있다. 경로가
-- `{uuid}/{uuid}/{uuid}.webp` 라 사실상 추측할 수 없고, 올리는 것은 여전히 RLS 가 막는다.
-- **식당 사진이라 민감하지 않다**는 판단이 깔려 있다 — 사람이 찍힌 사진을 올리기 시작하면
-- 이 판단을 다시 봐야 한다.
update storage.buckets set public = true where id = 'review-photos';

-- 공개 버킷이어도 **쓰기 정책은 그대로다**. 읽기 정책만 의미가 없어진다.
drop policy if exists "review-photos: 멤버만 조회" on storage.objects;
