import { describe, expect, test } from 'bun:test';
import { OFFICE } from '@/shared/constants/office';
import { haversineMeters, offsetMeters } from './geo';
import {
  findUncoveredPoint,
  isTruncated,
  planTiles,
  QUERY_CAP,
  subdivideTile,
  withinRadius,
} from './tiles';

describe('planTiles', () => {
  test('반경 650m 를 빠짐없이 덮는다', () => {
    const tiles = planTiles({
      center: OFFICE,
      radiusM: 650,
      tileRadiusM: 120,
    });
    // 틈이 생기면 그 영역 식당이 조용히 빠진다 — 숫자로 확인한다.
    expect(
      findUncoveredPoint({ tiles, center: OFFICE, radiusM: 650 }),
    ).toBeNull();
  });

  test('타일 반지름을 바꿔도 덮는다', () => {
    for (const tileRadiusM of [60, 100, 150, 300]) {
      const tiles = planTiles({ center: OFFICE, radiusM: 650, tileRadiusM });
      expect(
        findUncoveredPoint({ tiles, center: OFFICE, radiusM: 650 }),
      ).toBeNull();
    }
  });

  test('원에 닿지 않는 타일은 만들지 않는다', () => {
    const radiusM = 650;
    const tileRadiusM = 120;
    const tiles = planTiles({ center: OFFICE, radiusM, tileRadiusM });
    for (const tile of tiles) {
      expect(haversineMeters(OFFICE, tile.center)).toBeLessThanOrEqual(
        radiusM + tileRadiusM + 1,
      );
    }
  });

  test('타일 수가 질의 쿼터에 비해 현실적이다', () => {
    const tiles = planTiles({ center: OFFICE, radiusM: 650, tileRadiusM: 120 });
    // 카카오 일 10만 쿼터 기준으로는 아무 문제가 없는 규모여야 한다.
    expect(tiles.length).toBeGreaterThan(20);
    expect(tiles.length).toBeLessThan(200);
  });

  test('반지름이 0 이하면 조용히 넘기지 않고 던진다', () => {
    expect(() =>
      planTiles({ center: OFFICE, radiusM: 0, tileRadiusM: 100 }),
    ).toThrow();
    expect(() =>
      planTiles({ center: OFFICE, radiusM: 650, tileRadiusM: 0 }),
    ).toThrow();
  });
});

describe('subdivideTile', () => {
  const tile = { center: OFFICE, radiusM: 200 };

  test('넷으로 쪼개고 반지름이 절반이 된다', () => {
    const parts = subdivideTile(tile);
    expect(parts).toHaveLength(4);
    // 모서리 걸침을 피하려고 반지름을 살짝 키운다 — 절반보다 크고, 원본보다는 작다.
    for (const part of parts) {
      expect(part.radiusM).toBeGreaterThan(100);
      expect(part.radiusM).toBeLessThan(tile.radiusM);
    }
  });

  test('쪼갠 뒤에도 원래 타일이 책임지던 영역에 틈이 없다', () => {
    const parts = subdivideTile(tile);
    // 원래 타일이 보장하던 것은 "한 변 r√2 인 정사각형" 이다. 그 정사각형을 촘촘히 훑는다.
    const halfSide = (tile.radiusM * Math.SQRT2) / 2;
    const steps = 40;
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const east = -halfSide + (2 * halfSide * i) / steps;
        const north = -halfSide + (2 * halfSide * j) / steps;
        const point = offsetMeters(tile.center, east, north);
        const covered = parts.some((p) =>
          withinRadius(p.center, point, p.radiusM),
        );
        expect(covered).toBe(true);
      }
    }
  });

  test('계속 쪼개도 반지름이 0 으로 무너지지 않는다', () => {
    let current = [tile];
    for (let depth = 0; depth < 4; depth += 1) {
      current = current.flatMap(subdivideTile);
    }
    expect(current).toHaveLength(256);
    // 네 번 쪼개면 반지름이 1/16 근처로 줄되 0 으로 무너지지 않는다.
    expect(current[0].radiusM).toBeGreaterThan(200 / 16);
    expect(current[0].radiusM).toBeLessThan(200 / 8);
  });
});

describe('isTruncated', () => {
  test('상한을 넘으면 잘린 것으로 본다', () => {
    expect(isTruncated(QUERY_CAP)).toBe(false);
    expect(isTruncated(QUERY_CAP + 1)).toBe(true);
    expect(isTruncated(0)).toBe(false);
  });
});
