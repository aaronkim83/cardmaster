import type { Account, Category, Transaction } from '../db/types';

// 거래 CSV 내보내기 (PRD §7). 엑셀 한글 호환 위해 호출부에서 BOM 추가.

const TYPE_LABEL: Record<Transaction['type'], string> = {
  expense: '지출',
  income: '수입',
  transfer: '이체',
};
const STATUS_LABEL: Record<Transaction['status'], string> = {
  confirmed: '확정',
  pending: '대기',
};

const HEADERS = ['날짜', '시간', '유형', '금액', '결제수단', '입금계좌', '카테고리', '가맹점', '메모', '상태', '출처'];

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function transactionsToCsv(
  txns: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const rows = [...txns]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((t) => [
      t.date,
      t.time ?? '',
      TYPE_LABEL[t.type],
      String(t.amount),
      accName.get(t.accountId) ?? '',
      t.toAccountId ? accName.get(t.toAccountId) ?? '' : '',
      t.categoryId ? catName.get(t.categoryId) ?? '' : '',
      t.merchant ?? '',
      t.memo ?? '',
      STATUS_LABEL[t.status],
      t.source,
    ]);

  return [HEADERS, ...rows].map((cols) => cols.map((c) => escapeCsv(String(c))).join(',')).join('\r\n');
}
