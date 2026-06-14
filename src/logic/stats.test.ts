import { describe, it, expect } from 'vitest';
import { categoryBreakdown, dailyAverage, monthOverMonth, monthlyTrend, totalExpense } from './stats';
import { makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const MAY: YearMonth = { year: 2026, month: 5 };
const cats = standardCategories();

const txns = [
  makeTxn({ accountId: 'a', amount: 200000, categoryId: 'dining', date: '2026-06-02' }),
  makeTxn({ accountId: 'a', amount: 100000, categoryId: 'food', date: '2026-06-03' }),
  makeTxn({ accountId: 'a', amount: 60000, categoryId: 'maint', date: '2026-06-04' }),
  makeTxn({ accountId: 'a', amount: 99999, categoryId: 'dining', date: '2026-06-05', status: 'pending' }), // 제외
  makeTxn({ accountId: 'a', amount: 50000, categoryId: 'dining', date: '2026-06-06', type: 'transfer' }), // 제외
  makeTxn({ accountId: 'a', amount: 400000, categoryId: 'dining', date: '2026-05-20' }),
];

describe('totalExpense — pending·transfer 제외', () => {
  it('6월 확정 지출만 합산', () => {
    expect(totalExpense(txns, JUNE)).toBe(360000);
  });
});

describe('categoryBreakdown — 대분류 롤업 + 소분류 드릴다운', () => {
  const slices = categoryBreakdown(txns, cats, JUNE);
  it('식비가 1위(300,000)로 롤업되고 비중이 계산된다', () => {
    expect(slices[0].categoryId).toBe('food');
    expect(slices[0].amount).toBe(300000);
    expect(slices[0].pct).toBeCloseTo(300000 / 360000);
  });
  it('소분류 드릴다운: 외식 200,000 + 식비직접 100,000', () => {
    const children = slices[0].children;
    expect(children.find((c) => c.categoryId === 'dining')?.amount).toBe(200000);
    expect(children.find((c) => c.categoryId === 'food')?.amount).toBe(100000);
  });
});

describe('monthlyTrend / monthOverMonth / dailyAverage', () => {
  it('월별 추이', () => {
    const t = monthlyTrend(txns, [MAY, JUNE]);
    expect(t.map((x) => x.total)).toEqual([400000, 360000]);
  });
  it('전월 대비 (감소)', () => {
    const m = monthOverMonth(txns, JUNE);
    expect(m.current).toBe(360000);
    expect(m.previous).toBe(400000);
    expect(m.delta).toBe(-40000);
    expect(m.pct).toBeCloseTo(-0.1);
  });
  it('일 평균: 현재달은 경과일 기준', () => {
    const d = dailyAverage(txns, JUNE, '2026-06-10');
    expect(d.days).toBe(10);
    expect(d.average).toBe(36000);
  });
  it('일 평균: 과거달은 그 달 전체 일수', () => {
    const d = dailyAverage(txns, MAY, '2026-06-10');
    expect(d.days).toBe(31);
  });
});
