export type LatLng = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** 두 점 사이의 **직선** 거리(m). 도보 거리가 아니다 — 후보를 좁히는 데만 쓴다(§7). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 원점에서 동/북으로 미터만큼 옮긴 좌표.
 *
 * 평면 근사다. 우리가 다루는 범위는 사무실 기준 1km 안쪽이고 그 안에서 위도 1도는
 * 약 111km, 경도 1도는 `111km × cos(위도)` 로 봐도 오차가 미터 미만이다. 구면 정확도가
 * 필요한 계산(최종 거리 판정)은 `haversineMeters` 로 한다.
 */
export function offsetMeters(
  origin: LatLng,
  eastM: number,
  northM: number,
): LatLng {
  const latPerM = 1 / (EARTH_RADIUS_M * DEG);
  const lonPerM = latPerM / Math.cos(origin.lat * DEG);
  return {
    lat: origin.lat + northM * latPerM,
    lon: origin.lon + eastM * lonPerM,
  };
}
