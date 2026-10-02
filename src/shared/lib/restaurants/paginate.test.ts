import { describe, expect, test } from 'bun:test';
import { fetchAllPages, type PageFetcher } from './paginate';

/** 전체 n 건을 가진 가짜 서버. 요청한 범위를 상한만큼 잘라서 돌려준다. */
const fakeServer = (total: number, pageSize: number) => {
  const ranges: { from: number; to: number }[] = [];
  const fetchPage: PageFetcher<number> = async ({ from, to }) => {
    ranges.push({ from, to });
    const end = Math.min(to + 1, total);
    return Array.from(
      { length: Math.max(0, end - from) },
      (_, i) => from + i,
    ).slice(0, pageSize);
  };
  return { fetchPage, ranges };
};

describe('fetchAllPages', () => {
  test('상한에 걸려 잘린 응답을 이어 받아 전부 모은다', async () => {
    const { fetchPage, ranges } = fakeServer(1911, 1000);
    const rows = await fetchAllPages(fetchPage, 1000);
    // 1,000 에서 멈추면 911곳이 조용히 사라진다 — 그게 이 함수가 막는 것이다.
    expect(rows).toHaveLength(1911);
    expect(ranges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  test('한 장에 다 들어오면 한 번만 요청한다', async () => {
    const { fetchPage, ranges } = fakeServer(42, 1000);
    expect(await fetchAllPages(fetchPage, 1000)).toHaveLength(42);
    expect(ranges).toHaveLength(1);
  });

  test('딱 맞게 끝나면 빈 장을 한 번 더 확인한다 — 같은 수만으로는 끝인지 모른다', async () => {
    const { fetchPage, ranges } = fakeServer(2000, 1000);
    expect(await fetchAllPages(fetchPage, 1000)).toHaveLength(2000);
    expect(ranges).toHaveLength(3);
    expect(ranges.at(-1)).toEqual({ from: 2000, to: 2999 });
  });

  test('0건이면 빈 배열', async () => {
    const { fetchPage } = fakeServer(0, 1000);
    expect(await fetchAllPages(fetchPage, 1000)).toEqual([]);
  });

  test('상한을 넘으면 조용히 끊지 않고 던진다', async () => {
    const { fetchPage } = fakeServer(10_000, 10);
    await expect(fetchAllPages(fetchPage, 10, 3)).rejects.toThrow(
      /끝이 아닙니다/,
    );
  });

  test('실패는 그대로 올린다 — 반쪽 결과를 성공으로 넘기지 않는다', async () => {
    let calls = 0;
    const fetchPage: PageFetcher<number> = async () => {
      calls += 1;
      if (calls === 2) throw new Error('네트워크 끊김');
      return Array.from({ length: 1000 }, (_, i) => i);
    };
    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow(
      '네트워크 끊김',
    );
  });
});
