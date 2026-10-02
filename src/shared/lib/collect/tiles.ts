import { haversineMeters, type LatLng, offsetMeters } from './geo';

/**
 * 카카오 장소 검색이 한 질의로 **꺼내 줄 수 있는 최대 건수**.
 *
 * 문서상 `page` 최대 45 · `size` 최대 15 라서 675 처럼 보이지만, `meta.pageable_count` 가
 * 45 에서 멈추고 `page=4` 이상은 `page=3` 과 같은 15건을 되돌려준다(실측 —
 * `docs/api-survey.md`). 그래서 **한 질의당 45건이 벽**이고, 반경을 그냥 650m 로 주면
 * 883곳 중 45곳만 받고 838곳이 조용히 사라진다. 타일로 쪼개는 이유가 이것이다.
 */
export const QUERY_CAP = 45;

export type Tile = {
  center: LatLng;
  /** 이 타일이 책임지는 원의 반지름(m). 카카오 `radius` 로 그대로 넘긴다. */
  radiusM: number;
};

/**
 * 반지름 r 인 원은 한 변이 `r√2` 인 정사각형을 품는다. 그래서 정사각형 격자를 깔고 각
 * 칸을 원 하나가 덮게 하면 평면이 빠짐없이 덮인다.
 *
 * 다만 딱 맞추면 **칸 모서리가 원 경계에 정확히 걸린다.** 부동소수에서 그 지점은 반올림
 * 방향에 따라 안이기도 밖이기도 하고, 밖으로 떨어지면 그 좁은 영역의 식당이 조용히 빠진다
 * (실측: `subdivideTile` 의 모서리가 정확히 `r/2` 로 나와 커버리지 테스트가 깨졌다).
 * 그래서 **항상 넘치는 쪽으로 틀린다** — 겹치면 중복이 늘 뿐이고 `collectPlaces` 가 접는다.
 */
const COVER_SAFETY = 0.95;

/**
 * 중심에서 반지름 `radiusM` 인 원을 덮는 타일 목록.
 *
 * 원 **밖으로 넘치게** 덮는다 — 타일이 원 경계를 물고 있으면 그 타일의 검색 결과에 원
 * 안쪽 식당이 들어 있다. 경계 판정은 받은 뒤 `withinRadius` 로 한다.
 */
export function planTiles({
  center,
  radiusM,
  tileRadiusM,
}: {
  center: LatLng;
  radiusM: number;
  tileRadiusM: number;
}): Tile[] {
  if (radiusM <= 0) throw new Error('radiusM 은 0보다 커야 합니다');
  if (tileRadiusM <= 0) throw new Error('tileRadiusM 은 0보다 커야 합니다');

  const spacing = tileRadiusM * Math.SQRT2 * COVER_SAFETY;
  const steps = Math.ceil((radiusM + tileRadiusM) / spacing);

  const tiles: Tile[] = [];
  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iy = -steps; iy <= steps; iy += 1) {
      const tileCenter = offsetMeters(center, ix * spacing, iy * spacing);
      // 원과 닿지 않는 타일은 버린다. 질의 한 번이 그대로 쿼터 한 번이다.
      if (haversineMeters(center, tileCenter) > radiusM + tileRadiusM) continue;
      tiles.push({ center: tileCenter, radiusM: tileRadiusM });
    }
  }
  return tiles;
}

/**
 * 타일 하나를 네 개로 쪼갠다. 결과가 45건을 넘어 **잘렸을 때** 쓴다.
 *
 * 쪼개는 대상은 원이 아니라 그 원이 책임지던 정사각형(한 변 `r√2`)이다. 정사각형을 넷으로
 * 나누면 한 변이 `r√2/2` 이고, 그 칸을 덮는 원의 반지름은 `r/2` 다. 그래서 반지름이
 * 절반인 타일 4개가 원래 칸을 그대로 덮는다 — 쪼개도 빠지는 영역이 없다.
 */
export function subdivideTile(tile: Tile): Tile[] {
  // 모서리가 정확히 r/2 에 걸리므로 반지름을 조금 키워 넘치는 쪽으로 둔다(COVER_SAFETY).
  const half = tile.radiusM / 2 / COVER_SAFETY;
  const offset = (tile.radiusM * Math.SQRT2) / 4;
  return [
    [-offset, -offset],
    [-offset, offset],
    [offset, -offset],
    [offset, offset],
  ].map(([east, north]) => ({
    center: offsetMeters(tile.center, east, north),
    radiusM: half,
  }));
}

/** 받은 결과가 상한에 걸려 잘렸는가. 걸렸으면 더 쪼개야 한다. */
export function isTruncated(totalCount: number, cap: number = QUERY_CAP) {
  return totalCount > cap;
}

export function withinRadius(
  center: LatLng,
  point: LatLng,
  radiusM: number,
): boolean {
  return haversineMeters(center, point) <= radiusM;
}

/**
 * 타일 목록이 원을 정말 덮는지 표본으로 확인한다. 테스트용 — 격자 계산을 고치다가
 * 틈이 생기면 "조용히 빠진 식당"으로만 드러나는데, 그건 눈에 보이지 않는다.
 */
export function findUncoveredPoint({
  tiles,
  center,
  radiusM,
  rings = 24,
  perRing = 180,
}: {
  tiles: Tile[];
  center: LatLng;
  radiusM: number;
  rings?: number;
  perRing?: number;
}): LatLng | null {
  for (let ring = 0; ring <= rings; ring += 1) {
    const r = (radiusM * ring) / rings;
    const count = ring === 0 ? 1 : perRing;
    for (let k = 0; k < count; k += 1) {
      const angle = (2 * Math.PI * k) / count;
      const point = offsetMeters(
        center,
        r * Math.cos(angle),
        r * Math.sin(angle),
      );
      const covered = tiles.some((t) =>
        withinRadius(t.center, point, t.radiusM),
      );
      if (!covered) return point;
    }
  }
  return null;
}
