import { describe, expect, test } from 'bun:test';
import { naverDirectionsUrl } from './naverDirections';

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
