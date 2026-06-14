import type { Category, Transaction } from '../db/types';
import { buildCategoryMap, rootCategoryId } from './category';
import {
  compareYM,
  daysInMonth,
  inMonth,
  prevMonth,
  todayYM,
  type YearMonth,
} from './period';
import dayjs from 'dayjs';

// 통계 / 인사이트 — PRD §4.9. 대분류 롤업 + 소분류 드릴다운, 추이, 전월대비, 일 평균.
// 모든 집계: expense·confirmed만 (pending·transfer 제외).

function isCountableExpense(t: Transaction, selectedMonth?: YearMonth): boolean {
  if (t.type !== 'expense') return false;
  if (t.status !== 'confirmed') return false;
  if (selectedMonth && !inMonth(t.date, selectedMonth)) return false;
  return true;
}

export function totalExpense(txns: Transaction[], selectedMonth: YearMonth): number {
  let sum = 0;
  for (const t of txns) if (isCountableExpense(t, selectedMonth)) sum += t.amount;
  return sum;
}

export interface CategorySlice {
  categoryId: string;
  amount: number;
  pct: number; // 0~1
  children: { categoryId: string; amount: number }[];
}

/** 대분류 롤업(소분류 드릴다운 포함), 금액 내림차순. */
export function categoryBreakdown(
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
): CategorySlice[] {
  const map = buildCategoryMap(categories);
  const roots = new Map<string, { amount: number; children: Map<string, number> }>();
  let total = 0;

  for (const t of txns) {
    if (!isCountableExpense(t, selectedMonth)) continue;
    const root = rootCategoryId(t.categoryId, map) ?? '__none__';
    total += t.amount;
    let entry = roots.get(root);
    if (!entry) {
      entry = { amount: 0, children: new Map() };
      roots.set(root, entry);
    }
    entry.amount += t.amount;
    const leaf = t.categoryId ?? '__none__';
    entry.children.set(leaf, (entry.children.get(leaf) ?? 0) + t.amount);
  }

  return [...roots.entries()]
    .map(([categoryId, e]) => ({
      categoryId,
      amount: e.amount,
      pct: total > 0 ? e.amount / total : 0,
      children: [...e.children.entries()]
        .map(([cid, amount]) => ({ categoryId: cid, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** 월별 지출 추이 (주어진 월 배열 순서대로). */
export function monthlyTrend(
  txns: Transaction[],
  months: YearMonth[],
): { month: YearMonth; total: number }[] {
  return months.map((m) => ({ month: m, total: totalExpense(txns, m) }));
}

export interface MonthOverMonth {
  current: number;
  previous: number;
  delta: number;
  pct: number | null; // 전월 0이면 null
}

export function monthOverMonth(txns: Transaction[], selectedMonth: YearMonth): MonthOverMonth {
  const current = totalExpense(txns, selectedMonth);
  const previous = totalExpense(txns, prevMonth(selectedMonth));
  const delta = current - previous;
  return {
    current,
    previous,
    delta,
    pct: previous > 0 ? delta / previous : null,
  };
}

/** 일 평균 지출. 현재달=경과일 기준, 과거달=그 달 전체 일수. */
export function dailyAverage(
  txns: Transaction[],
  selectedMonth: YearMonth,
  today?: string,
): { total: number; days: number; average: number } {
  const total = totalExpense(txns, selectedMonth);
  const cmp = compareYM(selectedMonth, todayYM(today));
  let days: number;
  if (cmp === 0) days = today ? dayjs(today).date() : dayjs().date();
  else if (cmp < 0) days = daysInMonth(selectedMonth);
  else days = 0; // 미래달
  return { total, days, average: days > 0 ? Math.round(total / days) : 0 };
}
