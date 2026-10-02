import { haversineMeters, type LatLng } from './geo';

/** 카카오 장소 검색 응답 한 건에서 우리가 쓰는 부분. */
export type KakaoPlace = {
  id: string;
  place_name: string;
  category_name: string;
  address_name?: string;
  road_address_name?: string;
  x: string;
  y: string;
};

/** `restaurants` 한 행. */
export type CollectedRestaurant = {
  kakaoPlaceId: string;
  name: string;
  category: string;
  address: string | null;
  roadAddress: string | null;
  lon: number;
  lat: number;
  /** 사무실에서의 직선거리(m). 저장하지 않고 수집 리포트에만 쓴다 — 판정은 도보 시간이다. */
  straightM: number;
};

/**
 * 카카오 `category_name` 은 `"음식점 > 한식 > 국수"` 처럼 전체 경로로 온다.
 * 화면에 쓰는 건 마지막 조각이다(목업 1c 의 "한식·솥밥" 자리).
 */
export function leafCategory(categoryName: string): string {
  const parts = categoryName
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? '';
}

/**
 * 타일이 겹치므로 같은 식당이 여러 번 온다. `id` 로 접고, **반경 밖은 버린다**.
 *
 * 타일은 원 밖으로 넘치게 깔았으므로(planTiles) 걸러내지 않으면 650m 밖 식당이 섞인다.
 * 거리는 평면 근사가 아니라 haversine 으로 다시 재서 경계에서 흔들리지 않게 한다.
 */
export function collectPlaces({
  places,
  center,
  radiusM,
}: {
  places: KakaoPlace[];
  center: LatLng;
  radiusM: number;
}): CollectedRestaurant[] {
  const byId = new Map<string, CollectedRestaurant>();

  for (const place of places) {
    const lon = Number(place.x);
    const lat = Number(place.y);
    // 좌표가 숫자가 아니면 **지어내지 않고 버린다**(§10.2). 리포트에서 개수로 드러난다.
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    const straightM = haversineMeters(center, { lon, lat });
    if (straightM > radiusM) continue;

    byId.set(place.id, {
      kakaoPlaceId: place.id,
      name: place.place_name,
      category: leafCategory(place.category_name),
      address: place.address_name?.trim() || null,
      roadAddress: place.road_address_name?.trim() || null,
      lon,
      lat,
      straightM,
    });
  }

  return [...byId.values()].sort((a, b) => a.straightM - b.straightM);
}
