import type { Account } from '../db/types';

export type CardMatchStatus = 'matched' | 'ambiguous' | 'missing_digits' | 'no_match';

export interface CardAccountMatch {
  status: CardMatchStatus;
  cardDigits: string;
  account?: Account;
  candidateIds: string[];
}

export function normalizeCardLastDigits(value: unknown, maxDigits = 4): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length > maxDigits ? digits.slice(-maxDigits) : digits;
}

export function visibleCardDigits(value: unknown): string {
  const digits = normalizeCardLastDigits(value);
  return digits.length >= 3 ? digits : '';
}

export function cardDigitsMatch(storedLast4: unknown, visibleDigits: unknown): boolean {
  const stored = normalizeCardLastDigits(storedLast4);
  const visible = visibleCardDigits(visibleDigits);
  if (!stored || !visible) return false;
  if (stored === visible) return true;
  return visible.length === 3 && stored.length === 4 && stored.endsWith(visible);
}

export function matchAccountByCardDigits(accounts: Account[], visibleDigitsValue: unknown): CardAccountMatch {
  const cardDigits = visibleCardDigits(visibleDigitsValue);
  if (!cardDigits) return { status: 'missing_digits', cardDigits: '', candidateIds: [] };

  const matches = accounts.filter((account) => (
    account.type === 'card'
    && account.isActive
    && cardDigitsMatch(account.card?.cardLast4, cardDigits)
  ));

  if (matches.length === 1) {
    return { status: 'matched', cardDigits, account: matches[0], candidateIds: [matches[0].id] };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', cardDigits, candidateIds: matches.map((account) => account.id) };
  }
  return { status: 'no_match', cardDigits, candidateIds: [] };
}
