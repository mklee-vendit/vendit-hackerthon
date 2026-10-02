import type { ReactNode } from 'react';

type LoginViewProps = {
  onGoogleClick: () => void;
  error?: ReactNode;
  pending?: boolean;
};

/**
 * 1a 목업의 표시 전용 화면. 로그인 동작·에러 문구는 호출부(LoginPage)가 넘긴다.
 * 도메인 판정은 서버(is_vendit_email) 몫이라 여기 문구는 안내일 뿐이다.
 */
export function LoginView({ onGoogleClick, error, pending }: LoginViewProps) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col justify-center gap-8 px-7 py-10">
      <div className="rounded-[20px] bg-surface px-6 pt-[22px] pb-[26px] shadow-ticket">
        <span className="font-mono text-[11px] tracking-[0.12em] text-content-muted">
          VENDIT
        </span>
        <h1 className="mt-7 font-display text-[58px] leading-none tracking-[-1px]">
          venparty
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-3.5 py-3 text-[13px] leading-[1.55] text-danger"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={onGoogleClick}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-ink text-base font-semibold text-ink-content disabled:opacity-60"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-ink-content text-[13px] font-bold text-ink">
            G
          </span>
          회사 Google 계정으로 계속
        </button>
        <p className="text-center text-xs text-content-muted">
          @vendit.co.kr 계정만 · 실명으로 표시돼요
        </p>
      </div>
    </main>
  );
}
