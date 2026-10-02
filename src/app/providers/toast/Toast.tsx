import { TOAST_TYPE, type ToastType } from '@/shared/constants/toast';
import { cn } from '@/shared/utils/cn';

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
    <path
      d="M4.5 10.5l3.5 3.5 7.5-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
    <path
      d="M5.5 5.5l9 9m0-9l-9 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const iconMap = {
  [TOAST_TYPE.SUCCESS]: CheckIcon,
  [TOAST_TYPE.ERROR]: CrossIcon,
  [TOAST_TYPE.NORMAL]: null,
} as const;

const styleMap = {
  [TOAST_TYPE.SUCCESS]: 'bg-success text-brand-content',
  [TOAST_TYPE.ERROR]: 'bg-danger text-brand-content',
  [TOAST_TYPE.NORMAL]: 'bg-surface text-content border border-border',
} as const;

const Toast = ({ text, type }: { text: string; type: ToastType }) => {
  const Icon = iconMap[type];

  return (
    <div
      className={cn(
        'flex w-max max-w-[calc(100vw-32px)] items-center gap-2 rounded-full px-5 py-2.5 shadow-modal',
        styleMap[type],
      )}
    >
      {Icon && <Icon />}
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
};

export default Toast;
