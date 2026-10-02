import { supabase } from '@/shared/lib/supabase';

const BUCKET = 'review-photos';

/**
 * 버킷 경로 → 브라우저가 쓸 URL.
 *
 * **서명 URL 이 아니라 공개 URL 이다.** 서명 URL 은 만료가 있어 캐시를 깨고, 사진 비용의
 * 대부분은 저장이 아니라 전송이다(§ `docs/api-survey.md` · 마이그레이션 주석).
 */
export function photoPublicUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
