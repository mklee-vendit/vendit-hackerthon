import { describe, expect, test } from 'bun:test';
import { OFFICE } from '@/shared/constants/office';
import { parseValhalla, valhallaRequestUrl, WALKING_SPEED_KMH } from './walk';

describe('valhallaRequestUrl', () => {
  test('보행 프로파일과 보정한 보행속도를 싣는다', () => {
    const url = valhallaRequestUrl(OFFICE, { lon: 127.03, lat: 37.51 });
    const json = JSON.parse(
      decodeURIComponent(new URL(url).search.replace('?json=', '')),
    );
    expect(json.costing).toBe('pedestrian');
    expect(json.costing_options.pedestrian.walking_speed).toBe(
      WALKING_SPEED_KMH,
    );
    expect(json.locations).toEqual([
      { lat: OFFICE.lat, lon: OFFICE.lon },
      { lat: 37.51, lon: 127.03 },
    ]);
  });
});

describe('parseValhalla', () => {
  const ok = { trip: { summary: { time: 528.208, length: 0.687 } } };

  test('초는 반올림하고 km 는 m 로 바꾼다', () => {
    expect(parseValhalla(200, ok)).toEqual({
      ok: true,
      value: { seconds: 528, distanceM: 687 },
    });
  });

  test('HTTP 오류는 실패로 — 사유에 코드가 남는다', () => {
    const r = parseValhalla(429, { error: 'Too many requests' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.failure).toContain('429');
    expect(r.ok === false && r.failure).toContain('Too many requests');
  });

  test('경로를 못 찾으면 0초로 둥글리지 않고 실패로 둔다', () => {
    for (const body of [
      {},
      { trip: {} },
      { trip: { summary: {} } },
      { trip: { summary: { time: 0 } } },
      { trip: { summary: { time: Number.NaN } } },
      null,
    ]) {
      const r = parseValhalla(200, body);
      expect(r.ok).toBe(false);
    }
  });

  test('거리가 없어도 시간이 있으면 성공이다 — 거리는 표시용', () => {
    const r = parseValhalla(200, { trip: { summary: { time: 100 } } });
    expect(r).toEqual({ ok: true, value: { seconds: 100, distanceM: 0 } });
  });

  test('보정한 보행속도는 TMAP 기본(5.1)보다 느리다', () => {
    // 이 값이 5.1 로 되돌아가면 TMAP 대비 평균 10% 빠르게 나온다(측정 근거는 주석).
    expect(WALKING_SPEED_KMH).toBeLessThan(5.1);
    expect(WALKING_SPEED_KMH).toBeGreaterThan(4);
  });
});
