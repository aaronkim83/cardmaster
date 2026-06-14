import { describe, it, expect } from 'vitest';
import { computeBudgetProgress } from './budget';
import { makeBudget, makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const cats = standardCategories();

describe('computeBudgetProgress', () => {
  it('대분류 예산은 소분류 거래를 롤업한다', () => {
    const budget = makeBudget({ id: 'b', categoryId: 'food', amount: 350000 });
    const txns = [
      makeTxn({ accountId: 'a', amount: 200000, categoryId: 'dining', date: '2026-06-02' }),
      makeTxn({ accountId: 'a', amount: 112000, categoryId: 'food', date: '2026-06-03' }),
    ];
    const p = computeBudgetProgress(budget, txns, cats, JUNE);
    expect(p.spent).toBe(312000);
    expect(p.status).toBe('near'); // 312/350 ≈ 89%
  });

  it('초과 시 over, pending·이체·타월 제외', () => {
    const budget = makeBudget({ id: 'b', categoryId: 'food', amount: 150000 });
    const txns = [
      makeTxn({ accountId: 'a', amount: 194500, categoryId: 'dining', date: '2026-06-02' }),
      makeTxn({ accountId: 'a', amount: 50000, categoryId: 'dining', date: '2026-06-04', status: 'pending' }),
      makeTxn({ accountId: 'a', amount: 50000, categoryId: 'dining', date: '2026-06-04', type: 'transfer' }),
      makeTxn({ accountId: 'a', amount: 50000, categoryId: 'dining', date: '2026-05-30' }),
    ];
    const p = computeBudgetProgress(budget, txns, cats, JUNE);
    expect(p.spent).toBe(194500);
    expect(p.status).toBe('over');
    expect(p.remaining).toBe(-44500);
  });

  it('전체(categoryId=null) 예산은 모든 지출 합산', () => {
    const budget = makeBudget({ id: 'all', categoryId: null, amount: 1200000 });
    const txns = [
      makeTxn({ accountId: 'a', amount: 312000, categoryId: 'dining', date: '2026-06-02' }),
      makeTxn({ accountId: 'a', amount: 60000, categoryId: 'maint', date: '2026-06-03' }),
    ];
    expect(computeBudgetProgress(budget, txns, cats, JUNE).spent).toBe(372000);
  });
});
