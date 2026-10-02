export type CollectionStatus = {
  collectedAt: Date | null;
  restaurantCount: number;
  walkMeasured: number;
  walkFailed: number;
  walkUnmeasured: number;
};

function monthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

/**
 * 검색 화면 맨 아래 줄. **수집 실패를 숨기지 않기 위한 표시다**(§7).
 *
 * "재봤지만 실패" 와 "아직 안 재봤다" 를 구별해서 적는다 — 뭉치면 길이 없는 식당과 측정
 * 스크립트를 안 돌린 상태를 구별할 수 없고, 고칠 방법도 달라진다.
 */
export function collectionNoteText(status: CollectionStatus | null): string {
  if (!status || status.collectedAt === null) {
    return '식당 정보를 아직 수집하지 않았어요';
  }

  const parts = [`식당 정보 ${monthDay(status.collectedAt)} 수집`];
  if (status.walkFailed > 0) {
    parts.push(`도보 경로 실패 ${status.walkFailed}곳`);
  }
  if (status.walkUnmeasured > 0) {
    parts.push(`도보 미측정 ${status.walkUnmeasured}곳`);
  }
  return parts.join(' · ');
}
