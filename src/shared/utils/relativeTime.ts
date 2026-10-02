const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * "2일 전" 같은 상대 시각. 목업(1c·3a)의 표기를 그대로 맞춘다.
 *
 * 4주를 넘기면 **날짜를 그대로 적는다** — "13주 전" 은 사람이 세어 보지 않으면 언제인지
 * 모른다. 미래 시각은 "방금" 으로 둔다(시계 차이로 음수가 나오면 "-1일 전" 이 된다).
 */
export function relativeKo(at: Date, now: Date): string {
  const diff = now.getTime() - at.getTime();
  if (!Number.isFinite(diff)) return '';
  if (diff < MINUTE) return '방금';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}일 전`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}주 전`;

  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
