import type { Account, BalanceSnapshot, Transaction } from '../db/types';
import { endOfMonth, monthKey, type YearMonth } from './period';

// 순자산 추이 (as-of 월말) — PRD §4.2, 불변식 #1 예외(시세변동 자산 스냅샷만 저장 허용).
// 계산형 계좌: openingBalance + 월말까지의 confirmed 유입−유출.
// 수동형 계좌: 해당 월(또는 그 이전 최신) 스냅샷 → 없으면 manualBalance → openingBalance.
// 이체는 from/to가 상쇄되어 순자산 합계에 영향 없음(이중계상 방지).

/** 특정 월말 기준 계좌 가치(부호 포함: 자산 +, 부채 잔액 −). */
export function accountValueAsOf(
  account: Account,
  txns: Transaction[],
  ym: YearMonth,
  snapshots: BalanceSnapshot[] = [],
): number {
  if (account.balanceMode === 'manual') {
    const period = monthKey(ym);
    const snap = snapshots
      .filter((s) => s.accountId === account.id && s.period <= period)
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    if (snap) return snap.balance;
    return account.manualBalance ?? account.openingBalance;
  }

  const cutoff = endOfMonth(ym);
  let bal = account.openingBalance;
  for (const t of txns) {
    if (t.status !== 'confirmed') continue; // 불변식 #2
    if (t.date > cutoff) continue; // 월말 이후 제외
    if (t.type === 'income' && t.accountId === account.id) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === account.id) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

export interface NetWorthPoint {
  month: YearMonth;
  assets: number;
  liabilities: number; // 양수 표기(부채 총액)
  net: number;
}

export function netWorthAsOf(
  accounts: Account[],
  txns: Transaction[],
  ym: YearMonth,
  snapshots: BalanceSnapshot[] = [],
): NetWorthPoint {
  let assets = 0;
  let liabilities = 0;
  for (const acc of accounts) {
    if (!acc.isActive) continue;
    const value = accountValueAsOf(acc, txns, ym, snapshots);
    if (acc.kind === 'asset') assets += value;
    else liabilities += -value; // 부채 잔액(음수) → 양수 총액
  }
  return { month: ym, assets, liabilities, net: assets - liabilities };
}

/** 주어진 월 목록의 순자산 추이. */
export function netWorthTrend(
  accounts: Account[],
  txns: Transaction[],
  months: YearMonth[],
  snapshots: BalanceSnapshot[] = [],
): NetWorthPoint[] {
  return months.map((m) => netWorthAsOf(accounts, txns, m, snapshots));
}
