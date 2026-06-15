import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  Account,
  Benefit,
  Budget,
  Category,
  RecurringRule,
  Transaction,
} from '../db/types';
import { db } from '../db/schema';
import { seedDatabaseIfEmpty } from '../db/seed';
import { seedDemoDataIfEmpty } from '../db/demoSeed';
import { nextMonth, prevMonth, todayYM, type YearMonth } from '../logic/period';

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
  | 'budget';

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

  setSelectedMonth: (ym: YearMonth) => void;
  goPrevMonth: () => void;
  goNextMonth: () => void;

  navigate: (screen: ScreenId, params?: NavParams, options?: { preserveHistory?: boolean }) => void;
  goBack: () => void;

  loadAll: () => Promise<void>;

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  saveAccount: (a: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  saveBenefit: (b: Benefit) => Promise<void>;
  deleteBenefit: (id: string) => Promise<void>;

  saveBudget: (b: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (ordered: Category[]) => Promise<void>;

  saveRecurring: (r: RecurringRule) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;

  restoreFromBackup: (data: unknown) => Promise<void>;
}

const TAB_SCREENS: ScreenId[] = ['home', 'ledger', 'input', 'stats', 'more'];

// 모듈 레벨 시드 1회 가드 (동시 호출 dedupe)
let seedOnce: Promise<void> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  selectedMonth: todayYM(),
  loaded: false,

  screen: 'home',
  params: {},
  history: [],

  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  benefits: [],
  recurringRules: [],

  setSelectedMonth: (ym) => set({ selectedMonth: ym }),
  goPrevMonth: () => set({ selectedMonth: prevMonth(get().selectedMonth) }),
  goNextMonth: () => set({ selectedMonth: nextMonth(get().selectedMonth) }),

  navigate: (screen, params = {}, options = {}) => {
    const cur = get();
    // 탭 전환은 히스토리를 리셋, 상세 진입은 스택에 쌓기
    const history = TAB_SCREENS.includes(screen) && !options.preserveHistory
      ? []
      : [...cur.history, { screen: cur.screen, params: cur.params }];
    set({ screen, params, history });
  },
  goBack: () => {
    const { history } = get();
    if (history.length === 0) {
      set({ screen: 'home', params: {} });
      return;
    }
    const prev = history[history.length - 1];
    set({ screen: prev.screen, params: prev.params, history: history.slice(0, -1) });
  },

  loadAll: async () => {
    // StrictMode 이중 마운트/동시 호출에서 시드가 두 번 돌지 않도록 1회 보장
    seedOnce ??= (async () => {
      await seedDatabaseIfEmpty();
      await seedDemoDataIfEmpty();
    })();
    await seedOnce;
    await reload(set);
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
  },
  deleteRecurring: async (id) => {
    await db.recurringRules.delete(id);
    await reload(set);
  },

  restoreFromBackup: async (data) => {
    const d = data as Record<string, unknown[]>;
    const tables: [keyof typeof db, unknown[] | undefined][] = [
      ['accounts', d.accounts], ['transactions', d.transactions], ['categories', d.categories],
      ['budgets', d.budgets], ['benefits', d.benefits], ['recurringRules', d.recurringRules],
      ['balanceSnapshots', d.balanceSnapshots], ['settings', d.settings],
    ];
    await db.transaction('rw', [db.accounts, db.transactions, db.categories, db.budgets, db.benefits, db.recurringRules, db.balanceSnapshots, db.settings], async () => {
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
  const [accounts, transactions, categories, budgets, benefits, recurringRules] =
    await Promise.all([
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.categories.toArray(),
      db.budgets.toArray(),
      db.benefits.toArray(),
      db.recurringRules.toArray(),
    ]);
  set({ accounts, transactions, categories, budgets, benefits, recurringRules, loaded: true });
}

/** 집계 입력에서 pending 제외 (불변식 #2) — 셀렉터 헬퍼. */
export const confirmedTransactions = (s: Pick<AppState, 'transactions'>): Transaction[] =>
  s.transactions.filter((t) => t.status === 'confirmed');
