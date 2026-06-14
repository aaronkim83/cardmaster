import { describe, it, expect } from 'vitest';
import { dueDate, generateDueTransactions, isDueReached, materializeRule } from './recurring';
import { makeRule, makeTxn } from './testUtils';
import type { YearMonth } from './period';

const JUNE: YearMonth = { year: 2026, month: 6 };
const FEB: YearMonth = { year: 2026, month: 2 };

describe('dueDate — 말일 클램프', () => {
  it('31일 규칙은 2월에 28(말)일로', () => {
    expect(dueDate(makeRule({ id: 'r', accountId: 'a', amount: 1, dayOfMonth: 31 }), FEB)).toBe('2026-02-28');
  });
});

describe('materializeRule — 고정=confirmed, 변동=pending (불변식 #2)', () => {
  it('고정 자동확정 규칙 → confirmed', () => {
    const t = materializeRule(makeRule({ id: 'r', accountId: 'a', amount: 17000, dayOfMonth: 25, categoryId: 'dining' }), JUNE);
    expect(t.status).toBe('confirmed');
    expect(t.source).toBe('recurring');
    expect(t.date).toBe('2026-06-25');
    expect(t.recurringId).toBe('r');
  });
  it('변동 규칙 → pending', () => {
    const t = materializeRule(makeRule({ id: 'g', accountId: 'a', amount: 42000, dayOfMonth: 28, isVariable: true }), JUNE);
    expect(t.status).toBe('pending');
  });
});

describe('isDueReached & generateDueTransactions', () => {
  const rule = makeRule({ id: 'r', accountId: 'a', amount: 55000, dayOfMonth: 17, categoryId: 'dining' });

  it('현재달: 도래일 지나야 실체화', () => {
    expect(isDueReached(rule, JUNE, '2026-06-10')).toBe(false);
    expect(isDueReached(rule, JUNE, '2026-06-20')).toBe(true);
  });
  it('과거달은 모두 도래, 미래달은 미도래', () => {
    expect(isDueReached(rule, { year: 2026, month: 5 }, '2026-06-10')).toBe(true);
    expect(isDueReached(rule, { year: 2026, month: 7 }, '2026-06-10')).toBe(false);
  });
  it('이미 실현된 규칙은 다시 생성하지 않는다', () => {
    const existing = [makeTxn({ accountId: 'a', amount: 55000, date: '2026-06-17', recurringId: 'r', source: 'recurring' })];
    expect(generateDueTransactions([rule], existing, JUNE, '2026-06-20')).toHaveLength(0);
    expect(generateDueTransactions([rule], [], JUNE, '2026-06-20')).toHaveLength(1);
  });
  it('startDate 이전 달은 생성하지 않는다', () => {
    const future = makeRule({ id: 'f', accountId: 'a', amount: 1, dayOfMonth: 1, startDate: '2026-07-01' });
    expect(generateDueTransactions([future], [], JUNE, '2026-06-20')).toHaveLength(0);
  });
});
