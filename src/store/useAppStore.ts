import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  Account,
  BalanceSnapshot,
  Benefit,
  Budget,
  Category,
  RecurringRule,
  Setting,
  Transaction,
} from '../db/types';
import { db } from '../db/schema';
import { buildSeedCategories, seedDatabaseIfEmpty } from '../db/seed';
import { DEMO_SEEDED_SETTING_KEY, ONBOARDED_SETTING_KEY, seedDemoData, seedDemoDataIfEmpty } from '../db/demoSeed';
import { compareYM, monthKey, nextMonth, prevMonth, todayYM, type YearMonth } from '../logic/period';
import { generateDueTransactions } from '../logic/recurring';

// 전역 상태 — selectedMonth + 화면 네비 + 로드된 엔티티 + CRUD.
// 파생 집계는 logic/* 순수함수로 계산(SSOT). pending은 모든 집계에서 제외.

export type ScreenId =
  | 'home'
  | 'ledger'
  | 'input'
  | 'stats'
  | 'more'
  | 'assets'
  | 'cards'
  | 'cardedit'
  | 'benefit'
  | 'recurring'
  | 'import'
  | 'edit'
  | 'category'
  | 'budget'
  | 'settings';

export interface NavParams {
  txnId?: string;
  accountId?: string;
  benefitId?: string;
}

interface AppState {
  selectedMonth: YearMonth;
  loaded: boolean;

  screen: ScreenId;
  params: NavParams;
  history: { screen: ScreenId; params: NavParams }[];

  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  benefits: Benefit[];
  recurringRules: RecurringRule[];
  balanceSnapshots: BalanceSnapshot[];
  settings: Setting[];

  setSelectedMonth: (ym: YearMonth) => void;
  goPrevMonth: () => void;
  goNextMonth: () => void;

  navigate: (screen: ScreenId, params?: NavParams, options?: { preserveHistory?: boolean }) => void;
  goBack: () => void;

  loadAll: () => Promise<void>;
  resetAllData: (options?: { onboarded?: boolean }) => Promise<void>;
  loadDemoData: () => Promise<void>;

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  saveAccount: (a: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  reorderAccounts: (ordered: Account[]) => Promise<void>;

  saveBenefit: (b: Benefit) => Promise<void>;
  deleteBenefit: (id: string) => Promise<void>;

  saveBudget: (b: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (ordered: Category[]) => Promise<void>;

  saveRecurring: (r: RecurringRule) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;

  saveBalanceSnapshot: (snap: BalanceSnapshot) => Promise<void>;
  setSetting: (key: string, value: unknown) => Promise<void>;

  restoreFromBackup: (data: unknown) => Promise<void>;
}

const TAB_SCREENS: ScreenId[] = ['home', 'ledger', 'input', 'stats', 'more'];

// 화면(네비) 상태를 sessionStorage에 보존 → 같은 세션 내 새로고침 시 홈으로 튕기지 않고 현재 화면 유지.
const NAV_KEY = 'siljeok-nav';
type NavSnapshot = { screen: ScreenId; params: NavParams; history: { screen: ScreenId; params: NavParams }[] };

function loadNav(): NavSnapshot {
  try {
    const raw = sessionStorage.getItem(NAV_KEY);
    if (raw) {
      const n = JSON.parse(raw) as Partial<NavSnapshot>;
      if (n && typeof n.screen === 'string') {
        return { screen: n.screen, params: n.params ?? {}, history: Array.isArray(n.history) ? n.history : [] };
      }
    }
  } catch {
    /* sessionStorage 미지원/차단 시 무시 */
  }
  return { screen: 'home', params: {}, history: [] };
}

function saveNav(snap: NavSnapshot): void {
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(snap));
  } catch {
    /* 무시 */
  }
}

const initialNav = loadNav();

// 모듈 레벨 시드 1회 가드 (동시 호출 dedupe)
let seedOnce: Promise<void> | null = null;
const realizingRecurringByMonth = new Map<string, Promise<void>>();

