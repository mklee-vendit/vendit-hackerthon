import ConfirmModal from '@/shared/components/modals/ConfirmModal';
import { MODAL_TYPE, type ModalType } from '@/shared/constants/modal';

export { MODAL_TYPE, type ModalType };

/**
 * `MODAL_TYPE` 의 키와 **정확히 일치**하는 맵만 받는다 — 빠뜨리면 `K` 가 안 채워져서,
 * 더 넣으면 `never` 에 걸려서 컴파일이 깨진다. 등록을 잊은 모달이 런타임에
 * `undefined` 컴포넌트로 터지는 걸 타입으로 막는 것이 목적이다.
 */
function defineExactMap<K extends string>() {
  return <T extends Readonly<Record<K, unknown>>>(
    map: T & Record<Exclude<keyof T, K>, never>,
  ) => map;
}

export const MODAL_MAP = defineExactMap<ModalType>()({
  [MODAL_TYPE.CONFIRM]: ConfirmModal,
} as const);

type RegistryFromMap = {
  [K in keyof typeof MODAL_MAP]: (typeof MODAL_MAP)[K];
};

declare module '@/shared/lib/modal/types' {
  interface ModalRegistry extends RegistryFromMap {}
}
