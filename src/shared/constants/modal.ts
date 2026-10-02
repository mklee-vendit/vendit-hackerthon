// 소스 오브 트루스: 모달 타입. 컴포넌트 배선은 app/providers/modal/registry.ts.
export const MODAL_TYPE = {
  CONFIRM: 'ConfirmModal',
} as const;

export type ModalType = (typeof MODAL_TYPE)[keyof typeof MODAL_TYPE];
