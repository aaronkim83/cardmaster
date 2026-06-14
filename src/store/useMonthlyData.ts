import { useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { computeAllCardPerformance } from '../logic/performance';
import { forecastCardPerformance, type CardForecast } from '../logic/forecast';
import { computeBenefits, type BenefitSummary } from '../logic/benefit';
import { computeAllBudgets, type BudgetProgress } from '../logic/budget';
import { categoryBreakdown, dailyAverage, monthOverMonth, monthlyTrend, totalExpense } from '../logic/stats';
import { netWorth, type NetWorth } from '../logic/balance';
import { addMonths, type YearMonth } from '../logic/period';

export interface MonthlyData {
  selectedMonth: YearMonth;
  performances: CardForecast[];
  metCardIds: Set<string>;
  benefits: BenefitSummary;
  budgets: BudgetProgress[];
  totalExpense: number;
  totalIncome: number;
  breakdown: ReturnType<typeof categoryBreakdown>;
  mom: ReturnType<typeof monthOverMonth>;
  dailyAvg: ReturnType<typeof dailyAverage>;
  trend: { month: YearMonth; total: number }[];
  netWorth: NetWorth;
}

/** selectedMonth 기준 모든 파생 집계 (메모이즈). pending 제외는 각 logic 함수가 처리. */
export function useMonthlyData(): MonthlyData {
  const accounts = useAppStore((s) => s.accounts);
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const benefitDefs = useAppStore((s) => s.benefits);
  const budgetDefs = useAppStore((s) => s.budgets);
  const rules = useAppStore((s) => s.recurringRules);
  const selectedMonth = useAppStore((s) => s.selectedMonth);

  return useMemo(() => {
    const base = computeAllCardPerformance(accounts, transactions, categories, selectedMonth);
    const metCardIds = new Set(base.filter((p) => p.achieved >= p.target).map((p) => p.cardId));

    const performances = accounts
      .filter((a) => a.card?.trackPerformance)
      .map((card) => forecastCardPerformance(card, transactions, rules, categories, selectedMonth));

    const trendMonths = [-5, -4, -3, -2, -1, 0].map((n) => addMonths(selectedMonth, n));

    const totalIncome = transactions
      .filter((t) => t.type === 'income' && t.status === 'confirmed' && t.date.slice(0, 7) === `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`)
      .reduce((s, t) => s + t.amount, 0);

    return {
      selectedMonth,
      performances,
      metCardIds,
      benefits: computeBenefits(transactions, benefitDefs, categories, selectedMonth, metCardIds),
      budgets: computeAllBudgets(budgetDefs, transactions, categories, selectedMonth),
      totalExpense: totalExpense(transactions, selectedMonth),
      totalIncome,
      breakdown: categoryBreakdown(transactions, categories, selectedMonth),
      mom: monthOverMonth(transactions, selectedMonth),
      dailyAvg: dailyAverage(transactions, selectedMonth),
      trend: monthlyTrend(transactions, trendMonths),
      netWorth: netWorth(accounts, transactions),
    };
  }, [accounts, transactions, categories, benefitDefs, budgetDefs, rules, selectedMonth]);
}
