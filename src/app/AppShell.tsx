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

const PULL_MAX = 120; // 최대 당김(px, 저항 후)
const PULL_TRIGGER = 64; // 이만큼 당기면 새로고침
const SPRING = 'transform .34s cubic-bezier(.22,.9,.27,1)';

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

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);

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

  // 당겨서 새로고침(iOS풍) + 좌우 스와이프 네비. 네이티브 리스너로 pull 중 preventDefault.
  useEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    const spin = spinRef.current;
    if (!body || !content || !spin) return;
    const getState = useAppStore.getState;
    let g: Gesture | null = null;

    // 저항 곡선: 당길수록 천천히(고무줄 느낌).
    const resist = (raw: number) => PULL_MAX * (1 - Math.exp(-Math.max(raw, 0) / PULL_MAX));

    const render = (y: number, animate: boolean) => {
      content.style.transition = animate ? SPRING : 'none';
      spin.style.transition = animate ? `opacity .25s, ${SPRING}` : 'none';
      content.style.transform = `translateY(${y}px)`;
      const prog = Math.min(y / PULL_TRIGGER, 1);
      spin.style.opacity = String(prog);
      spin.style.transform = `translateY(${y * 0.55}px) scale(${0.55 + 0.45 * prog})`;
    };

    const startRefresh = () => {
      refreshingRef.current = true;
      setRefreshing(true);
      content.style.transition = SPRING;
      spin.style.transition = `opacity .25s, ${SPRING}`;
      content.style.transform = 'translateY(52px)';
      spin.style.opacity = '1';
      spin.style.transform = 'translateY(28px) scale(1)';
      void getState()
        .loadAll()
        .finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          requestAnimationFrame(() => render(0, true));
        });
    };

    const switchTab = (dir: -1 | 1) => {
      const cur = getState();
      const i = TAB_ORDER.indexOf(cur.screen);
      if (i < 0) return;
      const j = Math.min(Math.max(i + dir, 0), TAB_ORDER.length - 1);
      if (j !== i) cur.navigate(TAB_ORDER[j]);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, scroll: body.scrollTop, mode: 'idle', hscroll: isInHorizontalScroller(e.target) };
    };
    const onMove = (e: TouchEvent) => {
      if (!g || refreshingRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.mode === 'idle' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        if (Math.abs(dy) > Math.abs(dx)) g.mode = g.scroll <= 0 && dy > 0 ? 'pull' : 'block';
        else g.mode = g.hscroll ? 'block' : 'swipe';
      }
      if (g.mode === 'pull') {
        e.preventDefault();
        render(resist(dy), false);
      }
    };
    const onEnd = (e: TouchEvent) => {
      const s = g;
      g = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (s.mode === 'pull') {
        if (resist(dy) >= PULL_TRIGGER) startRefresh();
        else render(0, true);
        return;
      }
      if (s.mode === 'swipe') {
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        const cur = getState();
        if (dx > 0) {
          if (cur.history.length > 0) cur.goBack();
          else switchTab(-1);
        } else {
          switchTab(1);
        }
      }
    };

    body.addEventListener('touchstart', onStart, { passive: true });
    body.addEventListener('touchmove', onMove, { passive: false });
    body.addEventListener('touchend', onEnd, { passive: true });
    body.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      body.removeEventListener('touchstart', onStart);
      body.removeEventListener('touchmove', onMove);
      body.removeEventListener('touchend', onEnd);
      body.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const Screen = SCREENS[screen];

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-canvas pt-[env(safe-area-inset-top)]">
      <div
        ref={bodyRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: 'var(--keyboard-inset, 0px)', overscrollBehavior: 'contain' }}
      >
        <div ref={spinRef} className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex justify-center" style={{ opacity: 0 }}>
          <div className={`h-7 w-7 rounded-full border-[2.5px] border-line2 border-t-sub ${refreshing ? 'animate-spin' : ''}`} />
        </div>
        <div ref={contentRef} style={{ willChange: 'transform' }}>
          {loaded ? <Screen /> : <div className="p-10 text-center text-sm text-sub">불러오는 중…</div>}
        </div>
      </div>
      <TabBar />
    </div>
  );
}
