import { nanoid } from 'nanoid';
import type { RecurringRule, Transaction } from '../db/types';
import { compareYM, daysInMonth, inMonth, monthKey, todayYM, ymOfDate, type YearMonth } from './period';

// 자동이체 실체화 — PRD §4.6, 불변식 #2.
// 도래분 생성: 고정=confirmed, 변동=pending. selectedMonth 기준.

/** 규칙의 selectedMonth 도래일 (dayOfMonth가 말일 초과 시 말일로 클램프). */
export function dueDate(rule: RecurringRule, selectedMonth: YearMonth): string {
  const dim = daysInMonth(selectedMonth);
  const day = Math.min(Math.max(rule.dayOfMonth, 1), dim);
  return `${monthKey(selectedMonth)}-${String(day).padStart(2, '0')}`;
}

/** selectedMonth에 규칙이 유효 범위 안에 있는지 (start/end). */
export function isRuleActiveInMonth(rule: RecurringRule, selectedMonth: YearMonth): boolean {
  if (!rule.isActive) return false;
  const startYM = ymOfDate(rule.startDate);
  if (compareYM(selectedMonth, startYM) < 0) return false;
  if (rule.endDate && compareYM(selectedMonth, ymOfDate(rule.endDate)) > 0) return false;
  return true;
}

/** 도래일이 today(또는 현재) 시점에 이미 지났는지 — 현재/과거달 실체화 조건. */
export function isDueReached(rule: RecurringRule, selectedMonth: YearMonth, today?: string): boolean {
  if (!isRuleActiveInMonth(rule, selectedMonth)) return false;
  const cmp = compareYM(selectedMonth, todayYM(today));
  if (cmp < 0) return true; // 과거달 — 전부 도래
  if (cmp > 0) return false; // 미래달 — 미도래
  return dueDate(rule, selectedMonth) <= (today ?? new Date().toISOString().slice(0, 10));
}

export function isAlreadyRealized(
  rule: RecurringRule,
  txns: Transaction[],
  selectedMonth: YearMonth,
): boolean {
  return txns.some((t) => t.recurringId === rule.id && inMonth(t.date, selectedMonth));
}

/** 규칙 → 거래 1건 실체화. 변동(isVariable)이거나 autoConfirm=false면 pending. */
export function materializeRule(rule: RecurringRule, selectedMonth: YearMonth): Transaction {
  const confirmed = !rule.isVariable && rule.autoConfirm;
  return {
    id: nanoid(),
    date: dueDate(rule, selectedMonth),
    type: rule.type,
    amount: rule.amount,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    merchant: rule.name,
    countsForPerformance: null,
    source: 'recurring',
    status: confirmed ? 'confirmed' : 'pending',
    recurringId: rule.id,
    createdAt: Date.now(),
  };
}

/** selectedMonth에 도래했고 아직 실현되지 않은 규칙들을 거래로 생성. */
export function generateDueTransactions(
  rules: RecurringRule[],
  existingTxns: Transaction[],
  selectedMonth: YearMonth,
  today?: string,
): Transaction[] {
  const out: Transaction[] = [];
  for (const rule of rules) {
    if (!isDueReached(rule, selectedMonth, today)) continue;
    if (isAlreadyRealized(rule, existingTxns, selectedMonth)) continue;
    out.push(materializeRule(rule, selectedMonth));
  }
  return out;
}
