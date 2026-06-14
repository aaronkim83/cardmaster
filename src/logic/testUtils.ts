// 로직 테스트용 공용 팩토리 (테스트에서만 import).
import type {
  Account,
  Benefit,
  Budget,
  Category,
  RecurringRule,
  Transaction,
} from '../db/types';

export function makeCard(over: Partial<Account> & { id: string }): Account {
  return {
    name: 'Card',
    kind: 'liability',
    type: 'card',
    balanceMode: 'calculated',
    openingBalance: 0,
    isPinned: false,
    isActive: true,
    sortOrder: 0,
    createdAt: 0,
    ...over,
    card: {
      targetAmount: 300000,
      cycleType: 'prev_month',
      trackPerformance: true,
      excludedCategoryIds: [],
      ...over.card,
    },
  };
}

export function makeAccount(over: Partial<Account> & { id: string }): Account {
  return {
    name: 'Account',
    kind: 'asset',
    type: 'bank',
    balanceMode: 'calculated',
    openingBalance: 0,
    isPinned: false,
    isActive: true,
    sortOrder: 0,
    createdAt: 0,
    ...over,
  };
}

let txnSeq = 0;
export function makeTxn(over: Partial<Transaction> & { amount: number; accountId: string }): Transaction {
  return {
    id: `t${txnSeq++}`,
    date: '2026-06-10',
    type: 'expense',
    categoryId: undefined,
    countsForPerformance: null,
    source: 'manual',
    status: 'confirmed',
    createdAt: 0,
    ...over,
  };
}

export function makeCategory(over: Partial<Category> & { id: string; name: string }): Category {
  return {
    type: 'expense',
    icon: '🏷️',
    color: '#000',
    parentId: null,
    defaultExcluded: false,
    isCustom: false,
    sortOrder: 0,
    ...over,
  };
}

export function makeBudget(over: Partial<Budget> & { id: string; amount: number }): Budget {
  return { categoryId: null, isActive: true, ...over };
}

export function makeBenefit(over: Partial<Benefit> & { id: string; accountId: string }): Benefit {
  return {
    name: 'Benefit',
    type: 'discount',
    rate: 0.1,
    requiresPerformance: false,
    isActive: true,
    ...over,
  };
}

export function makeRule(
  over: Partial<RecurringRule> & { id: string; accountId: string; amount: number; dayOfMonth: number },
): RecurringRule {
  return {
    name: 'Rule',
    type: 'expense',
    isVariable: false,
    startDate: '2026-01-01',
    autoConfirm: true,
    isActive: true,
    ...over,
  };
}

/** 2단 카테고리 표준 픽스처: 식비(외식) / 공과금(관리비, 제외). */
export function standardCategories(): Category[] {
  return [
    makeCategory({ id: 'food', name: '식비' }),
    makeCategory({ id: 'dining', name: '외식', parentId: 'food' }),
    makeCategory({ id: 'util', name: '공과금', defaultExcluded: true }),
    makeCategory({ id: 'maint', name: '관리비', parentId: 'util' }),
  ];
}
