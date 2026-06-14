import { describe, it, expect } from 'vitest';
import {
  computeCardPerformance,
  txnCountsForCard,
  benefitMonthOf,
  computeAllCardPerformance,
} from './performance';
import { buildCategoryMap } from './category';
import { makeCard, makeTxn, standardCategories } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const cats = standardCategories();
const map = buildCategoryMap(cats);

describe('txnCountsForCard — 인정 판정', () => {
  const card = makeCard({ id: 'c1', card: { targetAmount: 300000, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], minPerTxn: 10000 } });

  it('일반 지출(해당카드·확정·카테고리 미제외·최소 충족)은 인정', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining' });
    expect(txnCountsForCard(t, card, map)).toBe(true);
  });

  it('pending 거래는 제외 (불변식 #2)', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining', status: 'pending' });
    expect(txnCountsForCard(t, card, map)).toBe(false);
  });

  it('minPerTxn 미만은 제외', () => {
    const t = makeTxn({ accountId: 'c1', amount: 9000, categoryId: 'dining' });
    expect(txnCountsForCard(t, card, map)).toBe(false);
  });

  it('대분류 defaultExcluded 상속 — 공과금 자식(관리비) 제외', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'maint' });
    expect(txnCountsForCard(t, card, map)).toBe(false);
  });

  it('수동 오버라이드 true가 자동 제외(공과금)를 이긴다 (불변식 #4)', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'maint', countsForPerformance: true });
    expect(txnCountsForCard(t, card, map)).toBe(true);
  });

  it('수동 오버라이드 false가 자동 인정을 이긴다', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining', countsForPerformance: false });
    expect(txnCountsForCard(t, card, map)).toBe(false);
  });

  it('수동 true라도 pending이면 제외 (pending은 절대 규칙)', () => {
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining', status: 'pending', countsForPerformance: true });
    expect(txnCountsForCard(t, card, map)).toBe(false);
  });

  it('다른 카드의 거래·이체·수입은 제외', () => {
    expect(txnCountsForCard(makeTxn({ accountId: 'other', amount: 50000 }), card, map)).toBe(false);
    expect(txnCountsForCard(makeTxn({ accountId: 'c1', amount: 50000, type: 'transfer' }), card, map)).toBe(false);
    expect(txnCountsForCard(makeTxn({ accountId: 'c1', amount: 50000, type: 'income' }), card, map)).toBe(false);
  });

  it('카드 excludedCategoryIds에 대분류 id → 자식 전부 제외 (불변식 #5)', () => {
    const card2 = makeCard({ id: 'c1', card: { targetAmount: 300000, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: ['food'] } });
    const t = makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining' });
    expect(txnCountsForCard(t, card2, map)).toBe(false);
  });
});

describe('benefitMonthOf — cycleType × selectedMonth 산정기간', () => {
  it('당월기준 → 같은 달 혜택', () => {
    const card = makeCard({ id: 'c', card: { targetAmount: 1, cycleType: 'curr_month', trackPerformance: true, excludedCategoryIds: [] } });
    expect(benefitMonthOf(card, JUNE)).toEqual({ year: 2026, month: 6 });
  });
  it('전월기준 → 다음 달 혜택 (연 경계 포함)', () => {
    const card = makeCard({ id: 'c', card: { targetAmount: 1, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [] } });
    expect(benefitMonthOf(card, JUNE)).toEqual({ year: 2026, month: 7 });
    expect(benefitMonthOf(card, { year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
  });
});

describe('computeCardPerformance — 집계 & 상태', () => {
  const card = makeCard({ id: 'c1', card: { targetAmount: 300000, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], minPerTxn: 10000 } });
  const txns = [
    makeTxn({ accountId: 'c1', amount: 100000, categoryId: 'dining', date: '2026-06-03' }),
    makeTxn({ accountId: 'c1', amount: 50000, categoryId: 'dining', date: '2026-06-05' }),
    makeTxn({ accountId: 'c1', amount: 40000, categoryId: 'maint', date: '2026-06-06' }), // 제외(공과금)
    makeTxn({ accountId: 'c1', amount: 80000, categoryId: 'dining', date: '2026-05-30' }), // 다른 달
    makeTxn({ accountId: 'c1', amount: 30000, categoryId: 'dining', date: '2026-06-08', status: 'pending' }), // pending
  ];

  it('selectedMonth·인정 거래만 합산', () => {
    const p = computeCardPerformance(card, txns, cats, JUNE, '2026-06-30');
    expect(p.achieved).toBe(150000);
    expect(p.target).toBe(300000);
    expect(p.shortfall).toBe(150000);
    expect(p.ratio).toBeCloseTo(0.5);
  });

  it('현재달 페이스 미달이면 behind, 충분하면 ontrack', () => {
    // 6/10 시점, 페이스 10/30≈0.33. ratio 0.5 ≥ 0.33 → ontrack
    expect(computeCardPerformance(card, txns, cats, JUNE, '2026-06-10').status).toBe('ontrack');
    // 6/25 시점, 페이스 25/30≈0.83. ratio 0.5 < 0.83 → behind
    expect(computeCardPerformance(card, txns, cats, JUNE, '2026-06-25').status).toBe('behind');
  });

  it('목표 달성 시 achieved, 과거달 미달은 short', () => {
    const big = [makeTxn({ accountId: 'c1', amount: 300000, categoryId: 'dining', date: '2026-06-02' })];
    expect(computeCardPerformance(card, big, cats, JUNE, '2026-06-10').status).toBe('achieved');
    expect(computeCardPerformance(card, txns, cats, JUNE, '2026-07-15').status).toBe('short');
  });
});

describe('computeAllCardPerformance — 추적 OFF 카드 제외', () => {
  it('trackPerformance=false 카드는 결과에서 빠진다', () => {
    const tracked = makeCard({ id: 'c1' });
    const untracked = makeCard({ id: 'c2', card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: false, excludedCategoryIds: [] } });
    const res = computeAllCardPerformance([tracked, untracked], [], cats, JUNE, '2026-06-10');
    expect(res.map((r) => r.cardId)).toEqual(['c1']);
  });
});
