import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useConst } from '@/shared/hooks';
import { useProfile, useSession } from '@/shared/lib/auth';
import { extractCause } from '@/shared/lib/extractCause';
import { PROVISIONAL_RULES, recommend } from '@/shared/lib/recommend';
import { useLatestReviews } from '@/shared/lib/restaurants/hooks';
import { useCandidates } from '@/shared/lib/restaurants/useCandidates';
import { criteriaToParams, parseCriteria } from '@/shared/lib/search/criteria';
import { toResultsViewModel } from './mapRecommendation';
import { ResultsPage } from './ResultsPage';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
    {children}
  </main>
);

/**
 * 1c 결과 화면의 실제 배선. 조건은 URL 에서 읽고, 판정은 `recommend()` 가 하고, 화면은
 * `ResultsPage` 가 그린다.
 *
 * 추천 로직은 React 밖에 있는 순수 함수라 여기서 한 번 부르면 끝이다.
 */
export function ResultsRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const userId =
    session.status === 'signedIn' ? session.session.user.id : undefined;
  const profile = useProfile(userId);
  const candidates = useCandidates();

  const parsed = parseCriteria(params);

  // 시각을 마운트당 한 번만 잡는다. 렌더마다 새로 잡으면 최근성 점수가 미세하게 흔들려서
  // 같은 화면인데 순서가 바뀔 수 있다. (useMemo 를 쓰지 않는다 — React Compiler 가 켜져
  // 있고, 렌더 중 `new Date()` 는 컴파일러가 안전하게 묶을 수 없다.)
  const now = useConst(() => new Date());

  const recommendation =
    parsed.ok && candidates.data
      ? recommend({
          candidates: candidates.data,
          criteria: parsed.criteria,
          rules: PROVISIONAL_RULES,
          now,
        })
      : null;

  const pickIds =
    recommendation?.picks.map((s) => s.candidate.restaurantId) ?? [];
  const latest = useLatestReviews(pickIds, now);

  // 망가진 URL 은 조용히 기본값으로 바꾸지 않는다 — 무엇이 틀렸는지 보여주고 되돌려 보낸다.
  if (!parsed.ok) {
    return (
      <Centered>
        <p className="font-semibold">검색 조건을 읽을 수 없어요</p>
        <ul className="font-mono text-xs text-content-muted">
          {parsed.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
        <Link to="/" className="text-sm font-semibold text-brand underline">
          검색 화면으로
        </Link>
      </Centered>
    );
  }

  if (candidates.isPending) return <Centered>불러오는 중…</Centered>;

  if (candidates.isError) {
    return (
      <Centered>
        <p className="text-danger">{extractCause(candidates.error)}</p>
        <button
          type="button"
          className="text-sm font-semibold underline"
          onClick={() => candidates.refetch()}
        >
          다시 시도
        </button>
      </Centered>
    );
  }

  if (!recommendation) return <Centered>불러오는 중…</Centered>;

  const view = toResultsViewModel({
    recommendation,
    criteria: parsed.criteria,
    rules: PROVISIONAL_RULES,
    latestReviews: latest.data ?? new Map(),
  });

  return (
    <ResultsPage
      displayName={profile.data?.display_name ?? ''}
      conditions={view.conditions}
      restaurants={view.restaurants}
      pickCount={view.pickCount}
      firstReview={view.firstReview}
      firstReviewTruncated={view.firstReviewTruncated}
      blocked={view.blocked}
      unmeasuredWalkCount={view.unmeasuredWalkCount}
      onEditConditions={() =>
        navigate(`/?${criteriaToParams(parsed.criteria).toString()}`)
      }
    />
  );
}
