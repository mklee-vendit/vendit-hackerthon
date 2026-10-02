import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useToastStore } from '@/shared/lib/toast/store';
import Toast from './Toast';

const TOAST_SPACING_PX = 8;

// 새 토스트가 위에 꽂히면 아래 토스트들이 밀려 내려간다. 그 이동은 레이아웃 애니메이션
// (`layout`)이 처리하므로 높이를 직접 재지 않는다 — 원본은 위쪽 화면 밖에서 정확히
// 밀려 들어오게 하려고 토스트별 높이를 측정해 오프셋을 계산하는데, 그 정밀도가 필요한
// 화면이 아직 없다.
const LAYOUT_SPRING = { type: 'spring', stiffness: 500, damping: 35 } as const;

const ToastContainer = ({ zIndex }: { zIndex: number }) => {
  const toastList = useToastStore((s) => s.toastList);

  const toastRoot = document.getElementById('toast-root') ?? document.body;

  return createPortal(
    <div
      className="pointer-events-none fixed top-16 right-0 left-0 flex flex-col items-center px-4"
      style={{ gap: TOAST_SPACING_PX, zIndex }}
    >
      <AnimatePresence>
        {toastList.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            className="pointer-events-auto"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
            transition={{ layout: LAYOUT_SPRING, ...LAYOUT_SPRING }}
          >
            <Toast text={toast.text} type={toast.type} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    toastRoot,
  );
};

export default ToastContainer;
