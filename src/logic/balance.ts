import type { Account, Transaction } from '../db/types';

// 잔액 · 순자산 — PRD §4.1~4.2, 불변식 #1/#2/#3.
// 단일 부호 규약: balance = openingBalance + 유입 − 유출 (confirmed만).
//   - 자산 계좌: income/이체수신 = 유입, expense/이체출금 = 유출 → 보통 양수.
//   - 카드(부채): 카드 지출 = 유출(음수화), 카드대금 이체수신 = 유입(0 방향). 잔액은 음수(부채).
// 이체는 한 계좌에서 빠지고 다른 계좌로 들어와 순자산 합계에 영향 없음(이중계상 방지).

export function accountBalance(account: Account, txns: Transaction[]): number {
  if (account.balanceMode === 'manual') {
    return account.manualBalance ?? account.openingBalance;
  }
  let bal = account.openingBalance;
  for (const t of txns) {
    if (t.status !== 'confirmed') continue; // 불변식 #2
    if (t.type === 'income' && t.accountId === account.id) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === account.id) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) bal -= t.amount; // 출금
      if (t.toAccountId === account.id) bal += t.amount; // 입금
    }
  }
  return bal;
}

export interface NetWorth {
  assets: number;
  liabilities: number; // 양수로 표기 (부채 총액)
  net: number;
}

export function netWorth(accounts: Account[], txns: Transaction[]): NetWorth {
  let assets = 0;
  let liabilities = 0;
  for (const acc of accounts) {
    if (!acc.isActive) continue;
    const bal = accountBalance(acc, txns);
    if (acc.kind === 'asset') assets += bal;
    else liabilities += -bal; // 부채 잔액은 음수 → 양수 총액으로
  }
  return { assets, liabilities, net: assets - liabilities };
}
