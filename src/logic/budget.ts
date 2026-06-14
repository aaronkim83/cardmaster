import type { Budget, Category, Transaction } from '../db/types';
import { buildCategoryMap, rootCategoryId } from './category';
import { inMonth, type YearMonth } from './period';

// 예산 — PRD §4.8, 불변식 #2/#3. 대분류 권장(소분류도 가능), 매월 반복.
// 80%+ near(주황), 100%+ over(빨강). pending·transfer 제외.

export type BudgetStatus = 'normal' | 'near' | 'over';

export interface BudgetProgress {
  budgetId: string;
  categoryId: string | null;
  amount: number;
  spent: number;
  ratio: number;
  remaining: number;
  status: BudgetStatus;
}

function budgetStatus(ratio: number): BudgetStatus {
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'near';
  return 'normal';
}

/** 거래가 이 예산 대상에 포함되는지 (대분류 예산은 자식 소분류 롤업). */
function txnMatchesBudget(
  txn: Transaction,
  budget: Budget,
  categories: ReturnType<typeof buildCategoryMap>,
): boolean {
  if (txn.type !== 'expense') return false; // 이체·수입 제외
  if (budget.categoryId === null) return true; // 전체 예산
  if (txn.categoryId === budget.categoryId) return true;
  const root = rootCategoryId(txn.categoryId, categories);
  return root === budget.categoryId;
}

export function computeBudgetProgress(
  budget: Budget,
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
): BudgetProgress {
  const map = buildCategoryMap(categories);
  let spent = 0;
  for (const t of txns) {
    if (t.status !== 'confirmed') continue; // pending 제외
    if (!inMonth(t.date, selectedMonth)) continue;
    if (txnMatchesBudget(t, budget, map)) spent += t.amount;
  }
  const ratio = budget.amount > 0 ? spent / budget.amount : 0;
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    amount: budget.amount,
    spent,
    ratio,
    remaining: budget.amount - spent,
    status: budgetStatus(ratio),
  };
}

export function computeAllBudgets(
  budgets: Budget[],
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
): BudgetProgress[] {
  return budgets
    .filter((b) => b.isActive)
    .map((b) => computeBudgetProgress(b, txns, categories, selectedMonth));
}
