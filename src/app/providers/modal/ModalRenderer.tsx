import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType } from 'react';
import { ModalFlowBoundary } from '@/shared/lib/modal/ModalFlowProvider';
import type { ModalItem } from '@/shared/lib/modal/types';
import {
  MODAL_CONTENT_DURATION_S,
  modalContentTransition,
  modalContentVariants,
} from './animations';
import { MODAL_MAP } from './registry';

type ModalRendererProps = {
  topModal: ModalItem | undefined;
  hasModal: boolean;
  handleOverlayClick: () => void;
  handleCloseButtonClick: () => void;
};

const ModalRenderer = ({
  topModal,
  hasModal,
  handleOverlayClick,
  handleCloseButtonClick,
}: ModalRendererProps) => (
  <div className="relative w-full flex-1">
    <AnimatePresence>
      {hasModal && (
        <motion.div
          key="modal-overlay"
          className="pointer-events-auto absolute inset-0 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: MODAL_CONTENT_DURATION_S },
          }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {topModal?.options?.showCloseButton && (
        <motion.button
          key="modal-close-button"
          type="button"
          aria-label="닫기"
          className="pointer-events-auto absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleCloseButtonClick}
        >
          ×
        </motion.button>
      )}
    </AnimatePresence>

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {/* mode="wait": 모달을 교체하면(replaceModal) 나가는 모달이 사라진 뒤 들어온다 */}
      <AnimatePresence mode="wait">
        {topModal && (
          <ModalFlowBoundary flowToken={topModal.options?.flowToken}>
            <motion.div
              key={topModal.modalType}
              className="pointer-events-auto relative"
              variants={modalContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={modalContentTransition}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const Component = MODAL_MAP[topModal.modalType];
                if ('props' in topModal && topModal.props) {
                  const Comp = Component as ComponentType<
                    typeof topModal.props
                  >;
                  return <Comp {...topModal.props} />;
                }
                const Comp = Component as ComponentType<object>;
                return <Comp />;
              })()}
            </motion.div>
          </ModalFlowBoundary>
        )}
      </AnimatePresence>
    </div>
  </div>
);

export default ModalRenderer;
