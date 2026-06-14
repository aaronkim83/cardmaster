// 카드 결제 문자/푸시 텍스트 파서 — card-sms-parser.js 이식 (검증 완료 로직).
// 함정: 누적/잔여/한도 금액 채택 금지, MM/DD 연도 보정.

export interface ParsedTxn {
  issuer: string;
  cardLast4: string | null;
  amount: number;
  installment: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  merchant: string;
  kind: '승인' | '매출접수';
}

export interface UnmatchedTxn {
  issuer: null;
  matched: false;
  raw: string;
}

export type ParseResult = (ParsedTxn & { raw: string }) | UnmatchedTxn;

function parseAmount(s: string): number {
  return parseInt(String(s).replace(/[,\s]/g, ''), 10);
}

function toISO(mm: string | number, dd: string | number): string {
  const now = new Date();
  let y = now.getFullYear();
  const m = String(mm).padStart(2, '0');
  const d = String(dd).padStart(2, '0');
  // 미래 날짜면 전년으로 보정
  const cand = new Date(`${y}-${m}-${d}T00:00:00`);
  if (cand.getTime() - now.getTime() > 1000 * 60 * 60 * 24) y -= 1;
  return `${y}-${m}-${d}`;
}

// 가맹점 정제: 후행 "누적…원", 공백 정리
function cleanMerchant(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/누적[\d,]+원.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Template {
  issuer: string;
  test: RegExp;
  parse(t: string): Omit<ParsedTxn, 'issuer'>;
}

const templates: Template[] = [
  {
    issuer: '우리카드',
    test: /우리\(?\d{3,4}\)?\s*승인/,
    parse(t) {
      const card = (t.match(/우리\((\d{3,4})\)/) || [])[1] || null;
      const amt = (t.match(/([\d,]+)\s*원/) || [])[1];
      const inst = (t.match(/원\s*(일시불|\d+개월)/) || [])[1] || '일시불';
      const dt = t.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
      const lines = t
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merchant = cleanMerchant(lines[lines.length - 1]);
      return {
        cardLast4: card,
        amount: parseAmount(amt),
        installment: inst,
        date: dt ? toISO(dt[1], dt[2]) : null,
        time: dt ? `${dt[3].padStart(2, '0')}:${dt[4]}` : null,
        merchant,
        kind: '승인',
      };
    },
  },
  {
    issuer: '하나카드',
    test: /하나[\d*]+\s*승인/,
    parse(t) {
      const card = (t.match(/하나([\d*]+)\s*승인/) || [])[1] || null;
      // 첫 번째 "원" = 결제금액 (누적금액 오인 방지)
      const amt = (t.match(/승인\s+\S+\s+([\d,]+)\s*원/) || t.match(/([\d,]+)\s*원/) || [])[1];
      const inst = (t.match(/원\s*(일시불|\d+개월)/) || [])[1] || '일시불';
      const dt = t.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
      // 가맹점: 시각 뒤 ~ "누적" 앞
      const mm = t.match(/\d{1,2}:\d{2}\s+(.+?)(?:누적[\d,]+원)?\s*$/);
      const merchant = cleanMerchant(mm ? mm[1] : '');
      return {
        cardLast4: card,
        amount: parseAmount(amt),
        installment: inst,
        date: dt ? toISO(dt[1], dt[2]) : null,
        time: dt ? `${dt[3].padStart(2, '0')}:${dt[4]}` : null,
        merchant,
        kind: '승인',
      };
    },
  },
  {
    issuer: 'KB국민BC',
    test: /KB국민(BC)?\(?\d{3,4}\)?\s*(매출접수|승인)/,
    parse(t) {
      const card = (t.match(/KB국민(?:BC)?\((\d{3,4})\)/) || [])[1] || null;
      const amt = (t.match(/([\d,]+)\s*원/) || [])[1];
      const dt = t.match(/(\d{1,2})월\s*(\d{1,2})일/);
      const kind: '승인' | '매출접수' = /매출접수/.test(t) ? '매출접수' : '승인';
      // 가맹점: 마지막 비어있지 않은 줄
      const lines = t
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merchant = cleanMerchant(lines[lines.length - 1]);
      return {
        cardLast4: card,
        amount: parseAmount(amt),
        installment: '일시불',
        date: dt ? toISO(dt[1], dt[2]) : null,
        time: null,
        merchant,
        kind,
      };
    },
  },
];

// 여러 건이 붙어 있을 수 있으니 [Web발신] 또는 빈 줄 기준 분리
function splitMessages(raw: string): string[] {
  const byTag = raw
    .split(/(?=\[Web발신\])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byTag.length > 1) return byTag;
  // 태그가 없으면 빈 줄(2줄 이상)로 분리
  return raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseOne(block: string): ParseResult {
  const text = block.replace(/\[Web발신\]/g, '').trim();
  for (const tpl of templates) {
    if (tpl.test.test(text)) {
      const out = tpl.parse(text);
      return { issuer: tpl.issuer, ...out, raw: block.trim() };
    }
  }
  return { issuer: null, matched: false, raw: block.trim() };
}

export function parseCardSms(raw: string): ParseResult[] {
  return splitMessages(raw).map(parseOne);
}

export function isMatched(r: ParseResult): r is ParsedTxn & { raw: string } {
  return (r as UnmatchedTxn).matched !== false && (r as ParsedTxn).issuer !== null;
}
