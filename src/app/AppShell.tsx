import { useEffect, useRef, useState } from 'react';
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
import { BudgetScreen } from '../screens/BudgetScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
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
  budget: BudgetScreen,
  settings: SettingsScreen,
};

// 좌우 스와이프 탭 이동 순서(하단 탭바와 동일, +입력 제외).
const TAB_ORDER: ScreenId[] = ['home', 'ledger', 'stats', 'more'];
const PULL_TRIGGER = 56; // 표시 기준(px) — 이만큼 당기면 새로고침

// 가로 스크롤 가능한 조상(세그/칩 등)에서 시작한 제스처는 스와이프 네비에서 제외.
function isInHorizontalScroller(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    if (el.scrollWidth - el.clientWidth > 4) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

type Gesture = { x: number; y: number; scroll: number; mode: 'idle' | 'pull' | 'swipe' | 'block'; hscroll: boolean };

export function AppShell() {
  const loaded = useAppStore((s) => s.loaded);
  const loadAll = useAppStore((s) => s.loadAll);
  const screen = useAppStore((s) => s.screen);
  const canGoBack = useAppStore((s) => s.history.length > 0);
  const goBack = useAppStore((s) => s.goBack);
  const navigate = useAppStore((s) => s.navigate);

  const [refreshing, setRefreshing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    void loadAll();
    // 저장소 영속화 요청 (PRD §7)
    if (navigator.storage?.persist) void navigator.storage.persist();
  }, [loadAll]);

  // 키보드 높이만 --keyboard-inset으로 추적(앱 높이는 100dvh 고정 → 스크롤 출렁임 방지).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-inset', `${kb}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  function setPullHeight(h: number, animate = false) {
    const el = pullRef.current;
    if (!el) return;
    el.style.transition = animate ? 'height 0.2s ease' : 'none';
    el.style.height = `${h}px`;
  }

  async function doRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setPullHeight(44, true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
      setPullHeight(0, true);
    }
  }

  function switchTab(dir: -1 | 1) {
    const i = TAB_ORDER.indexOf(screen);
    if (i < 0) return;
    const j = Math.min(Math.max(i + dir, 0), TAB_ORDER.length - 1);
    if (j !== i) navigate(TAB_ORDER[j]);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return;
    const t = e.touches[0];
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      scroll: bodyRef.current?.scrollTop ?? 0,
      mode: 'idle',
      hscroll: isInHorizontalScroller(e.target),
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g || refreshing) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.mode === 'idle' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      if (Math.abs(dy) > Math.abs(dx)) {
        g.mode = g.scroll <= 0 && dy > 0 ? 'pull' : 'block';
      } else {
        g.mode = g.hscroll ? 'block' : 'swipe';
      }
    }
    if (g.mode === 'pull') setPullHeight(Math.min(dy * 0.5, 80));
  }

  function onTouchEnd(e: React.TouchEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.mode === 'pull') {
      if (dy * 0.5 >= PULL_TRIGGER) void doRefresh();
      else setPullHeight(0, true);
      return;
    }
    if (g.mode === 'swipe') {
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) {
        if (canGoBack) goBack();
        else switchTab(-1);
      } else {
        switchTab(1);
      }
    }
  }

  const Screen = SCREENS[screen];

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-canvas pt-[env(safe-area-inset-top)]">
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: 'var(--keyboard-inset, 0px)', overscrollBehavior: 'contain' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={pullRef} className="flex items-end justify-center overflow-hidden" style={{ height: 0 }}>
          <span className="pb-2 text-[12px] font-semibold text-sub">{refreshing ? '↻ 새로고침 중…' : '↓ 당겨서 새로고침'}</span>
        </div>
        {loaded ? <Screen /> : <div className="p-10 text-center text-sm text-sub">불러오는 중…</div>}
      </div>
      <TabBar />
    </div>
  );
}
