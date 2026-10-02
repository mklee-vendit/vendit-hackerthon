import { Link, useNavigate, useParams } from 'react-router-dom';
import { toWalkMinutes } from '@/pages/results/mapRecommendation';
import { useConst } from '@/shared/hooks';
import { useProfile, useSession } from '@/shared/lib/auth';
import { extractCause } from '@/shared/lib/extractCause';
import { toNumber } from '@/shared/lib/restaurants/candidateRow';
import {
  useCreateReview,
  useDeleteReview,
  useRestaurantDetail,
  useReviewFeed,
} from '@/shared/lib/reviews/hooks';
import { formatWon } from '@/shared/utils';
import { relativeKo } from '@/shared/utils/relativeTime';
import { ReviewComposer } from './ReviewComposer';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
    {children}
  </main>
);

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

function monthDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** 1g 식당 상세 + 후기. */
export function RestaurantRoute() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const now = useConst(() => new Date());
  const session = useSession();
  const profile = useProfile(
    session.status === 'signedIn' ? session.session.user.id : undefined,
  );
  const detail = useRestaurantDetail(restaurantId);
  const feed = useReviewFeed(restaurantId);
  const createReview = useCreateReview(restaurantId ?? '');
  const deleteReview = useDeleteReview();

  if (detail.isPending) return <Centered>불러오는 중…</Centered>;

  if (detail.isError) {
    return (
      <Centered>
        <p className="text-danger">{extractCause(detail.error)}</p>
        <button
          type="button"
          className="text-sm font-semibold underline"
          onClick={() => detail.refetch()}
        >
          다시 시도
        </button>
      </Centered>
    );
  }

  if (!detail.data) {
    return (
      <Centered>
        <p className="font-semibold">그 식당을 찾을 수 없어요</p>
        <Link to="/" className="text-sm font-semibold text-brand underline">
          검색 화면으로
        </Link>
      </Centered>
    );
  }

  const r = detail.data;
  const walkMinutes = toWalkMinutes(toNumber(r.walk_seconds));
  const avgRating = toNumber(r.avg_rating);
  const partySizeMax = toNumber(r.party_size_max);
  const reviewCount = toNumber(r.review_count) ?? 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
      <header className="flex h-14 flex-none items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center text-xl"
          aria-label="뒤로"
        >
          ‹
        </button>
        <span className="text-sm text-content-muted">결과로</span>
      </header>

      <main className="flex flex-col gap-4 px-5 pb-8">
        <section>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-content-muted">{r.category}</span>
            <span className="font-mono text-[13px]">
              {avgRating === null ? '★ —' : `★ ${avgRating.toFixed(1)}`}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.4px]">
            {r.name}
          </h1>
          <div className="mt-1.5 font-mono text-[13px]">
            도보 {walkMinutes ?? '—'}분
            <span className="ml-1.5 text-content-muted">· 경로 실측</span>
          </div>
          <p className="mt-2 text-[13px] text-content-muted">
            {r.road_address ?? r.address ?? '—'}
          </p>
          <p className="mt-0.5 font-mono text-xs text-content-muted">
            정보 수집 {monthDay(r.collected_at)}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span
              className={
                partySizeMax === null
                  ? 'rounded-full border border-dashed border-line px-2.5 py-1 font-mono text-[11px] text-content-muted'
                  : 'rounded-full bg-track px-2.5 py-1 font-mono text-[11px]'
              }
            >
              {partySizeMax === null
                ? '? 단체석 미확인'
                : `✓ 단체 ${partySizeMax}명까지 확인`}
            </span>
            <span className="rounded-full bg-track px-2.5 py-1 font-mono text-[11px]">
              후기 {reviewCount}
            </span>
          </div>
        </section>

        <ReviewComposer
          authorName={profile.data?.display_name ?? ''}
          pending={createReview.isPending}
          error={createReview.isError ? extractCause(createReview.error) : null}
          onSubmit={(draft) => createReview.mutate(draft)}
        />

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold">
              후기 <span className="font-mono">{reviewCount}</span>
            </h2>
            <span className="text-xs text-content-muted">최신순</span>
          </div>

          {feed.isPending && (
            <p className="py-6 text-center text-sm text-content-muted">
              불러오는 중…
            </p>
          )}
          {feed.isError && (
            <p className="py-6 text-center text-sm text-danger">
              {extractCause(feed.error)}
            </p>
          )}
          {feed.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-content-muted">
              아직 후기가 없어요. 첫 후기를 남겨주세요.
            </p>
          )}

          <ul>
            {feed.data?.map((review) => (
              <li
                key={review.id}
                className="border-b border-border py-3.5 last:border-b-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold">
                    {review.author_name}
                  </span>
                  {review.is_mine && (
                    <span className="rounded bg-track px-1.5 py-0.5 text-[10px]">
                      나
                    </span>
                  )}
                  <span className="text-xs text-content-muted">
                    {relativeKo(new Date(review.created_at), now)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[13px] text-brand">
                  {stars(review.rating)}
                  <span className="ml-1.5 text-content-muted">
                    {review.recommends ? '추천' : '비추천'}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-normal whitespace-pre-wrap">
                  {review.body}
                </p>
                <div className="mt-1.5 flex items-center gap-3 font-mono text-xs text-content-muted">
                  <span>1인 {formatWon(review.price_per_person)}원</span>
                  {review.party_size !== null && (
                    <span>✓ {review.party_size}명 방문</span>
                  )}
                  {/* 버튼을 숨기는 것은 UX 일 뿐이고, 권한은 RLS 가 막는다(§10.8) */}
                  {review.is_mine && (
                    <button
                      type="button"
                      disabled={deleteReview.isPending}
                      onClick={() => deleteReview.mutate(review.id)}
                      className="ml-auto underline disabled:opacity-50"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[11px] text-content-muted">
          도보 경로 © OpenStreetMap 기여자
        </p>
      </main>
    </div>
  );
}
