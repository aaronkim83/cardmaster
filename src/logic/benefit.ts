import type { Benefit, Category, Transaction } from '../db/types';
import { buildCategoryMap, type CategoryMap } from './category';
import { inMonth, type YearMonth } from './period';

// 혜택 · 절약액 가시화 (3단계) — PRD §4.4, 불변식 #7.
// 매칭 → requiresPerformance 미충족이면 미적용(예상 별도) → benefitAmount=round(amount*rate)
//   → 월 한도 초과분 제외 → 한도 내 실제분만 저장.

/** 거래가 혜택 대상인지 (가맹점 부분일치 또는 카테고리/대분류 일치). */
export function matchesBenefit(
  txn: Transaction,
  benefit: Benefit,
  map: CategoryMap,
): boolean {
  if (!benefit.isActive) return false;
  if (benefit.accountId !== txn.accountId) return false;
  if (txn.type !== 'expense') return false;
  if (benefit.targetMerchant) {
    return !!txn.merchant && txn.merchant.includes(benefit.targetMerchant);
  }
  if (benefit.targetCategoryId) {
    if (txn.categoryId === benefit.targetCategoryId) return true;
    const cat = txn.categoryId ? map.get(txn.categoryId) : undefined;
    return cat?.parentId === benefit.targetCategoryId;
  }
  return true; // 대상 미지정 = 전체 사용액 대상
}

/** 거래의 카드를 위한 첫 매칭 혜택. */
export function findBenefit(
  txn: Transaction,
  benefits: Benefit[],
  map: CategoryMap,
): Benefit | undefined {
  return benefits.find((b) => matchesBenefit(txn, b, map));
}

/** 한도 누적을 반영해 이 거래에 실제 적용될 혜택액 계산. */
export function accrueBenefit(
  benefit: Benefit,
  txnAmount: number,
  prevUsed: number,
): { applied: number; newUsed: number } {
  const raw = Math.round(txnAmount * benefit.rate);
  if (benefit.monthlyLimit === undefined) {
    const used = benefit.limitBasis === 'spend_amount' ? prevUsed + txnAmount : prevUsed + raw;
    return { applied: raw, newUsed: used };
  }
  if (benefit.limitBasis === 'spend_amount') {
    const remainingSpend = Math.max(benefit.monthlyLimit - prevUsed, 0);
    const eligibleSpend = Math.min(txnAmount, remainingSpend);
    return { applied: Math.round(eligibleSpend * benefit.rate), newUsed: prevUsed + eligibleSpend };
  }
  // limitBasis: benefit_amount (기본)
  const remaining = Math.max(benefit.monthlyLimit - prevUsed, 0);
  const applied = Math.min(raw, remaining);
  return { applied, newUsed: prevUsed + applied };
}

export interface BenefitProgress {
  benefitId: string;
  accountId: string;
  type: 'discount' | 'point';
  received: number; // 받은 혜택액
  limit?: number;
  exhausted: boolean;
  estimated: boolean; // requiresPerformance 미충족 → 예상치
}

export interface BenefitSummary {
  total: { discount: number; point: number };
  byCard: Map<string, number>; // accountId → 실제 받은 혜택 합
  byBenefit: Map<string, BenefitProgress>;
  /** 거래별 적용 결과 (실제 적용분만; 예상은 별도) */
  applied: Map<string, { benefitId: string; benefitAmount: number }>;
}

/**
 * selectedMonth 혜택 가시화 집계.
 * @param metCardIds 실적 충족(혜택 적용 가능) 카드 id 집합.
 */
export function computeBenefits(
  txns: Transaction[],
  benefits: Benefit[],
  categories: Category[],
  selectedMonth: YearMonth,
  metCardIds: Set<string>,
): BenefitSummary {
  const map = buildCategoryMap(categories);
  const used = new Map<string, number>(); // benefitId → 한도 기준 누적
  const summary: BenefitSummary = {
    total: { discount: 0, point: 0 },
    byCard: new Map(),
    byBenefit: new Map(),
    applied: new Map(),
  };

  // 거래는 날짜 오름차순으로 한도 소진 순서 안정화
  const monthTxns = txns
    .filter((t) => t.status === 'confirmed' && inMonth(t.date, selectedMonth))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const txn of monthTxns) {
    const benefit = findBenefit(txn, benefits, map);
    if (!benefit) continue;

    const prog = getOrInitProgress(summary, benefit);
    const met = !benefit.requiresPerformance || metCardIds.has(benefit.accountId);

    const prev = used.get(benefit.id) ?? 0;
    const { applied, newUsed } = accrueBenefit(benefit, txn.amount, prev);

    if (!met) {
      // 미적용 — 예상치로만 누적 (실제 합·한도 소진에는 반영하지 않음)
      prog.estimated = true;
      prog.received += applied; // 예상 혜택
      continue;
    }

    used.set(benefit.id, newUsed);
    prog.received += applied;
    prog.exhausted =
      benefit.monthlyLimit !== undefined &&
      newUsed >= benefit.monthlyLimit;

    if (applied > 0) {
      summary.applied.set(txn.id, { benefitId: benefit.id, benefitAmount: applied });
      summary.byCard.set(benefit.accountId, (summary.byCard.get(benefit.accountId) ?? 0) + applied);
      if (benefit.type === 'discount') summary.total.discount += applied;
      else summary.total.point += applied;
    }
  }

  return summary;
}

function getOrInitProgress(summary: BenefitSummary, benefit: Benefit): BenefitProgress {
  let prog = summary.byBenefit.get(benefit.id);
  if (!prog) {
    prog = {
      benefitId: benefit.id,
      accountId: benefit.accountId,
      type: benefit.type,
      received: 0,
      limit: benefit.monthlyLimit,
      exhausted: false,
      estimated: false,
    };
    summary.byBenefit.set(benefit.id, prog);
  }
  return prog;
}
