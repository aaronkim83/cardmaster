import { describe, it, expect } from 'vitest';
import { accountBalance, netWorth } from './balance';
import { makeAccount, makeCard, makeTxn } from './testUtils';

describe('accountBalance', () => {
  const bank = makeAccount({ id: 'bank', openingBalance: 1000000 });

  it('calculated = opening + 수입 − 지출 (confirmed만)', () => {
    const txns = [
      makeTxn({ accountId: 'bank', type: 'income', amount: 3200000 }),
      makeTxn({ accountId: 'bank', type: 'expense', amount: 200000 }),
      makeTxn({ accountId: 'bank', type: 'expense', amount: 99999, status: 'pending' }), // 제외
    ];
    expect(accountBalance(bank, txns)).toBe(1000000 + 3200000 - 200000);
  });

  it('이체는 출금 계좌에서 빠지고 입금 계좌로 들어온다', () => {
    const txns = [makeTxn({ accountId: 'bank', toAccountId: 'sav', type: 'transfer', amount: 500000 })];
    const sav = makeAccount({ id: 'sav', openingBalance: 0 });
    expect(accountBalance(bank, txns)).toBe(500000);
    expect(accountBalance(sav, txns)).toBe(500000);
  });

  it('manual 모드는 manualBalance 반환', () => {
    const acc = makeAccount({ id: 'inv', balanceMode: 'manual', manualBalance: 24000000, openingBalance: 0 });
    expect(accountBalance(acc, [makeTxn({ accountId: 'inv', amount: 999 })])).toBe(24000000);
  });

  it('카드(부채): 지출은 음수, 카드대금 이체수신은 0 방향', () => {
    const card = makeCard({ id: 'card', kind: 'liability', openingBalance: 0 });
    const txns = [
      makeTxn({ accountId: 'card', type: 'expense', amount: 220000 }),
      makeTxn({ accountId: 'bank', toAccountId: 'card', type: 'transfer', amount: 100000 }), // 카드대금
    ];
    expect(accountBalance(card, txns)).toBe(-120000);
  });
});

describe('netWorth — 이체 이중계상 방지 (불변식 #3)', () => {
  it('자산 간 이체는 순자산을 바꾸지 않는다', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 1000000 });
    const sav = makeAccount({ id: 'sav', openingBalance: 0 });
    const before = netWorth([bank, sav], []);
    const after = netWorth([bank, sav], [
      makeTxn({ accountId: 'bank', toAccountId: 'sav', type: 'transfer', amount: 400000 }),
    ]);
    expect(before.net).toBe(1000000);
    expect(after.net).toBe(1000000);
  });

  it('순자산 = 자산 − 부채', () => {
    const bank = makeAccount({ id: 'bank', openingBalance: 5200000 });
    const card = makeCard({ id: 'card', kind: 'liability', openingBalance: 0 });
    const nw = netWorth([bank, card], [makeTxn({ accountId: 'card', type: 'expense', amount: 220000 })]);
    expect(nw.assets).toBe(5200000);
    expect(nw.liabilities).toBe(220000);
    expect(nw.net).toBe(4980000);
  });
});
