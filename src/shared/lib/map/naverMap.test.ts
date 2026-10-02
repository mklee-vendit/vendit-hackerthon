import { describe, expect, test } from 'bun:test';
import { naverDirectionsUrl, naverMapTarget, naverPlaceUrl } from './naverMap';

describe('naverDirectionsUrl', () => {
  test('좌표와 이름으로 도보 경로 주소를 만든다', () => {
    expect(naverDirectionsUrl('한솔밥상', 127.0212, 37.5056)).toBe(
      'https://map.naver.com/p/directions/-/127.0212,37.5056,%ED%95%9C%EC%86%94%EB%B0%A5%EC%83%81/-/walk',
    );
  });

  test('이름의 쉼표와 슬래시를 바꿔 경로 칸이 밀리지 않게 한다', () => {
    const url = naverDirectionsUrl('김밥, 라면/우동', 127, 37) ?? '';
    expect(url.split('/-/')[1]).toBe(
      '127,37,%EA%B9%80%EB%B0%A5%2C%20%EB%9D%BC%EB%A9%B4%2F%EC%9A%B0%EB%8F%99',
    );
  });

  // 좌표가 없으면 **버튼 자체를 그리지 않기 위해** null 이다. 0,0 으로 보내면 적도 한가운데로
  // 길을 안내한다.
  test('좌표가 없으면 null', () => {
    expect(naverDirectionsUrl('가게', null, 37.5)).toBeNull();
    expect(naverDirectionsUrl('가게', 127, null)).toBeNull();
    expect(naverDirectionsUrl('가게', Number.NaN, 37.5)).toBeNull();
  });
});

describe('naverPlaceUrl', () => {
  test('place id 로 업체 페이지 주소를 만든다', () => {
    expect(naverPlaceUrl('1365187804')).toBe(
      'https://map.naver.com/p/entry/place/1365187804',
    );
  });

  // 모양이 다르면 엉뚱한 페이지로 보내는 것보다 버튼이 없는 게 낫다.
  test('없거나 숫자가 아니면 null', () => {
    expect(naverPlaceUrl(null)).toBeNull();
    expect(naverPlaceUrl('')).toBeNull();
    expect(naverPlaceUrl('abc')).toBeNull();
    expect(naverPlaceUrl('13651878/04')).toBeNull();
  });
});

describe('naverMapTarget', () => {
  const place = { name: '한솔밥상', lon: 127.0212, lat: 37.5056 };

  test('업체 페이지가 1순위', () => {
    expect(naverMapTarget({ ...place, naverPlaceId: '123' })).toEqual({
      url: 'https://map.naver.com/p/entry/place/123',
      kind: 'place',
    });
  });

  test('네이버 업체를 못 찾았으면 좌표 길찾기로 보낸다', () => {
    expect(naverMapTarget({ ...place, naverPlaceId: null })).toEqual({
      url: naverDirectionsUrl(place.name, place.lon, place.lat) as string,
      kind: 'directions',
    });
  });

  test('둘 다 없으면 null — 버튼을 그리지 않는다', () => {
    expect(
      naverMapTarget({
        name: '가게',
        lon: null,
        lat: null,
        naverPlaceId: null,
      }),
    ).toBeNull();
  });
});
