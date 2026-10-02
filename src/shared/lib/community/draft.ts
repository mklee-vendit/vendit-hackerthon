/** 목업(3a) 제안값. ⚠️ 잠정 — DB 의 CHECK 와 같은 값이어야 한다. */
export const POST_TITLE_MAX = 40;
export const POST_BODY_MAX = 1000;
export const COMMENT_BODY_MAX = 300;

export type PostDraft = {
  title: string;
  body: string;
};

export type PostDraftIssue = 'title' | 'titleTooLong' | 'body' | 'bodyTooLong';

export const POST_ISSUE_LABEL: Record<PostDraftIssue, string> = {
  title: '제목을 적어주세요',
  titleTooLong: `제목은 ${POST_TITLE_MAX}자까지예요`,
  body: '내용을 적어주세요',
  bodyTooLong: `내용은 ${POST_BODY_MAX}자까지예요`,
};

/**
 * 글자 수는 **NFC 로 정규화한 뒤** 센다. DB 가 그렇게 저장하므로(§10.13), 정규화 전 길이로
 * 재면 자모 분리로 들어온 입력이 화면에서는 통과인데 DB 에서 거절된다.
 */
export function normalized(text: string): string {
  return text.normalize('NFC').trim();
}

export function validatePost(draft: PostDraft): PostDraftIssue[] {
  const issues: PostDraftIssue[] = [];
  const title = normalized(draft.title);
  const body = normalized(draft.body);

  if (title.length === 0) issues.push('title');
  else if (title.length > POST_TITLE_MAX) issues.push('titleTooLong');

  if (body.length === 0) issues.push('body');
  else if (body.length > POST_BODY_MAX) issues.push('bodyTooLong');

  return issues;
}

export function validateComment(body: string): 'body' | 'bodyTooLong' | null {
  const text = normalized(body);
  if (text.length === 0) return 'body';
  if (text.length > COMMENT_BODY_MAX) return 'bodyTooLong';
  return null;
}
