import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut, useProfile, useSession } from '@/shared/lib/auth';
import { extractCause } from '@/shared/lib/extractCause';

const Centered = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
    {children}
  </main>
);

/**
 * 네 상태를 구별한다. **"로그인됨" 과 "멤버임" 은 다르다** — 사내 계정이 아닌 구글 계정도
 * 가입 거절 훅이 꺼져 있으면 세션까지는 만들어지고, 그 계정은 profiles 행이 없어서
 * 아무 데이터도 못 본다. 그 상태를 빈 화면이 아니라 이유로 보여준다.
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId =
    session.status === 'signedIn' ? session.session.user.id : undefined;
  const profile = useProfile(userId);

  if (session.status === 'loading') {
    return <Centered>불러오는 중…</Centered>;
  }

  if (session.status === 'signedOut') {
    return <Navigate to="/login" replace />;
  }

  if (profile.isPending) {
    return <Centered>불러오는 중…</Centered>;
  }

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

  if (!profile.data) {
    return (
      <Centered>
        <p>
          {session.session.user.email} 은 사내 계정이 아닙니다.
          <br />
          @vendit.co.kr 계정으로 다시 로그인해 주세요.
        </p>
        <button type="button" className="underline" onClick={() => signOut()}>
          로그아웃
        </button>
      </Centered>
    );
  }

  return children;
}