export const useAppStore = create<AppState>((set, get) => ({
  selectedMonth: todayYM(),
  loaded: false,

  screen: initialNav.screen,
  params: initialNav.params,
  history: initialNav.history,

  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  benefits: [],
  recurringRules: [],
  balanceSnapshots: [],
  settings: [],

  setSelectedMonth: (ym) => {
    set({ selectedMonth: ym });
    void realizeDueRecurringForCurrentMonth(set, ym);
  },
  goPrevMonth: () => get().setSelectedMonth(prevMonth(get().selectedMonth)),
  goNextMonth: () => get().setSelectedMonth(nextMonth(get().selectedMonth)),

  navigate: (screen, params = {}, options = {}) => {
    const cur = get();
    // 탭 전환은 히스토리를 리셋, 상세 진입은 스택에 쌓기
    const history = TAB_SCREENS.includes(screen) && !options.preserveHistory
      ? []
      : [...cur.history, { screen: cur.screen, params: cur.params }];
    set({ screen, params, history });
    saveNav({ screen, params, history });
  },
  goBack: () => {
    const { history } = get();
    if (history.length === 0) {
      set({ screen: 'home', params: {} });
      saveNav({ screen: 'home', params: {}, history: [] });
      return;
    }
    const prev = history[history.length - 1];
    const history2 = history.slice(0, -1);
    set({ screen: prev.screen, params: prev.params, history: history2 });
    saveNav({ screen: prev.screen, params: prev.params, history: history2 });
  },

  loadAll: async () => {
    // StrictMode 이중 마운트/동시 호출에서 시드가 두 번 돌지 않도록 1회 보장
    seedOnce ??= (async () => {
      await seedDatabaseIfEmpty();
      await seedDemoDataIfEmpty();
    })();
    await seedOnce;
    await reload(set);
    await realizeDueRecurringForCurrentMonth(set, get().selectedMonth);
  },

  resetAllData: async (options = {}) => {
    seedOnce = null;
    realizingRecurringByMonth.clear();
    await resetDatabaseToCategories(options.onboarded ?? false);
    await reload(set);
  },

  loadDemoData: async () => {
    seedOnce = null;
    realizingRecurringByMonth.clear();
    await resetDatabaseToCategories(false);
    await seedDemoData();
    await reload(set);
    await realizeDueRecurringForCurrentMonth(set, get().selectedMonth);
  },

  addTransaction: async (t) => {
    await db.transactions.add({ ...t, id: nanoid(), createdAt: Date.now() });
    await reload(set);
  },
  updateTransaction: async (id, patch) => {
    await db.transactions.update(id, patch);
    await reload(set);
  },
  deleteTransaction: async (id) => {
    await db.transactions.delete(id);
    await reload(set);
  },

  saveAccount: async (a) => {
    await db.accounts.put(a);
    await reload(set);
  },
  deleteAccount: async (id) => {
    await db.accounts.delete(id);
    await reload(set);
  },
  reorderAccounts: async (ordered) => {
    await db.accounts.bulkPut(ordered.map((a, i) => ({ ...a, sortOrder: i })));
    await reload(set);
  },

  saveBenefit: async (b) => {
    await db.benefits.put(b);
    await reload(set);
  },
  deleteBenefit: async (id) => {
    await db.benefits.delete(id);
    await reload(set);
  },

  saveBudget: async (b) => {
    await db.budgets.put(b);
    await reload(set);
  },
  deleteBudget: async (id) => {
    await db.budgets.delete(id);
    await reload(set);
  },
  saveCategory: async (c) => {
    await db.categories.put(c);
    await reload(set);
  },
  deleteCategory: async (id) => {
    // 소분류가 있으면 함께 삭제 (대분류 삭제 시)
    await db.categories.where('parentId').equals(id).delete();
    await db.categories.delete(id);
    await reload(set);
  },
  reorderCategories: async (ordered) => {
    await db.categories.bulkPut(ordered.map((c, i) => ({ ...c, sortOrder: i })));
    await reload(set);
  },

  saveRecurring: async (r) => {
    await db.recurringRules.put(r);
    await reload(set);
    await realizeDueRecurringForCurrentMonth(set, get().selectedMonth);
  },
  deleteRecurring: async (id) => {
    await db.recurringRules.delete(id);
    await reload(set);
  },

  saveBalanceSnapshot: async (snap) => {
    await db.balanceSnapshots.put(snap);
    await reload(set);
  },
  setSetting: async (key, value) => {
    await db.settings.put({ key, value });
    await reload(set);
  },

  restoreFromBackup: async (data) => {
    const d = data as Record<string, unknown[]>;
    const tables: [keyof typeof db, unknown[] | undefined][] = [
      ['accounts', d.accounts], ['transactions', d.transactions], ['categories', d.categories],
      ['budgets', d.budgets], ['benefits', d.benefits], ['recurringRules', d.recurringRules],
      ['importProfiles', Array.isArray(d.importProfiles) ? d.importProfiles : []],
      ['merchantRules', Array.isArray(d.merchantRules) ? d.merchantRules : []],
      ['balanceSnapshots', d.balanceSnapshots], ['settings', d.settings],
    ];
    await db.transaction('rw', [db.accounts, db.transactions, db.categories, db.budgets, db.benefits, db.recurringRules, db.importProfiles, db.merchantRules, db.balanceSnapshots, db.settings], async () => {
      for (const [name, rows] of tables) {
        if (!Array.isArray(rows)) continue;
        const table = db[name] as unknown as { clear: () => Promise<void>; bulkAdd: (r: unknown[]) => Promise<unknown> };
        await table.clear();
        if (rows.length) await table.bulkAdd(rows);
      }
    });
    await reload(set);
  },
}));

