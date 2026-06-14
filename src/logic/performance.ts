import type { Account, Category, Transaction } from '../db/types';
import { buildCategoryMap, isExcludedForCard, type CategoryMap } from './category';
import {
  compareYM,
  daysInMonth,
  inMonth,
  nextMonth,
  todayYM,
  type YearMonth,
} from './period';
import dayjs from 'dayjs';

// 카드 실적 (전월/당월) — PRD §4.3, 불변식 #2/#4/#5.

export type PerfStatus = 'achieved' | 'behind' | 'ontrack' | 'short' | 'upcoming';

export interface CardPerformance {
  cardId: string;
  target: number;
  achieved: number; // confirmed 인정 거래 합 (pending 제외)
  shortfall: number; // max(target - achieved, 0)
  ratio: number; // achieved / target
  status: PerfStatus;
  pacePct: number; // 0~1, 현재달 진행률 마커
  benefitMonth: YearMonth; // 이 실적이 적용되는 혜택 월 (라벨용)
}

/**
 * 단일 거래가 특정 카드의 실적에 인정되는지.
 * 우선순위: pending 제외(절대) → 구조 게이트(해당카드·지출) → 수동 오버라이드 > 자동판정.
 */
export function txnCountsForCard(txn: Transaction, card: Account, map: CategoryMap): boolean {
  if (txn.status !== 'confirmed') return false; // 불변식 #2: pending 전 집계 제외
  if (txn.accountId !== card.id) return false;
  if (txn.type !== 'expense') return false; // 이체·수입 제외 (불변식 #3)

  // 불변식 #4: 수동값(true/false)이 자동판정을 이긴다
  if (txn.countsForPerformance === true) return true;
  if (txn.countsForPerformance === false) return false;

  // 자동판정: 카테고리 미제외(대분류 상속) && amount ≥ minPerTxn
  if (isExcludedForCard(card, txn.categoryId, map)) return false;
  const min = card.card?.minPerTxn ?? 0;
  if (txn.amount < min) return false;
  return true;
}

/** 이 실적이 적용되는 혜택 월: 당월기준=selectedMonth, 전월기준=다음달. */
export function benefitMonthOf(card: Account, selectedMonth: YearMonth): YearMonth {
  return card.card?.cycleType === 'prev_month' ? nextMonth(selectedMonth) : selectedMonth;
}

function paceStatus(
  achieved: number,
  target: number,
  selectedMonth: YearMonth,
  today: string | undefined,
): { status: PerfStatus; pacePct: number } {
  const ratio = target > 0 ? achieved / target : 1;
  if (ratio >= 1) return { status: 'achieved', pacePct: 1 };

  const cmp = compareYM(selectedMonth, todayYM(today));
  if (cmp < 0) return { status: 'short', pacePct: 1 }; // 과거달 미달 확정
  if (cmp > 0) return { status: 'upcoming', pacePct: 0 }; // 미래달

  // 현재달: 경과일 기준 페이스
  const day = today ? dayjs(today).date() : dayjs().date();
  const pacePct = Math.min(day / daysInMonth(selectedMonth), 1);
  const status: PerfStatus = ratio >= pacePct ? 'ontrack' : 'behind';
  return { status, pacePct };
}

/** 카드 1장의 selectedMonth 실적 산정 (확정 거래 기준). */
export function computeCardPerformance(
  card: Account,
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
  today?: string,
): CardPerformance {
  const map = buildCategoryMap(categories);
  const target = card.card?.targetAmount ?? 0;
  let achieved = 0;
  for (const t of txns) {
    if (!inMonth(t.date, selectedMonth)) continue;
    if (txnCountsForCard(t, card, map)) achieved += t.amount;
  }
  const ratio = target > 0 ? achieved / target : 1;
  const { status, pacePct } = paceStatus(achieved, target, selectedMonth, today);
  return {
    cardId: card.id,
    target,
    achieved,
    shortfall: Math.max(target - achieved, 0),
    ratio,
    status,
    pacePct,
    benefitMonth: benefitMonthOf(card, selectedMonth),
  };
}

/** 실적 추적 ON인 카드 전체의 selectedMonth 실적. */
export function computeAllCardPerformance(
  accounts: Account[],
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
  today?: string,
): CardPerformance[] {
  return accounts
    .filter((a) => a.card?.trackPerformance)
    .map((card) => computeCardPerformance(card, txns, categories, selectedMonth, today));
}
