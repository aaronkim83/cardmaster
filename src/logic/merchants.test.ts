import { describe, it, expect } from 'vitest';
import { topMerchants } from './merchants';
import { makeBenefit, makeCard, makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const cats = standardCategories();
const card = makeCard({ id: 'c1', card: { targetAmount: 300000, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], minPerTxn: 0 } });

describe('topMerchants — 자동이체 제외 & 빈도 상위 (불변식 #6)', () => {
  const txns = [
    makeTxn({ accountId: 'c1', amount: 6000, merchant: '스타벅스', categoryId: 'dining', date: '2026-06-02' }),
    makeTxn({ accountId: 'c1', amount: 6500, merchant: '스타벅스', categoryId: 'dining', date: '2026-06-09' }),
    makeTxn({ accountId: 'c1', amount: 30000, merchant: '쿠팡', categoryId: 'dining', date: '2026-06-03' }),
    makeTxn({ accountId: 'c1', amount: 14900, merchant: '유튜브', categoryId: 'dining', date: '2026-06-10', source: 'recurring' }), // 자동이체 제외
    makeTxn({ accountId: 'c2', amount: 9000, merchant: '다이소', categoryId: 'dining', date: '2026-06-04' }), // 다른 카드
  ];

  it('자동이체·타카드 제외, 빈도순 상위 3', () => {
    const top = topMerchants(card, txns, cats, JUNE, [], 3);
    expect(top.map((t) => t.merchant)).toEqual(['스타벅스', '쿠팡']);
    expect(top[0].count).toBe(2);
    expect(top.some((t) => t.merchant === '유튜브')).toBe(false);
  });

  it('혜택 대상 가맹점을 isBenefit으로 강조', () => {
    const benefits = [makeBenefit({ id: 'b', accountId: 'c1', targetMerchant: '스타벅스' })];
    const top = topMerchants(card, txns, cats, JUNE, benefits, 3);
    expect(top.find((t) => t.merchant === '스타벅스')?.isBenefit).toBe(true);
    expect(top.find((t) => t.merchant === '쿠팡')?.isBenefit).toBe(false);
  });
});
