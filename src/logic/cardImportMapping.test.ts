import { describe, expect, it } from 'vitest';
import {
  cardDigitsMatch,
  matchAccountByCardDigits,
  normalizeCardLastDigits,
  visibleCardDigits,
} from './cardImportMapping';
import { makeCard } from './testUtils';

describe('cardImportMapping', () => {
  it('카드번호 문자열에서 마지막 4자리만 보관한다', () => {
    expect(normalizeCardLastDigits('****-****-****-0789')).toBe('0789');
    expect(normalizeCardLastDigits('1234567812345678')).toBe('5678');
    expect(normalizeCardLastDigits(' 7*8* ')).toBe('78');
  });

  it('엑셀에 보이는 카드번호는 3자리 이상만 매핑 후보로 쓴다', () => {
    expect(visibleCardDigits('카드번호 ***789')).toBe('789');
    expect(visibleCardDigits('78')).toBe('');
  });

  it('저장된 4자리와 엑셀 3자리 노출값을 뒤자리 기준으로 매칭한다', () => {
    expect(cardDigitsMatch('0789', '789')).toBe(true);
    expect(cardDigitsMatch('1789', '789')).toBe(true);
    expect(cardDigitsMatch('0789', '790')).toBe(false);
  });

  it('일치하는 카드가 하나면 해당 계정으로 확정한다', () => {
    const match = matchAccountByCardDigits([
      makeCard({ id: 'shinhan', card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], cardLast4: '0789' } }),
      makeCard({ id: 'hana', card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], cardLast4: '1234' } }),
    ], '789');

    expect(match.status).toBe('matched');
    expect(match.account?.id).toBe('shinhan');
  });

  it('3자리 노출값이 여러 카드와 맞으면 모호함으로 둔다', () => {
    const match = matchAccountByCardDigits([
      makeCard({ id: 'a', card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], cardLast4: '0789' } }),
      makeCard({ id: 'b', card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [], cardLast4: '1789' } }),
    ], '789');

    expect(match.status).toBe('ambiguous');
    expect(match.candidateIds).toEqual(['a', 'b']);
  });

  it('카드번호가 없거나 등록 카드가 없으면 저장 화면에서 보정할 수 있게 상태를 남긴다', () => {
    expect(matchAccountByCardDigits([], '').status).toBe('missing_digits');
    expect(matchAccountByCardDigits([makeCard({ id: 'card' })], '789').status).toBe('no_match');
  });
});
