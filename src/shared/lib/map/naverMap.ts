/**
 * 네이버 지도 "길찾기" 링크.
 *
 * **형식에 문서가 없어서 네이버 서버에 물어 확인했다**(2026-10-02 실측):
 * `/p/directions/-/{lon},{lat},{이름}/-/walk` 를 요청하면 301 로
 * `?elng=…&elat=…&eText=…&menu=route&routeType=4&pathType=3` 으로 바뀐다 — 즉 네이버 자신이
 * 이 경로를 도보 경로로 읽는다. 목업의 초록 버튼에는 주소가 적혀 있지 않았다(*"길찾기 누른
 * 식당 등은 확인 필요"* 메모만 있었다).
 *
 * 출발지는 `-` 로 비운다. 사용자의 현재 위치를 우리가 모르고, 사무실로 못박으면 퇴근길이나
 * 주말에 연 사람에게 거짓말이 된다 — 네이버가 자기 쪽에서 출발지를 받는다.
 */
export function naverDirectionsUrl(
  name: string,
  lon: number | null,
  lat: number | null,
): string | null {
  if (lon === null || lat === null) return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  // 이름에 쉼표나 `/` 가 들어가면 경로 칸이 밀린다. `encodeURIComponent` 가 둘 다 바꾼다.
  const label = encodeURIComponent(name.normalize('NFC'));
  return `https://map.naver.com/p/directions/-/${lon},${lat},${label}/-/walk`;
}

/**
 * 네이버 **업체 페이지**. 메뉴·사진·리뷰가 있고 그 안에 길찾기 버튼도 있다.
 *
 * 실측(2026-10-02): `/p/entry/place/{id}` → 301 →
 * `?pinId={id}&pinType=site&menu=location&appTargetPage=place`.
 *
 * id 는 네이버가 주는 숫자 문자열이다. 모양이 다르면 **주소를 만들지 않는다** — 엉뚱한
 * 페이지로 보내는 것보다 버튼이 없는 게 낫다.
 */
export function naverPlaceUrl(placeId: string | null): string | null {
  if (!placeId || !/^\d+$/.test(placeId)) return null;
  return `https://map.naver.com/p/entry/place/${placeId}`;
}

export type NaverMapTarget = {
  url: string;
  /** 업체 페이지인지 경로 화면인지. 화면이 라벨을 가른다 */
  kind: 'place' | 'directions';
};

/**
 * 카드의 네이버 버튼이 갈 곳.
 *
 * 업체 페이지가 1순위다 — 사람이 보고 싶은 건 그 가게다. 네이버 업체를 못 찾은 식당은
 * **좌표 길찾기**로 보낸다. 이름 검색으로 때우지 않는 이유: 같은 체인의 다른 지점으로 갈 수
 * 있고, 좌표를 같이 넘겨도 네이버가 리다이렉트에서 버린다(실측). 좌표는 전 식당에 있다.
 */
export function naverMapTarget({
  name,
  lon,
  lat,
  naverPlaceId,
}: {
  name: string;
  lon: number | null;
  lat: number | null;
  naverPlaceId: string | null;
}): NaverMapTarget | null {
  const place = naverPlaceUrl(naverPlaceId);
  if (place) return { url: place, kind: 'place' };

  const directions = naverDirectionsUrl(name, lon, lat);
  return directions ? { url: directions, kind: 'directions' } : null;
}
