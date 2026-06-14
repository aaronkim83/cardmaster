import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { useAppStore, type ScreenId } from '../store/useAppStore';
import { HomeScreen } from '../screens/HomeScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { InputScreen } from '../screens/InputScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { AssetsScreen } from '../screens/AssetsScreen';
import { CardsScreen } from '../screens/CardsScreen';
import { CardEditScreen } from '../screens/CardEditScreen';
import { BenefitEditScreen } from '../screens/BenefitEditScreen';
import { RecurringScreen } from '../screens/RecurringScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { EditScreen } from '../screens/EditScreen';
import { CategoryScreen } from '../screens/CategoryScreen';
import { TabBar } from './TabBar';

const SCREENS: Record<ScreenId, ComponentType> = {
  home: HomeScreen,
  ledger: LedgerScreen,
  input: InputScreen,
  stats: StatsScreen,
  more: MoreScreen,
  assets: AssetsScreen,
  cards: CardsScreen,
  cardedit: CardEditScreen,
  benefit: BenefitEditScreen,
  recurring: RecurringScreen,
  import: ImportScreen,
  edit: EditScreen,
  category: CategoryScreen,
};

export function AppShell() {
  const loaded = useAppStore((s) => s.loaded);
  const loadAll = useAppStore((s) => s.loadAll);
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    void loadAll();
    // 저장소 영속화 요청 (PRD §7)
    if (navigator.storage?.persist) void navigator.storage.persist();
  }, [loadAll]);

  // 키보드가 뜨면 visualViewport 높이로 앱 높이를 줄여 하단 버튼이 가려지지 않게 함
  useEffect(() => {
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-h', `${h}px`);
    };
    apply();
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);

  const Screen = SCREENS[screen];

  return (
    <div className="mx-auto flex max-w-[480px] flex-col bg-canvas" style={{ height: 'var(--app-h, 100dvh)' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {loaded ? <Screen /> : <div className="p-10 text-center text-sm text-sub">불러오는 중…</div>}
      </div>
      <TabBar />
    </div>
  );
}
