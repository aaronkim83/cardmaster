import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/useAppStore';
import { parseCardSms, isMatched, type ParseResult } from '../parser/cardSmsParser';
import { AppHead } from '../ui/components';
import { won } from '../ui/format';
import { matchAccountByCardDigits, visibleCardDigits, type CardMatchStatus } from '../logic/cardImportMapping';

const SAMPLE = `[Web발신]
우리(5578)승인
김*수님
55,000원 일시불
06/13 15:40
(주) 비바리퍼블리카

[Web발신]
하나7*8*승인 김*수 80,300원 일시불 06/13 09:32 드림분당예치과병누적2,347,103원

[Web발신]
KB국민BC(4048)매출접수
김*수님
59,500원
05월20일기준
KT-303192`;

interface ExcelRow {
  date: string;
  merchant: string;
  amount: number;
  cardDigits?: string;
  accountId?: string;
  accountName?: string;
  matchStatus: CardMatchStatus | 'no_card_column';
}

export function ImportScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const navigate = useAppStore((s) => s.navigate);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'paste' | 'excel'>('paste');
  const [text, setText] = useState(SAMPLE);
  const [results, setResults] = useState<ParseResult[] | null>(null);
  const [excel, setExcel] = useState<{ rows: ExcelRow[]; fileName: string; cardColumnName?: string } | null>(null);
  const [excelFallbackAccount, setExcelFallbackAccount] = useState('');

  const cardAccounts = accounts.filter((a) => a.type === 'card' && a.isActive);
  const fallbackAccounts = cardAccounts.length > 0 ? cardAccounts : accounts.filter((a) => a.isActive);

  const matchAccount = (issuer: string, cardLast4?: string | null): string | undefined => {
    const cardMatch = matchAccountByCardDigits(accounts, cardLast4);
    if (cardMatch.status === 'matched') return cardMatch.account?.id;
    const key = issuer.replace('카드', '').replace('국민BC', '국민');
    return (accounts.find((a) => a.type === 'card' && a.name.includes(key.slice(0, 2))) ?? accounts.find((a) => a.type === 'card'))?.id;
  };

  async function saveParsed() {
    if (!results) return;
    for (const r of results) {
      if (!isMatched(r)) continue;
      const accId = matchAccount(r.issuer, r.cardLast4);
      if (!accId) continue;
      await addTransaction({ date: r.date ?? today(), time: r.time ?? undefined, type: 'expense', amount: r.amount, accountId: accId, merchant: r.merchant, countsForPerformance: null, source: 'parsed', status: 'confirmed' });
    }
    navigate('ledger');
  }

  async function onExcel(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (raw.length === 0) { alert('빈 시트입니다.'); return; }
    const headers = Object.keys(raw[0]);
    const find = (kw: string[]) => headers.find((h) => kw.some((k) => h.includes(k)));
    const dateCol = find(['일자', '날짜', '거래일', '이용일', '승인일']);
    const amtCol = find(['금액', '이용금액', '승인금액', '출금', '결제']);
    const merCol = find(['가맹', '내용', '적요', '상호', '거래처']);
    const cardCol = findCardColumn(headers, [dateCol, amtCol, merCol].filter(Boolean) as string[]);
    if (!dateCol || !amtCol) { alert('날짜/금액 열을 찾지 못했어요.'); return; }
    const rows: ExcelRow[] = raw
      .map((r) => {
        const cardMatch = cardCol ? matchAccountByCardDigits(accounts, r[cardCol]) : null;
        const matchStatus: ExcelRow['matchStatus'] = cardMatch?.status ?? 'no_card_column';
        return {
          date: toISO(r[dateCol]),
          merchant: String(merCol ? r[merCol] : '').trim(),
          amount: Math.abs(Number(String(r[amtCol]).replace(/[^\d.-]/g, ''))),
          cardDigits: cardCol ? visibleCardDigits(r[cardCol]) || undefined : undefined,
          accountId: cardMatch?.account?.id,
          accountName: cardMatch?.account?.name,
          matchStatus,
        };
      })
      .filter((r) => r.amount > 0 && r.date);
    setExcel({ rows, fileName: file.name, cardColumnName: cardCol });
    setExcelFallbackAccount(fallbackAccounts[0]?.id ?? '');
  }

  async function saveExcel() {
    if (!excel) return;
    for (const r of excel.rows) {
      const accountId = r.accountId ?? excelFallbackAccount;
      if (!accountId) continue;
      await addTransaction({ date: r.date, type: 'expense', amount: r.amount, accountId, merchant: r.merchant || undefined, countsForPerformance: null, source: 'import', status: 'confirmed' });
    }
    navigate('ledger');
  }

  const recognized = results?.filter(isMatched).length ?? 0;
  const excelMatched = excel?.rows.filter((r) => r.accountId).length ?? 0;
  const excelUnmatched = excel ? excel.rows.length - excelMatched : 0;
  const excelSaveable = excel?.rows.filter((r) => r.accountId || excelFallbackAccount).length ?? 0;

  return (
    <>
      <AppHead title="가져오기" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 flex gap-1.5">
          <Tab on={mode === 'paste'} onClick={() => setMode('paste')}>📋 붙여넣기</Tab>
          <Tab on={mode === 'excel'} onClick={() => setMode('excel')}>📄 엑셀 파일</Tab>
        </div>

        {mode === 'paste' ? (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-[130px] w-full resize-y rounded-[13px] border-[1.5px] border-line bg-surface p-[13px] text-[12.5px] leading-relaxed outline-none focus:border-ink" />
            <button onClick={() => setResults(parseCardSms(text))} className="mt-2.5 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">인식하기</button>
            {results && (
              <>
                <Recognized n={recognized} extra={results.length - recognized} />
                <div className="mt-3.5 overflow-hidden rounded-[13px] shadow-card">
                  <PreviewHead />
                  {results.map((r, i) => isMatched(r) ? (
                    <PreviewRow key={i} date={r.date?.slice(5) ?? '--'} mer={`${r.merchant} · ${r.issuer}`} amount={r.amount} icon={r.kind === '매출접수' ? '📩' : '✓'} />
                  ) : (
                    <div key={i} className="flex items-center border-t border-line2 px-[13px] py-2.5 text-[12px] font-semibold text-warn"><span className="w-[46px]">⚠</span><span className="flex-1">미인식 — 직접 입력</span></div>
                  ))}
                </div>
                {recognized > 0 && <SaveBtn onClick={saveParsed}>{recognized}건 저장</SaveBtn>}
              </>
            )}
          </>
        ) : (
          <>
            <div onClick={() => fileRef.current?.click()} className="mb-3.5 rounded-[14px] border-[1.5px] border-dashed border-line bg-surface px-[18px] py-[26px] text-center">
              <div className="text-3xl">📄</div>
              <div className="mt-2 text-[13px] font-semibold leading-relaxed text-sub"><b className="text-ink">카드사·은행 이용내역 .xlsx</b>를<br />여기를 탭해 선택하세요</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onExcel(f); e.target.value = ''; }} />
            {excel && (
              <>
                <div className="mb-3.5 flex items-center gap-1.5 rounded-xl bg-good-bg px-[13px] py-[11px] text-[12.5px] font-semibold text-[#13633a]">✅ {excel.fileName} · <b className="font-extrabold">{excel.rows.length}건</b> 인식</div>
                <div className="mb-3.5 rounded-xl bg-surface px-[13px] py-[11px] text-[12px] font-semibold leading-relaxed text-sub shadow-card">
                  {excel.cardColumnName ? (
                    <>카드번호 열 <b className="text-ink">{excel.cardColumnName}</b> · 자동 매칭 <b className="text-good">{excelMatched}건</b>{excelUnmatched > 0 && <> · 확인 필요 <b className="text-warn">{excelUnmatched}건</b></>}</>
                  ) : (
                    <>카드번호 열을 찾지 못했어요. 아래 결제수단으로 저장합니다.</>
                  )}
                </div>
                {excelUnmatched > 0 && (
                  <>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">미매칭 행 저장할 결제수단</div>
                    <select value={excelFallbackAccount} onChange={(e) => setExcelFallbackAccount(e.target.value)} className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none">
                      {fallbackAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </>
                )}
                <div className="overflow-hidden rounded-[13px] shadow-card">
                  <PreviewHead />
                  {excel.rows.slice(0, 8).map((r, i) => <PreviewRow key={i} date={r.date.slice(5)} mer={excelRowTitle(r)} amount={r.amount} icon={r.accountId ? '✓' : '⚠'} />)}
                  {excel.rows.length > 8 && <div className="border-t border-line2 px-[13px] py-2.5 text-center text-[11px] font-semibold text-faint">＋ {excel.rows.length - 8}건 더</div>}
                </div>
                <SaveBtn onClick={saveExcel} disabled={excelSaveable === 0}>{excelSaveable}건 모두 저장</SaveBtn>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
function toISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim().replace(/[.]/g, '-').replace(/\//g, '-');
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

function findCardColumn(headers: string[], usedHeaders: string[]): string | undefined {
  const used = new Set(usedHeaders);
  const normalized = (value: string) => value.replace(/\s/g, '').toLowerCase();
  const groups = [
    ['카드번호', '카드no', 'cardno', 'cardnumber'],
    ['이용카드', '사용카드', '카드명'],
    ['카드'],
  ];
  for (const group of groups) {
    const found = headers.find((header) => !used.has(header) && group.some((key) => normalized(header).includes(normalized(key))));
    if (found) return found;
  }
  return undefined;
}

function excelRowTitle(row: ExcelRow): string {
  const merchant = row.merchant || '—';
  if (row.accountName) return `${merchant} · ${row.accountName}`;
  if (row.cardDigits) return `${merchant} · 카드 ${row.cardDigits} 미매칭`;
  return merchant;
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex-none rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-sub'}`}>{children}</button>;
}
function Recognized({ n, extra }: { n: number; extra: number }) {
  return <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-good-bg px-[13px] py-[11px] text-[12.5px] font-semibold text-[#13633a]">✅ <b className="font-extrabold">{n}건</b> 인식{extra > 0 ? ` · 미인식 ${extra}건` : ''}</div>;
}
function PreviewHead() {
  return <div className="flex bg-line2 px-[13px] py-[9px] text-[10px] font-bold uppercase tracking-[0.05em] text-faint"><span className="w-[46px]">날짜</span><span className="flex-1">가맹점</span><span className="w-16 text-right">금액</span><span className="w-[26px]" /></div>;
}
function PreviewRow({ date, mer, amount, icon }: { date: string; mer: string; amount: number; icon: string }) {
  return (
    <div className="flex items-center border-t border-line2 px-[13px] py-2.5 text-[12px] font-semibold">
      <span className="num w-[46px] text-sub">{date}</span><span className="flex-1 truncate">{mer}</span><span className="num w-16 text-right font-bold">{won(amount)}</span><span className="w-[26px] text-right">{icon}</span>
    </div>
  );
}
function SaveBtn({ onClick, children, disabled = false }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="mt-3 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white disabled:opacity-40">{children}</button>;
}
