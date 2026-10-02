import { createPortal } from 'react-dom';
import ModalRenderer from './ModalRenderer';
import { useModalContainer } from './useModalContainer';

const ModalContainer = ({ zIndex }: { zIndex: number }) => {
  const modalContainerProps = useModalContainer();

  const modalRoot = document.getElementById('modal-root') ?? document.body;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 flex flex-col"
      style={{ zIndex }}
    >
      <ModalRenderer {...modalContainerProps} />
    </div>,
    modalRoot,
  );
};

export default ModalContainer;
