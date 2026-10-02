import type { LatLng } from './geo';

/**
 * 보행 속도(km/h). **TMAP 실측에 맞춘 보정값이고 임의로 고른 수가 아니다.**
 *
 * Valhalla 기본값 5.1km/h 는 TMAP 보다 평균 10% 빠르게 나온다(같은 식당 8곳 대조).
 * 4.6 으로 맞추면 평균 편차 -0.4% · 절대편차 9.5% 로 줄고, **5·10·15·20분 상한 판정이
 * 갈린 것은 32번 중 1번**이다. 측정 표는 `docs/api-survey.md` 에 있다.
 *
 * TMAP 에 맞추는 이유는 그게 더 "정확" 해서가 아니라, 사용자가 직접 확인할 때 보는 값이
 * 국내 지도 앱이기 때문이다.
 */
export const WALKING_SPEED_KMH = 4.6;

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

/**
 * 공개 인스턴스의 공정사용 한도. **1 call/sec 를 넘기지 않는다** — 자원봉사로 운영되는
 * 서비스이고, 문서가 대량 요청은 자체 호스팅을 권한다.
 */
export const VALHALLA_MIN_INTERVAL_MS = 1_000;

export type WalkMeasurement = {
  seconds: number;
  distanceM: number;
};

export type WalkResult =
  | { ok: true; value: WalkMeasurement }
  | { ok: false; failure: string };

type ValhallaResponse = {
  trip?: { summary?: { time?: number; length?: number } };
  error?: string;
  error_code?: number;
};

export function valhallaRequestUrl(from: LatLng, to: LatLng): string {
  const body = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing: 'pedestrian',
    costing_options: { pedestrian: { walking_speed: WALKING_SPEED_KMH } },
    units: 'kilometers',
  };
  return `${VALHALLA_URL}?json=${encodeURIComponent(JSON.stringify(body))}`;
}

/**
 * Valhalla 응답에서 도보 시간·거리를 뽑는다. **실패를 성공으로 둥글리지 않는다**(§7·§10.5)
 * — 경로를 못 찾은 것과 0초인 것은 다르고, 전자는 화면에 도보 "—" 로 나가야 한다.
 */
export function parseValhalla(status: number, body: unknown): WalkResult {
  if (status !== 200) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as ValhallaResponse).error)
        : '';
    return {
      ok: false,
      failure: `HTTP ${status}${message ? `: ${message}` : ''}`,
    };
  }

  const summary = (body as ValhallaResponse)?.trip?.summary;
  const seconds = summary?.time;
  const lengthKm = summary?.length;

  if (
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return { ok: false, failure: '경로 없음' };
  }

  return {
    ok: true,
    value: {
      seconds: Math.round(seconds),
      // length 가 없으면 0 으로 메우지 않는다 — 거리는 표시용이고, 없으면 없는 것이다.
      distanceM:
        typeof lengthKm === 'number' && Number.isFinite(lengthKm)
          ? Math.round(lengthKm * 1000)
          : 0,
    },
  };
}
