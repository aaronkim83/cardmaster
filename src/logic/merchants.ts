import type { Account, Benefit, Category, Transaction } from '../db/types';
import { buildCategoryMap } from './category';
import { txnCountsForCard } from './performance';
import { inMonth, type YearMonth } from './period';

// Top3 가맹점 (카드별) — PRD §4.10, 불변식 #6.
// source='recurring'(자동이체) 제외, 실적 인정 거래 우선, 상위 3. 혜택 대상 가맹점 강조.

export interface TopMerchant {
  merchant: string;
  count: number; // 비-자동이체 지출 빈도
  qualifyingCount: number; // 그중 실적 인정 건수
  total: number; // 합계 금액
  isBenefit: boolean; // 혜택 대상 가맹점(🎁)
}

export function topMerchants(
  card: Account,
  txns: Transaction[],
  categories: Category[],
  selectedMonth: YearMonth,
  benefits: Benefit[] = [],
  limit = 3,
): TopMerchant[] {
  const map = buildCategoryMap(categories);
  const cardBenefitMerchants = benefits
    .filter((b) => b.accountId === card.id && b.isActive && b.targetMerchant)
    .map((b) => b.targetMerchant as string);

  const agg = new Map<string, { count: number; qualifying: number; total: number }>();
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    if (t.accountId !== card.id) continue;
    if (t.source === 'recurring') continue; // 불변식 #6: 자동이체 제외
    if (t.status !== 'confirmed') continue;
    if (!inMonth(t.date, selectedMonth)) continue;
    const name = (t.merchant ?? '').trim();
    if (!name) continue;
    let e = agg.get(name);
    if (!e) {
      e = { count: 0, qualifying: 0, total: 0 };
      agg.set(name, e);
    }
    e.count += 1;
    e.total += t.amount;
    if (txnCountsForCard(t, card, map)) e.qualifying += 1;
  }

  return [...agg.entries()]
    .map(([merchant, e]) => ({
      merchant,
      count: e.count,
      qualifyingCount: e.qualifying,
      total: e.total,
      isBenefit: cardBenefitMerchants.some((m) => merchant.includes(m)),
    }))
    // 실적 인정 거래 우선 → 빈도 → 금액
    .sort(
      (a, b) =>
        b.qualifyingCount - a.qualifyingCount || b.count - a.count || b.total - a.total,
    )
    .slice(0, limit);
}
