import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile, useSession } from '@/shared/lib/auth';
import { extractCause } from '@/shared/lib/extractCause';

const Centered = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
    {children}
  </main>
);

/**
 * 멤버만 통과시킨다. **사유를 보여주는 일은 하지 않는다** — 로그인 화면이 한 곳에서 하므로,
 * 여기서 또 만들면 같은 문구가 두 군데 생긴다.
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId =
    session.status === 'signedIn' ? session.session.user.id : undefined;
  const profile = useProfile(userId);

  if (session.status === 'loading') return <Centered>불러오는 중…</Centered>;
  if (session.status === 'signedOut') return <Navigate to="/login" replace />;
  if (profile.isPending) return <Centered>불러오는 중…</Centered>;

  if (profile.isError) {
    return (
      <Centered>
        <p className="text-danger">{extractCause(profile.error)}</p>
        <button
          type="button"
          className="underline"
          onClick={() => profile.refetch()}
        >
          다시 시도
        </button>
      </Centered>
    );
  }

  // 로그인은 됐지만 멤버가 아니다 — 로그인 화면이 사유를 보여준다.
  if (!profile.data) return <Navigate to="/login" replace />;

  return children;
}
