/**
 * "HH:mm" 시작/종료 사이에 now가 들어 있는지 판정합니다.
 *
 * - `start < end`  : 같은 날 안의 범위 (e.g. 09:00 ~ 18:00)
 * - `start > end`  : 자정 넘김 (e.g. 22:00 ~ 06:00 야간 운영)
 * - `start === end`: 0길이 — true (호출자가 의미 결정)
 * - 경계: start inclusive, end exclusive (18:00이 종료면 17:59:59까지 활성)
 *
 * 입력이 "HH:mm" 형식이 아니면 null 반환 — 호출자가 fallback 결정.
 */
export const isWithinHHMMRange = (
  startAt: string,
  endAt: string,
  now: Date = new Date(),
): boolean | null => {
  const startMin = parseHHMMToMinutes(startAt);
  const endMin = parseHHMMToMinutes(endAt);
  if (startMin === null || endMin === null) return null;

  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (startMin === endMin) return true;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
};

const parseHHMMToMinutes = (hhmm: string): number | null => {
  const [hh, mm] = hhmm.split(':');
  if (!hh || !mm) return null;
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};
