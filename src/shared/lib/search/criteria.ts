import { z } from 'zod';
import {
  DEFAULT_BUDGET,
  DEFAULT_WALK_MINUTES,
  type Situation,
  WALK_MINUTE_OPTIONS,
} from '@/shared/constants/search';
import type { SearchCriteria } from '@/shared/lib/recommend';

/**
 * 검색 조건은 **URL 에 있다.** 화면 상태로만 들고 있으면 결과를 공유할 수도, 새로고침 뒤에
 * 같은 결과로 돌아올 수도 없다.
 *
 * 값이 망가진 URL(사람이 손으로 고친 것, 오래된 링크)은 **조용히 기본값으로 바꾸지 않고**
 * 무엇이 틀렸는지 돌려준다 — 조건이 바뀐 걸 모르고 결과를 믿는 것이 더 나쁘다(§10.5).
 */
const situationSchema = z.enum(['lunch', 'party']);

const schema = z.object({
  situation: situationSchema,
  headcount: z.coerce.number().int().min(1).max(200),
  budget: z.coerce.number().int().min(0).max(1_000_000),
  walk: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof WALK_MINUTE_OPTIONS)[number] =>
        (WALK_MINUTE_OPTIONS as readonly number[]).includes(value),
      {
        message: `도보 상한은 ${WALK_MINUTE_OPTIONS.join('·')}분 중 하나여야 합니다`,
      },
    ),
  /** 쉼표로 이은 제약 옵션 id. 빈 문자열이면 제약 없음 */
  diet: z.string().optional(),
});

export type ParsedCriteria =
  | { ok: true; criteria: SearchCriteria }
  | { ok: false; issues: string[] };

export function defaultCriteria(
  situation: Situation = 'lunch',
): SearchCriteria {
  return {
    situation,
    headcount: 6,
    budgetPerPerson: DEFAULT_BUDGET[situation],
    maxWalkMinutes: DEFAULT_WALK_MINUTES,
    dietOptionIds: [],
  };
}

export function criteriaToParams(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams({
    situation: criteria.situation,
    headcount: String(criteria.headcount),
    budget: String(criteria.budgetPerPerson),
    walk: String(criteria.maxWalkMinutes),
  });
  if (criteria.dietOptionIds.length > 0) {
    params.set('diet', criteria.dietOptionIds.join(','));
  }
  return params;
}

export function parseCriteria(params: URLSearchParams): ParsedCriteria {
  const result = schema.safeParse({
    situation: params.get('situation'),
    headcount: params.get('headcount'),
    budget: params.get('budget'),
    walk: params.get('walk'),
    diet: params.get('diet') ?? undefined,
  });

  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '조건'}: ${issue.message}`,
      ),
    };
  }

  const diet = (result.data.diet ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    ok: true,
    criteria: {
      situation: result.data.situation,
      headcount: result.data.headcount,
      budgetPerPerson: result.data.budget,
      maxWalkMinutes: result.data.walk,
      dietOptionIds: diet,
    },
  };
}
