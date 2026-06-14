import { useAppStore, type ScreenId } from '../store/useAppStore';

const TABS: { id: ScreenId; icon: string; label: string }[] = [
  { id: 'home', icon: '◎', label: '홈' },
  { id: 'ledger', icon: '≣', label: '내역' },
  { id: 'stats', icon: '◔', label: '통계' },
  { id: 'more', icon: '⋯', label: '더보기' },
];

export function TabBar() {
  const screen = useAppStore((s) => s.screen);
  const navigate = useAppStore((s) => s.navigate);

  return (
    <div className="flex flex-none border-t border-line bg-surface px-2 pb-[22px] pt-2">
      <Tab tab={TABS[0]} active={screen === 'home'} onClick={() => navigate('home')} />
      <Tab tab={TABS[1]} active={screen === 'ledger'} onClick={() => navigate('ledger')} />
      <div className="flex w-[54px] flex-none justify-center">
        <button
          onClick={() => navigate('input')}
          className="-mt-[22px] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-ink text-[26px] font-light text-white shadow-[0_8px_20px_rgba(26,25,22,.3)]"
        >
          ＋
        </button>
      </div>
      <Tab tab={TABS[2]} active={screen === 'stats'} onClick={() => navigate('stats')} />
      <Tab tab={TABS[3]} active={screen === 'more'} onClick={() => navigate('more')} />
    </div>
  );
}

function Tab({ tab, active, onClick }: { tab: { icon: string; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 pt-1.5 text-center text-[10px] font-semibold ${active ? 'text-ink' : 'text-faint'}`}>
      <span className={`mb-1 block text-[19px] leading-none ${active ? 'opacity-100' : 'opacity-50'}`}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}
