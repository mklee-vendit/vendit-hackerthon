import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ModalFlowProvider } from '@/shared/lib/modal/ModalFlowProvider';
import { ModalStateProvider } from '@/shared/lib/modal/ModalStateProvider';
import { createQueryClient } from '@/shared/lib/query';
import { Z_INDEX } from './constants/zIndex';
import ModalContainer from './providers/modal/ModalContainer';
import ToastContainer from './providers/toast/ToastContainer';
import { router } from './router';

/**
 * ModalStateProvider 는 페이지와 모달 컨테이너의 **공통 조상**이어야 한다 — `modalState`
 * 는 "여는 쪽 ↔ 그 모달"의 계약이라 둘이 같은 스토어를 봐야 한다. 그래서 라우터보다 위다.
 */
export function App() {
  // 모듈 최상단에서 만들면 HMR 때마다 캐시가 날아간다.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ModalStateProvider>
        <ModalFlowProvider>
          <RouterProvider router={router} />
          <ModalContainer zIndex={Z_INDEX.modal} />
          <ToastContainer zIndex={Z_INDEX.toast} />
        </ModalFlowProvider>
      </ModalStateProvider>
    </QueryClientProvider>
  );
}
