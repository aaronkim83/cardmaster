import { describe, it, expect } from 'vitest';
import { transactionsToCsv } from './csv';
import { makeAccount, makeTxn, makeCategory } from './testUtils';

describe('transactionsToCsv', () => {
  const accounts = [makeAccount({ id: 'a', name: '주거래 통장' }), makeAccount({ id: 'b', name: '삼성카드' })];
  const categories = [makeCategory({ id: 'food', name: '식비' })];

  it('헤더 + 날짜 내림차순 행, 콤마/따옴표 이스케이프', () => {
    const txns = [
      makeTxn({ accountId: 'b', amount: 6300, date: '2026-06-10', categoryId: 'food', merchant: '카페, 강남"점"' }),
      makeTxn({ accountId: 'a', type: 'income', amount: 3200000, date: '2026-06-12', merchant: '급여' }),
    ];
    const csv = transactionsToCsv(txns, accounts, categories);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('날짜,시간,유형,금액,결제수단,입금계좌,카테고리,가맹점,메모,상태,출처');
    expect(lines[1].startsWith('2026-06-12')).toBe(true); // 최신 먼저
    expect(lines[2]).toContain('"카페, 강남""점"""'); // 콤마/따옴표 이스케이프
    expect(lines[2]).toContain('식비');
  });
});
