import { haversineMeters, type LatLng } from './geo';

/**
 * 네이버 플레이스 페이지(pcmap.place.naver.com)의 SSR HTML 에서 메뉴·대표 사진을 뽑는다.
 *
 * 공식 API 가 아니다. 페이지가 `window.__APOLLO_STATE__ = {...};` 로 심어 두는 캐시를
 * 읽는다 — 키 이름(`PlaceListBusinessesItem` · `PlaceMenuItem` · `PlaceDetailTopPhotoItem`)은
 * 2026-10-02 실측이고, 바뀌면 전부 0건이 되므로 스크립트가 0건 비율로 알린다.
 */
export type ApolloState = Record<string, Record<string, unknown>>;

export function extractApollo(html: string): ApolloState | null {
  const m = html.match(
    /window\.__APOLLO_STATE__\s*=\s*(\{.*?\});\s*window\.__PLACE_STATE__/s,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as ApolloState;
  } catch {
    return null;
  }
}

const entries = (state: ApolloState, prefix: string) =>
  Object.entries(state)
    .filter(([k]) => k.startsWith(`${prefix}:`))
    .map(([, v]) => v);

export type NaverCandidate = LatLng & { id: string; name: string };

export function listCandidates(state: ApolloState): NaverCandidate[] {
  return entries(state, 'PlaceListBusinessesItem').flatMap((v) => {
    const lon = Number(v.x);
    const lat = Number(v.y);
    if (!v.id || !v.name || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      return [];
    }
    return [{ id: String(v.id), name: String(v.name), lon, lat }];
  });
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[\s()[\]·&.,'"!\-_/]/g, '');

/**
 * 이름이 같거나 한쪽이 다른 쪽을 품고, 카카오 좌표에서 MATCH_RADIUS_M 안인 후보 중 가장 가까운 것.
 * 어긋나면 null — 엉뚱한 식당의 메뉴를 붙이느니 비워 둔다.
 */
export const MATCH_RADIUS_M = 150;

export function pickMatch(
  target: LatLng & { name: string },
  candidates: NaverCandidate[],
): NaverCandidate | null {
  const want = normalize(target.name);
  let best: { c: NaverCandidate; d: number } | null = null;
  for (const c of candidates) {
    const got = normalize(c.name);
    if (!got || !(got === want || got.includes(want) || want.includes(got))) {
      continue;
    }
    const d = haversineMeters(target, c);
    if (d <= MATCH_RADIUS_M && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}

/** "12,000원" → 12000. "변동"·"시가"·빈 값은 null(가격을 지어내지 않는다). */
export function parsePrice(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits || !/^[\d,\s]+원?$/.test(text.trim())) return null;
  return Number(digits);
}

export type NaverMenuItem = {
  name: string;
  price: number | null;
  priceText: string | null;
};

export function menuItems(state: ApolloState): NaverMenuItem[] {
  return entries(state, 'PlaceMenuItem').flatMap((v) => {
    const name = typeof v.name === 'string' ? v.name.trim() : '';
    if (!name) return [];
    const text = (v.price as { displayText?: string } | null)?.displayText;
    return [{ name, price: parsePrice(text), priceText: text?.trim() || null }];
  });
}

/** 상단 사진 띠의 첫 장. 캐시의 키 순서가 화면 순서다(2026-10-02 실측, 순번 필드 없음). */
export function mainPhoto(state: ApolloState): string | null {
  const first = entries(state, 'PlaceDetailTopPhotoItem').find(
    (v) => typeof v.originalUrl === 'string' && v.originalUrl,
  );
  return (first?.originalUrl as string | undefined) ?? null;
}
