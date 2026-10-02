import { Modal } from '@/shared/components/Modal';
import { MODAL_TYPE } from '@/shared/constants/modal';
import { useModal } from '@/shared/lib/modal/useModal';

type ConfirmModalProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * 공용 확인 모달 — 파괴적 동작마다 모달을 만들지 않고 이 하나에 문구를 주입한다.
 *
 * 닫기는 모달 자신이 한다. 호출부가 `onConfirm` 안에서 또 닫으면 이중 호출이 되므로,
 * 호출부는 "확인했을 때 할 일"만 넘기면 된다.
 */
const ConfirmModal = ({
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const { closeModal } = useModal();

  const close = () => closeModal(MODAL_TYPE.CONFIRM);

  return (
    <Modal className="w-[320px] max-w-[calc(100vw-32px)]">
      <div className="flex flex-col gap-2 px-6 pt-6 pb-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-content-muted">{description}</p>
        )}
      </div>
      {/* 균등 분할 버튼은 flex-1 min-w-0 — 긴 라벨에서 한쪽이 콘텐츠만큼 늘어나지 않게 */}
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-content-muted hover:bg-bg"
          onClick={() => {
            onCancel?.();
            close();
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-content"
          onClick={() => {
            onConfirm();
            close();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
