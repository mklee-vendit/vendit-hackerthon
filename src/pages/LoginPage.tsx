import { useState } from 'react';
import { signInWithGoogle } from '@/shared/lib/auth';
import { extractCause } from '@/shared/lib/extractCause';

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold">밥친구</h1>
        <p className="text-content-muted">
          벤디트 사내 구글 계정(@vendit.co.kr)으로 로그인하세요.
        </p>
      </div>

      <button
        type="button"
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-content"
        onClick={() => {
          setError(null);
          signInWithGoogle().catch((cause) => setError(extractCause(cause)));
        }}
      >
        구글로 로그인
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}
    </main>
  );
}
