import { useSupabaseQuery } from '@/shared/lib/query';
import { supabase } from '@/shared/lib/supabase';
import { relativeKo } from '@/shared/utils/relativeTime';
import { type CollectionStatus, collectionNoteText } from './collectionNote';

type CollectionStatusRow = {
  collected_at: string | null;
  restaurant_count: number | string | null;
  walk_measured: number | string | null;
  walk_failed: number | string | null;
  walk_unmeasured: number | string | null;
};

const count = (value: number | string | null): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** 검색 화면 맨 아래 줄에 쓰는 수집 상태(§7). 숫자는 DB 뷰가 센 값 그대로다. */
export function useCollectionNote() {
  return useSupabaseQuery(
    ['collection-status'],
    () =>
      supabase
        .from('collection_status')
        .select('*')
        .limit(1)
        .returns<CollectionStatusRow[]>(),
    {
      select: (rows): string => {
        const row = rows.at(0);
        if (!row) return collectionNoteText(null);
        const at = row.collected_at ? new Date(row.collected_at) : null;
        const status: CollectionStatus = {
          collectedAt: at && !Number.isNaN(at.getTime()) ? at : null,
          restaurantCount: count(row.restaurant_count),
          walkMeasured: count(row.walk_measured),
          walkFailed: count(row.walk_failed),
          walkUnmeasured: count(row.walk_unmeasured),
        };
        return collectionNoteText(status);
      },
      staleTime: 60_000,
    },
  );
}

type LatestReviewRow = {
  restaurant_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
};

/**
 * 추천픽의 **최근 후기 원문 1개**. §6 이 추천 근거로 요구하는 것이고, 문장을 만들지 않고
 * 원문을 그대로 보여준다(§10.2).
 *
 * 식당별 "가장 최근 1건" 을 PostgREST 로 직접 뽑을 수 없어, 최신순으로 받아 **처음 나온 것만**
 * 남긴다. 추천픽은 몇 곳뿐이라 이 방식으로 충분하다.
 */
export function useLatestReviews(restaurantIds: string[], now: Date) {
  const ids = [...restaurantIds].sort();
  return useSupabaseQuery(
    ['latest-reviews', ids.join(',')],
    () =>
      supabase
        .from('reviews')
        .select('restaurant_id, body, created_at, profiles(display_name)')
        .in('restaurant_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, ids.length) * 10)
        .returns<LatestReviewRow[]>(),
    {
      enabled: ids.length > 0,
      select: (rows) => {
        const map = new Map<
          string,
          { body: string; author: string; when: string }
        >();
        for (const row of rows) {
          if (map.has(row.restaurant_id)) continue;
          map.set(row.restaurant_id, {
            body: row.body,
            author: row.profiles?.display_name ?? '',
            when: relativeKo(new Date(row.created_at), now),
          });
        }
        return map;
      },
    },
  );
}
