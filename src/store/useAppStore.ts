import { create } from 'zustand';
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
import { nextMonth, prevMonth, todayYM, type YearMonth } from '../logic/period';

// 전역 상태 — selectedMonth + 로드된 엔티티. 파생 집계는 logic/* 순수함수로 계산.
// 화면 연결은 다음 세션. (PRD §2 — 월 기준 집계, pending 전 집계 제외)

interface AppState {
  selectedMonth: YearMonth;
  loaded: boolean;

  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  benefits: Benefit[];
  recurringRules: RecurringRule[];

  setSelectedMonth: (ym: YearMonth) => void;
  goPrevMonth: () => void;
  goNextMonth: () => void;
  loadAll: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedMonth: todayYM(),
  loaded: false,

  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  benefits: [],
  recurringRules: [],

  setSelectedMonth: (ym) => set({ selectedMonth: ym }),
  goPrevMonth: () => set({ selectedMonth: prevMonth(get().selectedMonth) }),
  goNextMonth: () => set({ selectedMonth: nextMonth(get().selectedMonth) }),

  loadAll: async () => {
    await seedDatabaseIfEmpty();
    const [accounts, transactions, categories, budgets, benefits, recurringRules] =
      await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.categories.toArray(),
        db.budgets.toArray(),
        db.benefits.toArray(),
        db.recurringRules.toArray(),
      ]);
    set({
      accounts,
      transactions,
      categories,
      budgets,
      benefits,
      recurringRules,
      loaded: true,
    });
  },
}));

/** 집계 입력에서 pending 제외 (불변식 #2) — 셀렉터 헬퍼. */
export const confirmedTransactions = (s: Pick<AppState, 'transactions'>): Transaction[] =>
  s.transactions.filter((t) => t.status === 'confirmed');
