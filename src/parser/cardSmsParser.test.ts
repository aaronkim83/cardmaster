import { describe, it, expect } from 'vitest';
import { parseCardSms, parseOne, isMatched } from './cardSmsParser';

// 회귀 보호 — card-sms-parser.js 내 실제 샘플 3종 (우리·하나·KB국민BC).

const WOORI = `[Web발신]
우리(5578)승인
김*수님
55,000원 일시불
06/13 15:40
(주) 비바리퍼블리카`;

const HANA =
  `[Web발신]\n하나7*8*승인 김*수 80,300원 일시불 06/13 09:32 드림분당예치과병누적2,347,103원`;

const KB = `[Web발신]
KB국민BC(4048)매출접수
김*수님
59,500원
05월20일기준
KT-303192`;

describe('parseCardSms — 우리카드 (멀티라인)', () => {
  const [r] = parseCardSms(WOORI);
  it('인식되고 발급사·카드번호·금액이 맞다', () => {
    expect(isMatched(r)).toBe(true);
    if (!isMatched(r)) return;
    expect(r.issuer).toBe('우리카드');
    expect(r.cardLast4).toBe('5578');
    expect(r.amount).toBe(55000);
    expect(r.installment).toBe('일시불');
    expect(r.kind).toBe('승인');
  });
  it('시각과 가맹점을 파싱한다', () => {
    if (!isMatched(r)) return;
    expect(r.time).toBe('15:40');
    expect(r.date?.endsWith('-06-13')).toBe(true);
    expect(r.merchant).toBe('(주) 비바리퍼블리카');
  });
});

describe('parseCardSms — 하나카드 (싱글라인, 누적금액 오인 방지)', () => {
  const [r] = parseCardSms(HANA);
  it('첫 번째 "원"=결제금액을 채택한다 (누적 2,347,103원 아님)', () => {
    expect(isMatched(r)).toBe(true);
    if (!isMatched(r)) return;
    expect(r.issuer).toBe('하나카드');
    expect(r.amount).toBe(80300);
    expect(r.cardLast4).toBe('7*8*');
  });
  it('가맹점에서 누적 꼬리를 제거한다', () => {
    if (!isMatched(r)) return;
    expect(r.merchant).toBe('드림분당예치과병');
    expect(r.merchant).not.toContain('누적');
    expect(r.time).toBe('09:32');
  });
});

describe('parseCardSms — KB국민BC (매출접수, MM월DD일)', () => {
  const [r] = parseCardSms(KB);
  it('매출접수 종류와 금액을 파싱한다', () => {
    expect(isMatched(r)).toBe(true);
    if (!isMatched(r)) return;
    expect(r.issuer).toBe('KB국민BC');
    expect(r.cardLast4).toBe('4048');
    expect(r.amount).toBe(59500);
    expect(r.kind).toBe('매출접수');
    expect(r.merchant).toBe('KT-303192');
    expect(r.date?.endsWith('-05-20')).toBe(true);
  });
});

describe('parseCardSms — 다건 분리 & 미인식', () => {
  it('[Web발신] 기준으로 3건을 분리한다', () => {
    const all = parseCardSms(`${WOORI}\n\n${HANA}\n\n${KB}`);
    expect(all).toHaveLength(3);
    expect(all.every(isMatched)).toBe(true);
  });
  it('알 수 없는 형식은 matched:false로 표시한다', () => {
    const r = parseOne('[Web발신] 알 수 없는 메시지 형식입니다');
    expect(isMatched(r)).toBe(false);
    expect((r as { issuer: null }).issuer).toBeNull();
  });
});
