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
  | 'category';

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

  navigate: (screen: ScreenId, params?: NavParams) => void;
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
  saveCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const TAB_SCREENS: ScreenId[] = ['home', 'ledger', 'input', 'stats', 'more'];

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

  navigate: (screen, params = {}) => {
    const cur = get();
    // 탭 전환은 히스토리를 리셋, 상세 진입은 스택에 쌓기
    const history = TAB_SCREENS.includes(screen)
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
    await seedDatabaseIfEmpty();
    await seedDemoDataIfEmpty();
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
  saveCategory: async (c) => {
    await db.categories.put(c);
    await reload(set);
  },
  deleteCategory: async (id) => {
    await db.categories.delete(id);
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
