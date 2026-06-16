import type { Transaction } from '../db/types';

export interface ImportDedupCandidate {
  date: string;
  amount: number;
  accountId?: string;
  merchant?: string;
}

export type ImportDuplicateReason = 'existing' | 'same_batch';

export interface ImportDuplicate {
  index: number;
  reason: ImportDuplicateReason;
  existingId?: string;
}

export function normalizeImportMerchant(value?: string): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()［\][\]{}<>·ㆍ.,:;'"`~!?|\\/\\_-]/g, '');
}

export function importDedupKey(txn: ImportDedupCandidate): string | undefined {
  if (!txn.date || !txn.accountId || txn.amount <= 0) return undefined;
  return [txn.date, txn.amount, txn.accountId, normalizeImportMerchant(txn.merchant)].join('|');
}

export function findImportDuplicates(
  existing: Pick<Transaction, 'id' | 'date' | 'amount' | 'accountId' | 'merchant'>[],
  candidates: ImportDedupCandidate[],
): Map<number, ImportDuplicate> {
  const existingKeys = new Map<string, string>();
  for (const txn of existing) {
    const key = importDedupKey(txn);
    if (key) existingKeys.set(key, txn.id);
  }

  const seenInBatch = new Set<string>();
  const duplicates = new Map<number, ImportDuplicate>();

  candidates.forEach((candidate, index) => {
    const key = importDedupKey(candidate);
    if (!key) return;

    const existingId = existingKeys.get(key);
    if (existingId) {
      duplicates.set(index, { index, reason: 'existing', existingId });
      return;
    }

    if (seenInBatch.has(key)) {
      duplicates.set(index, { index, reason: 'same_batch' });
      return;
    }

    seenInBatch.add(key);
  });

  return duplicates;
}
