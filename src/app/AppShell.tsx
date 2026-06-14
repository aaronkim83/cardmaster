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

  const Screen = SCREENS[screen];

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {loaded ? <Screen /> : <div className="p-10 text-center text-sm text-sub">불러오는 중…</div>}
      </div>
      <TabBar />
    </div>
  );
}
