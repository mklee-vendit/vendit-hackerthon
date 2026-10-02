import { describe, expect, test } from 'bun:test';
import { type CollectionStatus, collectionNoteText } from './collectionNote';

const status = (over: Partial<CollectionStatus> = {}): CollectionStatus => ({
  collectedAt: new Date('2026-10-01T03:00:00Z'),
  restaurantCount: 1911,
  walkMeasured: 1911,
  walkFailed: 0,
  walkUnmeasured: 0,
  ...over,
});

describe('collectionNoteText', () => {
  test('수집일을 MM.DD 로 적는다', () => {
    expect(collectionNoteText(status())).toBe('식당 정보 10.01 수집');
  });

  test('수집한 적이 없으면 그렇다고 적는다 — 빈 줄로 두지 않는다', () => {
    expect(collectionNoteText(null)).toBe('식당 정보를 아직 수집하지 않았어요');
    expect(collectionNoteText(status({ collectedAt: null }))).toBe(
      '식당 정보를 아직 수집하지 않았어요',
    );
  });

  test('도보 경로 실패를 숨기지 않는다 (§7)', () => {
    expect(collectionNoteText(status({ walkFailed: 2 }))).toBe(
      '식당 정보 10.01 수집 · 도보 경로 실패 2곳',
    );
  });

  test('"재봤지만 실패" 와 "아직 안 재봤다" 를 구별해서 적는다', () => {
    expect(
      collectionNoteText(status({ walkFailed: 2, walkUnmeasured: 30 })),
    ).toBe('식당 정보 10.01 수집 · 도보 경로 실패 2곳 · 도보 미측정 30곳');
    expect(collectionNoteText(status({ walkUnmeasured: 1911 }))).toBe(
      '식당 정보 10.01 수집 · 도보 미측정 1911곳',
    );
  });

  test('실패·미측정이 0 이면 군더더기를 붙이지 않는다', () => {
    expect(collectionNoteText(status())).not.toContain('·');
  });
});
