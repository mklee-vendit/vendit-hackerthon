import { describe, expect, test } from 'bun:test';
import { OFFICE } from '@/shared/constants/office';
import { offsetMeters } from './geo';
import { collectPlaces, type KakaoPlace, leafCategory } from './places';

const place = (over: Partial<KakaoPlace> & { id: string }): KakaoPlace => ({
  place_name: '가게',
  category_name: '음식점 > 한식',
  x: String(OFFICE.lon),
  y: String(OFFICE.lat),
  ...over,
});

/** 사무실에서 동쪽으로 d 미터 떨어진 장소. */
const at = (id: string, eastM: number): KakaoPlace => {
  const p = offsetMeters(OFFICE, eastM, 0);
  return place({ id, x: String(p.lon), y: String(p.lat) });
};

describe('leafCategory', () => {
  test('전체 경로에서 마지막 조각만 쓴다', () => {
    expect(leafCategory('음식점 > 한식 > 국수')).toBe('국수');
    expect(leafCategory('음식점 > 일식')).toBe('일식');
    expect(leafCategory('음식점')).toBe('음식점');
  });

  test('빈 조각과 공백을 흘리지 않는다', () => {
    expect(leafCategory('음식점 >  > 분식 ')).toBe('분식');
    expect(leafCategory('')).toBe('');
  });
});

describe('collectPlaces', () => {
  test('타일이 겹쳐 같은 식당이 여러 번 와도 한 번만 남는다', () => {
    const got = collectPlaces({
      places: [at('a', 10), at('a', 10), at('a', 10)],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got).toHaveLength(1);
  });

  test('반경 밖은 버린다 — 타일은 원 밖으로 넘치게 깔기 때문', () => {
    const got = collectPlaces({
      places: [at('inside', 600), at('outside', 700)],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got.map((r) => r.kakaoPlaceId)).toEqual(['inside']);
  });

  test('경계값은 포함한다 (≤ radiusM)', () => {
    const got = collectPlaces({
      places: [at('edge', 650)],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got).toHaveLength(1);
  });

  test('좌표가 숫자가 아니면 지어내지 않고 버린다', () => {
    const got = collectPlaces({
      places: [
        place({ id: 'bad-x', x: '', y: '37.5' }),
        place({ id: 'bad-y', x: '127.0', y: 'NaN' }),
        at('good', 5),
      ],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got.map((r) => r.kakaoPlaceId)).toEqual(['good']);
  });

  test('가까운 순으로 정렬한다', () => {
    const got = collectPlaces({
      places: [at('far', 500), at('near', 50), at('mid', 200)],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got.map((r) => r.kakaoPlaceId)).toEqual(['near', 'mid', 'far']);
  });

  test('주소가 빈 문자열이면 null 로 둔다 — 빈 칸과 "없음"을 구별한다', () => {
    const [got] = collectPlaces({
      places: [place({ id: 'a', address_name: '   ', road_address_name: '' })],
      center: OFFICE,
      radiusM: 650,
    });
    expect(got.address).toBeNull();
    expect(got.roadAddress).toBeNull();
  });
});
