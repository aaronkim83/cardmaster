import { describe, expect, it } from 'vitest';
import { findImportDuplicates, importDedupKey, normalizeImportMerchant } from './importDedup';
import { makeTxn } from './testUtils';

describe('normalizeImportMerchant', () => {
  it('공백과 흔한 구분자를 제거해 같은 가맹점으로 본다', () => {
    expect(normalizeImportMerchant('(주) 쿠팡 이츠')).toBe(normalizeImportMerchant('주 쿠팡이츠'));
  });
});

describe('importDedupKey', () => {
  it('날짜·금액·계좌·정규화 가맹점을 중복 키로 사용한다', () => {
    expect(importDedupKey({ date: '2026-06-10', amount: 12900, accountId: 'card-1', merchant: '쿠팡 이츠' }))
      .toBe('2026-06-10|12900|card-1|쿠팡이츠');
  });

  it('계좌가 아직 매핑되지 않은 후보는 중복 판단에서 제외한다', () => {
    expect(importDedupKey({ date: '2026-06-10', amount: 12900, merchant: '쿠팡' })).toBeUndefined();
  });
});

describe('findImportDuplicates', () => {
  it('이미 저장된 동일 거래를 existing 중복으로 표시한다', () => {
    const existing = [makeTxn({ id: 't-existing', date: '2026-06-10', amount: 12900, accountId: 'card-1', merchant: '쿠팡이츠' })];
    const dupes = findImportDuplicates(existing, [
      { date: '2026-06-10', amount: 12900, accountId: 'card-1', merchant: '쿠팡 이츠' },
    ]);

    expect(dupes.get(0)).toEqual({ index: 0, reason: 'existing', existingId: 't-existing' });
  });

  it('가져오기 파일 안에서 반복된 동일 거래는 두 번째 행부터 same_batch 중복으로 표시한다', () => {
    const dupes = findImportDuplicates([], [
      { date: '2026-06-10', amount: 5999, accountId: 'card-1', merchant: '쿠팡' },
      { date: '2026-06-10', amount: 5999, accountId: 'card-1', merchant: '쿠팡' },
    ]);

    expect(dupes.has(0)).toBe(false);
    expect(dupes.get(1)).toEqual({ index: 1, reason: 'same_batch' });
  });

  it('같은 날짜·금액·가맹점이어도 결제수단이 다르면 다른 거래로 본다', () => {
    const existing = [makeTxn({ id: 't-existing', date: '2026-06-10', amount: 5999, accountId: 'card-1', merchant: '쿠팡' })];
    const dupes = findImportDuplicates(existing, [
      { date: '2026-06-10', amount: 5999, accountId: 'card-2', merchant: '쿠팡' },
    ]);

    expect(dupes.size).toBe(0);
  });
});
