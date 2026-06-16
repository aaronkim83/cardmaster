import { describe, it, expect } from 'vitest';
import { accountValueAsOf, netWorthAsOf, netWorthTrend } from './networth';
import { makeAccount, makeCard, makeTxn } from './testUtils';
import type { BalanceSnapshot } from '../db/types';
import type { YearMonth } from './period';

const MAY: YearMonth = { year: 2026, month: 5 };
const JUNE: YearMonth = { year: 2026, month: 6 };

describe('accountValueAsOf', () => {
  it('계산형: 월말까지의 confirmed 유입−유출만 반영', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 1000000 });
    const txns = [
      makeTxn({ accountId: 'bank', type: 'income', amount: 3000000, date: '2026-05-10' }),
      makeTxn({ accountId: 'bank', type: 'expense', amount: 500000, date: '2026-06-03' }), // 6월
      makeTxn({ accountId: 'bank', type: 'income', amount: 999, date: '2026-06-05', status: 'pending' }),
    ];
    expect(accountValueAsOf(bank, txns, MAY)).toBe(4000000); // 5월말: opening+3,000,000
    expect(accountValueAsOf(bank, txns, JUNE)).toBe(3500000); // 6월말: −500,000
  });

  it('수동형: 해당 월 이전 최신 스냅샷 사용, 없으면 manualBalance', () => {
    const inv = makeAccount({ id: 'inv', balanceMode: 'manual', manualBalance: 24000000, openingBalance: 0 });
    const snaps: BalanceSnapshot[] = [
      { id: 's1', accountId: 'inv', period: '2026-05', balance: 20000000, createdAt: 0 },
    ];
    expect(accountValueAsOf(inv, [], MAY, snaps)).toBe(20000000); // 5월 스냅샷
    expect(accountValueAsOf(inv, [], JUNE, snaps)).toBe(20000000); // 6월: 직전(5월) 스냅샷 유지
    expect(accountValueAsOf(inv, [], { year: 2026, month: 4 }, snaps)).toBe(24000000); // 스냅샷 이전 → manualBalance
  });
});

describe('netWorthAsOf — 이체 상쇄 & 부호', () => {
  it('자산 간 이체는 순자산 불변', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 1000000 });
    const sav = makeAccount({ id: 'sav', openingBalance: 0 });
    const txns = [makeTxn({ accountId: 'bank', toAccountId: 'sav', type: 'transfer', amount: 400000, date: '2026-06-02' })];
    expect(netWorthAsOf([bank, sav], txns, JUNE).net).toBe(1000000);
  });

  it('순자산 = 자산 − 부채(카드 지출은 음수→부채)', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 5000000 });
    const card = makeCard({ id: 'card', kind: 'liability', openingBalance: 0 });
    const txns = [makeTxn({ accountId: 'card', type: 'expense', amount: 200000, date: '2026-06-01' })];
    const nw = netWorthAsOf([bank, card], txns, JUNE);
    expect(nw.assets).toBe(5000000);
    expect(nw.liabilities).toBe(200000);
    expect(nw.net).toBe(4800000);
  });
});

describe('netWorthTrend', () => {
  it('월 목록 순서대로 순자산 포인트를 만든다', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 1000000 });
    const txns = [makeTxn({ accountId: 'bank', type: 'income', amount: 500000, date: '2026-06-10' })];
    const trend = netWorthTrend([bank], txns, [MAY, JUNE]);
    expect(trend.map((p) => p.net)).toEqual([1000000, 1500000]);
  });
});
