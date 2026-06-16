import { describe, it, expect } from 'vitest';
import { accrueBenefit, computeBenefits } from './benefit';
import { makeBenefit, makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const cats = standardCategories();

describe('accrueBenefit — 한도 클리핑', () => {
  it('benefit_amount 한도: 초과분 제외', () => {
    const b = makeBenefit({ id: 'b', accountId: 'c1', rate: 0.5, monthlyLimit: 5000, limitBasis: 'benefit_amount' });
    const first = accrueBenefit(b, 6000, 0); // raw 3000
    expect(first.applied).toBe(3000);
    const second = accrueBenefit(b, 6000, first.newUsed); // 남은 한도 2000
    expect(second.applied).toBe(2000);
    expect(second.newUsed).toBe(5000);
  });

  it('spend_amount 한도: 사용액 기준 캡', () => {
    const b = makeBenefit({ id: 'b', accountId: 'c1', rate: 0.1, monthlyLimit: 100000, limitBasis: 'spend_amount' });
    const r = accrueBenefit(b, 120000, 0); // 사용액 10만까지만 → 혜택 10000
    expect(r.applied).toBe(10000);
    expect(r.newUsed).toBe(100000);
  });

  it('한도 없으면 raw 그대로', () => {
    const b = makeBenefit({ id: 'b', accountId: 'c1', rate: 0.07 });
    expect(accrueBenefit(b, 40000, 0).applied).toBe(2800);
  });

  it('정액 혜택은 거래금액과 무관하게 고정 금액을 적용한다', () => {
    const b = makeBenefit({ id: 'b', accountId: 'c1', valueType: 'fixed', fixedAmount: 1500, rate: 0 });
    expect(accrueBenefit(b, 40000, 0).applied).toBe(1500);
  });

  it('정액 혜택도 benefit_amount 월 한도에서 초과분을 제외한다', () => {
    const b = makeBenefit({ id: 'b', accountId: 'c1', valueType: 'fixed', fixedAmount: 3000, rate: 0, monthlyLimit: 5000, limitBasis: 'benefit_amount' });
    const first = accrueBenefit(b, 10000, 0);
    const second = accrueBenefit(b, 10000, first.newUsed);
    expect(first.applied).toBe(3000);
    expect(second.applied).toBe(2000);
  });
});

describe('computeBenefits — 3단계 가시화', () => {
  const benefits = [
    makeBenefit({ id: 'sb', accountId: 'c1', name: '스타벅스 50% 할인', type: 'discount', rate: 0.5, targetMerchant: '스타벅스', monthlyLimit: 5000, limitBasis: 'benefit_amount' }),
    makeBenefit({ id: 'mp', accountId: 'c2', name: 'M포인트 5% 적립', type: 'point', rate: 0.05, requiresPerformance: true }),
  ];

  it('할인/적립을 분리 집계하고 카드별 합계를 낸다', () => {
    const txns = [
      makeTxn({ accountId: 'c1', amount: 6000, merchant: '스타벅스 강남R점', date: '2026-06-02' }),
      makeTxn({ accountId: 'c1', amount: 6000, merchant: '스타벅스 역삼점', date: '2026-06-05' }),
    ];
    const s = computeBenefits(txns, benefits, cats, JUNE, new Set(['c1', 'c2']));
    expect(s.total.discount).toBe(5000); // 3000 + 한도 잔여 2000
    expect(s.byCard.get('c1')).toBe(5000);
    expect(s.byBenefit.get('sb')?.exhausted).toBe(true);
  });

  it('requiresPerformance 미충족 카드 → 미적용·예상치로만 표시', () => {
    const txns = [makeTxn({ accountId: 'c2', amount: 100000, merchant: '쿠팡', date: '2026-06-03' })];
    const s = computeBenefits(txns, benefits, cats, JUNE, new Set()); // c2 미충족
    expect(s.total.point).toBe(0); // 실제 적용 없음
    expect(s.byBenefit.get('mp')?.estimated).toBe(true);
    expect(s.byBenefit.get('mp')?.received).toBe(5000); // 예상 혜택
  });

  it('requiresPerformance 충족 시 실제 적용', () => {
    const txns = [makeTxn({ accountId: 'c2', amount: 100000, merchant: '쿠팡', date: '2026-06-03' })];
    const s = computeBenefits(txns, benefits, cats, JUNE, new Set(['c2']));
    expect(s.total.point).toBe(5000);
    expect(s.byBenefit.get('mp')?.estimated).toBe(false);
  });
});
