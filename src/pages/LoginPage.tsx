import { Navigate } from 'react-router-dom';
import { LoginView } from '@/pages/login/LoginView';
import {
  useAuthRedirectError,
  useGoogleSignIn,
  useProfile,
  useSession,
} from '@/shared/lib/auth';

/**
 * 목업(`LoginView`)에 실제 동작을 붙이는 자리. 화면은 그쪽이, 상태 판정은 여기가 한다.
 *
 * **"로그인됨" 과 "멤버임" 은 다르다.** 사내 계정이 아닌 구글 계정도 가입 거절 훅이 꺼져
 * 있으면 세션까지는 만들어지는데, 그 계정은 profiles 행이 없다. 그 경우를 빈 화면이 아니라
 * 이 화면의 에러로 보여주고 다시 시도하게 한다.
 */
export function LoginPage() {
  const session = useSession();
  const userId =
    session.status === 'signedIn' ? session.session.user.id : undefined;
  const profile = useProfile(userId);
  const signIn = useGoogleSignIn();
  const redirectError = useAuthRedirectError();

  // 멤버면 더 볼 일이 없다.
  if (profile.data) return <Navigate to="/" replace />;

  const notMemberEmail =
    session.status === 'signedIn' &&
    !profile.isPending &&
    !profile.isError &&
    !profile.data
      ? (session.session.user.email ?? '이 계정')
      : null;

  const error = notMemberEmail
    ? `${notMemberEmail} 은 회사 계정이 아니에요. @vendit.co.kr 계정으로 다시 시도해주세요.`
    : (signIn.error ?? redirectError?.message);

  return (
    <LoginView
      onGoogleClick={signIn.start}
      error={error}
      pending={signIn.pending || (session.status === 'loading' && !error)}
    />
  );
}