async function reload(set: (partial: Partial<AppState>) => void): Promise<void> {
  const [accounts, transactions, categories, budgets, benefits, recurringRules, balanceSnapshots, settings] =
    await Promise.all([
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.categories.toArray(),
      db.budgets.toArray(),
      db.benefits.toArray(),
      db.recurringRules.toArray(),
      db.balanceSnapshots.toArray(),
      db.settings.toArray(),
    ]);
  set({ accounts, transactions, categories, budgets, benefits, recurringRules, balanceSnapshots, settings, loaded: true });
}

async function resetDatabaseToCategories(onboarded: boolean): Promise<void> {
  await db.transaction('rw', [
    db.accounts,
    db.transactions,
    db.categories,
    db.budgets,
    db.benefits,
    db.recurringRules,
    db.importProfiles,
    db.merchantRules,
    db.balanceSnapshots,
    db.settings,
  ], async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.benefits.clear();
    await db.recurringRules.clear();
    await db.importProfiles.clear();
    await db.merchantRules.clear();
    await db.balanceSnapshots.clear();
    await db.settings.clear();
    await db.categories.bulkAdd(buildSeedCategories());
    await db.settings.bulkPut([
      { key: DEMO_SEEDED_SETTING_KEY, value: true },
      { key: ONBOARDED_SETTING_KEY, value: onboarded },
    ]);
  });
}

async function realizeDueRecurringForCurrentMonth(
  set: (partial: Partial<AppState>) => void,
  selectedMonth: YearMonth,
): Promise<void> {
  if (compareYM(selectedMonth, todayYM()) !== 0) return;

  const key = monthKey(selectedMonth);
  const existing = realizingRecurringByMonth.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const [rules, txns] = await Promise.all([
      db.recurringRules.toArray(),
      db.transactions.toArray(),
    ]);
    const due = generateDueTransactions(rules, txns, selectedMonth);
    if (due.length === 0) return;
    await db.transactions.bulkAdd(due);
    await reload(set);
  })();

  realizingRecurringByMonth.set(key, promise);
  try {
    await promise;
  } finally {
    if (realizingRecurringByMonth.get(key) === promise) {
      realizingRecurringByMonth.delete(key);
    }
  }
}

/** 집계 입력에서 pending 제외 (불변식 #2) — 셀렉터 헬퍼. */
export const confirmedTransactions = (s: Pick<AppState, 'transactions'>): Transaction[] =>
  s.transactions.filter((t) => t.status === 'confirmed');
