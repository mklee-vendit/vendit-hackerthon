/**
 * 한 번에 받아 올 행 수. **서버의 `api.max_rows` 보다 크게 잡지 않는다.**
 *
 * Supabase 의 `max_rows` 가 1,000 이라 그냥 `select()` 하면 식당 1,911곳 중 1,000곳만 오고
 * **나머지가 조용히 사라진다**(실측). 잘렸는지 알 방법은 "받은 수가 상한과 같은가" 뿐이다.
 */
export const PAGE_SIZE = 1000;

/** 안전장치. 여기 걸리면 상한이 바뀌었거나 데이터가 폭증한 것이므로 조용히 끊지 않고 던진다. */
export const MAX_PAGES = 20;

export type PageFetcher<T> = (range: {
  from: number;
  to: number;
}) => Promise<T[]>;

/**
 * 짧은 장이 올 때까지 이어서 받는다.
 *
 * **마지막 장이 딱 맞게 끝나는 경우**(총 2,000건, 상한 1,000)에는 한 장을 더 요청해 빈 장을
 * 확인한다. 받은 수가 상한과 같은 것만으로는 끝인지 알 수 없다.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  pageSize: number = PAGE_SIZE,
  maxPages: number = MAX_PAGES,
): Promise<T[]> {
  const all: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const rows = await fetchPage({ from, to: from + pageSize - 1 });
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }

  throw new Error(
    `${maxPages * pageSize}건까지 받았는데 끝이 아닙니다 — 페이지 상한을 확인하세요.`,
  );
}
