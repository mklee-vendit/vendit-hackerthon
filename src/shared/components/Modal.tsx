import type { CSSProperties, PropsWithChildren } from 'react';
import { cn } from '@/shared/utils/cn';

type ModalProps = PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
}>;

/** 모달의 **껍데기만** 담당한다 — 오버레이·중앙 정렬·애니메이션은 ModalRenderer 쪽이다. */
export const Modal = ({ className, style, children }: ModalProps) => (
  <div
    className={cn(
      'inline-block overflow-hidden rounded-xl bg-surface shadow-modal',
      className,
    )}
    style={style}
  >
    {children}
  </div>
);
