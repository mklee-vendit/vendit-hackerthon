import type { SearchCriteria } from './types';

/**
 * 후기가 없는 식당을 **섞어서** 보여주기 위한 장치.
 *
 * 도보순으로 고정하면 매번 같은 집만 나와서 "안 가본 집을 꺼내 준다" 는 목적이 성립하지
 * 않는다(§1·§2). 그렇다고 매 요청 무작위로 하면 **같은 조건인데 새로고침마다 결과가
 * 달라진다** — 추천 로직이 "같은 입력이면 같은 순서" 를 지키는 것과 어긋나고, 공유한 링크를
 * 연 사람은 다른 목록을 본다.
 *
 * 그래서 **날짜 + 검색 조건**을 씨앗으로 쓴다. 같은 날 같은 조건이면 몇 번을 눌러도 같은
 * 순서이고, 다음 날이면 다른 집이 앞에 온다.
 */

/** 로컬 시각 기준 `YYYY-MM-DD`. 사무실도 쓰는 사람도 같은 시간대에 있다. */
export function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 조건이 한 글자라도 다르면 다른 씨앗이 된다. 제약 목록은 순서에 흔들리지 않게 정렬한다. */
export function discoverySeed(criteria: SearchCriteria, now: Date): string {
  return [
    localDateKey(now),
    criteria.situation,
    criteria.headcount,
    criteria.budgetPerPerson,
    criteria.maxWalkMinutes,
    [...criteria.dietOptionIds].sort().join('|'),
  ].join(':');
}

/** 문자열 → 32비트 씨앗. 갈라짐이 좋아야 하루 차이로 순서가 확실히 바뀐다. */
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — 작고 결정적인 난수기. 암호용이 아니다. */
function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 씨앗이 같으면 **항상 같은 순서**를 내는 셔플. 원본은 건드리지 않는다.
 * Fisher–Yates 라 모든 순열이 같은 확률로 나온다 — 앞쪽에 쏠리지 않는다.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = randomFrom(hashSeed(seed));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
