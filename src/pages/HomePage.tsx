import { MODAL_TYPE } from '@/shared/constants/modal';
import { TOAST_TYPE } from '@/shared/constants/toast';
import { useToast } from '@/shared/hooks/useToast';
import { useModal } from '@/shared/lib/modal/useModal';

const buttonClass =
  'rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium';

export function HomePage() {
  const { openModal } = useModal();
  const { openToast } = useToast();

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold">Vendit Hackerton</h1>
        <p className="text-content-muted">
          React 19 · Vite · React Compiler · Tailwind v4
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            openModal(
              MODAL_TYPE.CONFIRM,
              {
                title: '정말 삭제할까요?',
                description: '삭제한 항목은 되돌릴 수 없습니다.',
                confirmLabel: '삭제',
                onConfirm: () => openToast(TOAST_TYPE.SUCCESS, '삭제했습니다'),
              },
              { closeOnOverlayClick: true },
            )
          }
        >
          모달 열기
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => openToast(TOAST_TYPE.NORMAL, '기본 토스트')}
        >
          토스트
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => openToast(TOAST_TYPE.ERROR, '에러 토스트')}
        >
          에러 토스트
        </button>
      </div>
    </main>
  );
}
