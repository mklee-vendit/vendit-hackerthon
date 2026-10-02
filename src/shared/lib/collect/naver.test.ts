import { describe, expect, test } from 'bun:test';
import { OFFICE } from '@/shared/constants/office';
import { offsetMeters } from './geo';
import {
  extractApollo,
  listCandidates,
  mainPhoto,
  menuItems,
  parsePrice,
  pickMatch,
} from './naver';

const html = (state: object) =>
  `<script>window.__APOLLO_STATE__ = ${JSON.stringify(state)};\n  window.__PLACE_STATE__ = {};</script>`;

describe('extractApollo', () => {
  test('SSR 캐시를 읽는다', () => {
    expect(extractApollo(html({ a: { b: 1 } }))).toEqual({ a: { b: 1 } });
  });
  test('없거나 깨졌으면 null', () => {
    expect(extractApollo('<html></html>')).toBeNull();
    expect(
      extractApollo('window.__APOLLO_STATE__ = {;window.__PLACE_STATE__'),
    ).toBeNull();
  });
});

describe('pickMatch', () => {
  const at = (id: string, name: string, eastM: number) => ({
    id,
    name,
    ...offsetMeters(OFFICE, eastM, 0),
  });
  const target = { name: '반포뎅', ...OFFICE };

  test('이름이 맞는 후보 중 가장 가까운 것', () => {
    const got = pickMatch(target, [
      at('far', '반포뎅', 120),
      at('near', '반포뎅 본점', 10),
      at('other', '옆집', 0),
    ]);
    expect(got?.id).toBe('near');
  });
  test('띄어쓰기·기호는 무시한다', () => {
    expect(
      pickMatch({ name: '오빠생각타코&캔카페', ...OFFICE }, [
        at('1', '오빠생각 타코 캔카페', 5),
      ])?.id,
    ).toBe('1');
  });
  test('이름이 다르거나 너무 멀면 null', () => {
    expect(pickMatch(target, [at('1', '옆집', 0)])).toBeNull();
    expect(pickMatch(target, [at('1', '반포뎅', 400)])).toBeNull();
  });
});

describe('parsePrice', () => {
  test('숫자 가격만 받는다', () => {
    expect(parsePrice('12,000원')).toBe(12000);
    expect(parsePrice('9000')).toBe(9000);
    expect(parsePrice('변동')).toBeNull();
    expect(parsePrice('1인 15,000원~')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});

test('메뉴·대표 사진·후보를 뽑는다', () => {
  const state = {
    'PlaceMenuItem:a': {
      name: ' 어묵꼬지 ',
      price: { displayText: '2,000원' },
    },
    'PlaceMenuItem:b': { name: '모둠', price: { displayText: '시가' } },
    'PlaceMenuItem:c': { name: '' },
    'PlaceDetailTopPhotoItem:a': { originalUrl: null },
    'PlaceDetailTopPhotoItem:b': { originalUrl: 'https://x/1.jpg' },
    'PlaceDetailTopPhotoItem:c': { originalUrl: 'https://x/2.jpg' },
    'PlaceListBusinessesItem:9': { id: '9', name: '가게', x: '127', y: '37' },
    'PlaceListBusinessesItem:bad': { id: '8', name: '좌표없음' },
  };
  expect(menuItems(state)).toEqual([
    { name: '어묵꼬지', price: 2000, priceText: '2,000원' },
    { name: '모둠', price: null, priceText: '시가' },
  ]);
  expect(mainPhoto(state)).toBe('https://x/1.jpg');
  expect(listCandidates(state)).toEqual([
    { id: '9', name: '가게', lon: 127, lat: 37 },
  ]);
});
