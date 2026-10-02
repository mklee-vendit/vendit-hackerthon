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
