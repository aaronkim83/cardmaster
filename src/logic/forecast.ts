import type { Account, Category, RecurringRule, Transaction } from '../db/types';
import { buildCategoryMap, isExcludedForCard } from './category';
import { computeCardPerformance, type CardPerformance } from './performance';
import { inMonth, monthKey, type YearMonth } from './period';

// 실적 전망 — PRD §4.7. 전망 = 현재 달성(확정) + 예정 자동이체 실적 인정분.

export interface CardForecast extends CardPerformance {
  projected: number; // 미실현 자동이체 인정분
  forecast: number; // achieved + projected
  forecastShortfall: number; // max(target - forecast, 0)
}

/** 자동이체 규칙이 이 카드 실적에 인정될 금액(인정 안 되면 0). */
function ruleQualifiesForCard(
  rule: RecurringRule,
  card: Account,
  categories: Category[],
): boolean {
  if (!rule.isActive) return false;
  if (rule.type !== 'expense') return false;
  if (rule.accountId !== card.id) return false;
  const map = buildCategoryMap(categories);
  if (isExcludedForCard(card, rule.categoryId, map)) return false;
  const min = card.card?.minPerTxn ?? 0;
  if (rule.amount < min) return false;
  return true;
}

/** selectedMonth에 아직 실현되지 않은 규칙인지 (해당 recurringId 거래가 그 달에 없음). */
function isUnrealized(rule: RecurringRule, txns: Transaction[], selectedMonth: YearMonth): boolean {
  if (rule.endDate && rule.endDate < `${monthKey(selectedMonth)}-01`) return false;
  if (rule.startDate > `${monthKey(selectedMonth)}-31`) return false;
  return !txns.some((t) => t.recurringId === rule.id && inMonth(t.date, selectedMonth));
}

export function forecastCardPerformance(
  card: Account,
  txns: Transaction[],
  rules: RecurringRule[],
  categories: Category[],
  selectedMonth: YearMonth,
  today?: string,
): CardForecast {
  const base = computeCardPerformance(card, txns, categories, selectedMonth, today);
  let projected = 0;
  for (const rule of rules) {
    if (!ruleQualifiesForCard(rule, card, categories)) continue;
    if (!isUnrealized(rule, txns, selectedMonth)) continue;
    projected += rule.amount;
  }
  const forecast = base.achieved + projected;
  return {
    ...base,
    projected,
    forecast,
    forecastShortfall: Math.max(base.target - forecast, 0),
  };
}
