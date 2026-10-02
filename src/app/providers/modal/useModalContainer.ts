import { useModalStore } from '@/shared/lib/modal/store';

/**
 * 컨테이너의 배선 — 맨 위 모달을 고르고 닫기 경로를 묶는다.
 * 모달 옵션(`ModalOptions`)에 부수효과가 붙는다면 그 자리는 여기다.
 */
export const useModalContainer = () => {
  const modalList = useModalStore((s) => s.modalList);
  const closeModal = useModalStore((s) => s.closeModal);

  const topModal = modalList[modalList.length - 1];
  const hasModal = modalList.length > 0;

  const handleOverlayClick = () => {
    if (!topModal?.options?.closeOnOverlayClick) return;
    closeModal(topModal.modalType);
  };

  const handleCloseButtonClick = () => {
    if (!topModal) return;
    closeModal(topModal.modalType);
  };

  return {
    topModal,
    hasModal,
    handleOverlayClick,
    handleCloseButtonClick,
  } as const;
};
