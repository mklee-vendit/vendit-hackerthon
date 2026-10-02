/** 후기 본문 상한. 확정값 300자 — 목업은 200자로 그려져 있어 문구를 고쳐야 한다. */
export const REVIEW_BODY_MAX = 300;

export type ReviewDraft = {
  /** 1~5 정수. 아직 안 고르면 null */
  rating: number | null;
  body: string;
  /** 추천/비추천. **필수다** — §6 이 추천 비율을 점수에 쓴다 */
  recommends: boolean | null;
  /** 1인 가격. **필수다**(§3). 빈 칸이면 null */
  pricePerPerson: number | null;
  /** 함께 간 인원(선택). 식당 단위 단체 수용력이 이 값의 최대값이다 */
  partySize: number | null;
};

export type ReviewDraftIssue =
  | 'rating'
  | 'body'
  | 'bodyTooLong'
  | 'recommends'
  | 'price'
  | 'partySize';

export const DRAFT_ISSUE_LABEL: Record<ReviewDraftIssue, string> = {
  rating: '별점을 골라주세요',
  body: '짧은 후기를 적어주세요',
  bodyTooLong: `후기는 ${REVIEW_BODY_MAX}자까지예요`,
  recommends: '추천 여부를 골라주세요',
  price: '1인 가격을 적어주세요',
  partySize: '함께 간 인원은 1명 이상이어야 해요',
};

export const emptyDraft = (): ReviewDraft => ({
  rating: null,
  body: '',
  recommends: null,
  pricePerPerson: null,
  partySize: null,
});

/**
 * 보낼 수 있는 후기인가.
 *
 * **1인 가격과 추천 여부를 필수로 받는다.** 목업(1g·2a)에는 그 입력이 없는데, 안 받으면
 * 그 후기는 가격·추천 비율 집계에서 빠진다 — 2a 메모도 같은 지적을 한다. §3 은 1인 가격을
 * 필수로, §6 은 추천 비율을 점수에 쓴다.
 *
 * 글자 수는 **NFC 로 정규화한 뒤** 센다. DB 가 그렇게 저장하므로(§10.13), 정규화 전 길이로
 * 재면 자모 분리로 들어온 입력이 화면에서는 300자인데 DB 에서 거절된다.
 */
export function validateDraft(draft: ReviewDraft): ReviewDraftIssue[] {
  const issues: ReviewDraftIssue[] = [];

  if (draft.rating === null || !Number.isInteger(draft.rating)) {
    issues.push('rating');
  } else if (draft.rating < 1 || draft.rating > 5) {
    issues.push('rating');
  }

  const body = normalizedBody(draft.body);
  if (body.length === 0) issues.push('body');
  else if (body.length > REVIEW_BODY_MAX) issues.push('bodyTooLong');

  if (draft.recommends === null) issues.push('recommends');

  if (
    draft.pricePerPerson === null ||
    !Number.isInteger(draft.pricePerPerson) ||
    draft.pricePerPerson < 0
  ) {
    issues.push('price');
  }

  if (
    draft.partySize !== null &&
    (!Number.isInteger(draft.partySize) || draft.partySize < 1)
  ) {
    issues.push('partySize');
  }

  return issues;
}

export function normalizedBody(body: string): string {
  return body.normalize('NFC').trim();
}

/** 남은 글자 수. 음수가 될 수 있다 — 넘긴 만큼 보여줘야 사용자가 지울 수 있다. */
export function remainingChars(body: string): number {
  return REVIEW_BODY_MAX - normalizedBody(body).length;
}
