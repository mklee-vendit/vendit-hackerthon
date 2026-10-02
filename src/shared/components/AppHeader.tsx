import { avatarLabel, cn } from '@/shared/utils';

export type AppTab = 'recommend' | 'community';

const TABS: { key: AppTab; label: string }[] = [
  { key: 'recommend', label: '추천' },
  { key: 'community', label: '커뮤니티' },
];

type AppHeaderProps = {
  activeTab: AppTab;
  displayName: string;
  onTabChange?: (tab: AppTab) => void;
};

export function AppHeader({
  activeTab,
  displayName,
  onTabChange,
}: AppHeaderProps) {
  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-border pr-4 pl-5">
      <span className="font-display text-[22px] leading-none">venparty</span>
      <nav className="flex h-full items-center gap-4 text-sm font-semibold">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-current={key === activeTab ? 'page' : undefined}
            onClick={() => onTabChange?.(key)}
            className={cn(
              'flex h-full items-center',
              key === activeTab
                ? 'shadow-[inset_0_-2px_0_var(--color-content)]'
                : 'text-content-muted',
            )}
          >
            {label}
          </button>
        ))}
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[11px] text-ink-content">
          {avatarLabel(displayName)}
        </span>
      </nav>
    </header>
  );
}
