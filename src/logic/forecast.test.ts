import { describe, it, expect } from 'vitest';
import { forecastCardPerformance } from './forecast';
import { makeCard, makeRule, makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const cats = standardCategories();
const card = makeCard({ id: 'c1', card: { targetAmount: 300000, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], minPerTxn: 10000 } });

describe('forecastCardPerformance — 전망 = 달성 + 예정 자동이체 인정분', () => {
  const txns = [makeTxn({ accountId: 'c1', amount: 150000, categoryId: 'dining', date: '2026-06-03' })];

  it('미실현 인정 자동이체를 전망에 더한다', () => {
    const rules = [
      makeRule({ id: 'r1', accountId: 'c1', amount: 55000, dayOfMonth: 17, categoryId: 'dining' }),
    ];
    const f = forecastCardPerformance(card, txns, rules, cats, JUNE, '2026-06-10');
    expect(f.achieved).toBe(150000);
    expect(f.projected).toBe(55000);
    expect(f.forecast).toBe(205000);
    expect(f.forecastShortfall).toBe(95000);
  });

  it('실적 제외(공과금) 자동이체는 전망에서 빠진다', () => {
    const rules = [makeRule({ id: 'r2', accountId: 'c1', amount: 60000, dayOfMonth: 28, categoryId: 'maint' })];
    expect(forecastCardPerformance(card, txns, rules, cats, JUNE, '2026-06-10').projected).toBe(0);
  });

  it('이미 실현된(해당 recurringId 거래 존재) 규칙은 중복 더하지 않는다', () => {
    const rules = [makeRule({ id: 'r3', accountId: 'c1', amount: 55000, dayOfMonth: 5, categoryId: 'dining' })];
    const realized = [
      ...txns,
      makeTxn({ accountId: 'c1', amount: 55000, categoryId: 'dining', date: '2026-06-05', recurringId: 'r3', source: 'recurring' }),
    ];
    const f = forecastCardPerformance(card, realized, rules, cats, JUNE, '2026-06-10');
    expect(f.projected).toBe(0);
    expect(f.achieved).toBe(205000); // 실현 거래는 달성에 반영
  });
});
