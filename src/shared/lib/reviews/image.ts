/**
 * 올리기 전에 줄일 긴 변 길이(px). 카드가 390px 폭이고 2배 화면을 고려해도 1280 이면 충분하다.
 *
 * 폰 사진은 4,000px · 4MB 쯤 된다. 그대로 올리면 **전송 비용이 16배**가 되고(Free egress
 * 월 5GB), 버킷의 2MB 상한에도 걸린다.
 */
export const MAX_EDGE_PX = 1280;

/** WebP 품질. 0.8 이면 사진 한 장이 대략 200~300KB 다. */
export const WEBP_QUALITY = 0.8;

/**
 * 긴 변을 `max` 에 맞춘 크기. **원본보다 키우지 않는다** — 작은 사진을 늘리면 용량만 늘고
 * 화질은 그대로다.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_EDGE_PX,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('이미지 크기를 읽을 수 없습니다');
  }
  if (width <= 0 || height <= 0) {
    throw new Error('이미지 크기가 0 이하입니다');
  }

  const longest = Math.max(width, height);
  if (longest <= max)
    return { width: Math.round(width), height: Math.round(height) };

  const scale = max / longest;
  return {
    // 반올림이 0 을 만들지 않게 최소 1px 을 보장한다(아주 가로로 긴 사진).
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 버킷 안의 경로. 첫 칸이 올린 사람 id 라 RLS 가 남의 칸을 막는다. */
export function photoPath(
  userId: string,
  reviewId: string,
  fileId: string,
): string {
  return `${userId}/${reviewId}/${fileId}.webp`;
}

export type ResizedImage = {
  blob: Blob;
  width: number;
  height: number;
};

/**
 * 브라우저에서 사진을 줄이고 WebP 로 바꾼다. 캔버스를 쓰므로 여기가 경계다 —
 * 크기 계산은 `fitWithin` 이 하고 테스트돼 있다.
 */
export async function resizeToWebp(
  file: File,
  maxEdge: number = MAX_EDGE_PX,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('캔버스를 만들 수 없습니다');
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY);
    });
    // 변환이 실패하면 **원본을 그대로 올리지 않는다** — 4MB 가 조용히 올라가는 것을 막는다.
    if (!blob) throw new Error('사진을 변환하지 못했습니다');

    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
