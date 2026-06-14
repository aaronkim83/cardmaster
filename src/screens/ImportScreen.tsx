import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/useAppStore';
import { parseCardSms, isMatched, type ParseResult } from '../parser/cardSmsParser';
import { AppHead } from '../ui/components';
import { won } from '../ui/format';

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

interface ExcelRow { date: string; merchant: string; amount: number }

export function ImportScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const navigate = useAppStore((s) => s.navigate);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'paste' | 'excel'>('paste');
  const [text, setText] = useState(SAMPLE);
  const [results, setResults] = useState<ParseResult[] | null>(null);
  const [excel, setExcel] = useState<{ rows: ExcelRow[]; fileName: string } | null>(null);
  const [excelAccount, setExcelAccount] = useState('');

  const matchAccount = (issuer: string): string | undefined => {
    const key = issuer.replace('카드', '').replace('국민BC', '국민');
    return (accounts.find((a) => a.type === 'card' && a.name.includes(key.slice(0, 2))) ?? accounts.find((a) => a.type === 'card'))?.id;
  };

  async function saveParsed() {
    if (!results) return;
    for (const r of results) {
      if (!isMatched(r)) continue;
      const accId = matchAccount(r.issuer);
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
    if (!dateCol || !amtCol) { alert('날짜/금액 열을 찾지 못했어요.'); return; }
    const rows: ExcelRow[] = raw
      .map((r) => ({ date: toISO(r[dateCol]), merchant: String(merCol ? r[merCol] : '').trim(), amount: Math.abs(Number(String(r[amtCol]).replace(/[^\d.-]/g, ''))) }))
      .filter((r) => r.amount > 0 && r.date);
    setExcel({ rows, fileName: file.name });
    setExcelAccount(accounts.find((a) => a.type === 'card')?.id ?? accounts[0]?.id ?? '');
  }

  async function saveExcel() {
    if (!excel || !excelAccount) return;
    for (const r of excel.rows) {
      await addTransaction({ date: r.date, type: 'expense', amount: r.amount, accountId: excelAccount, merchant: r.merchant || undefined, countsForPerformance: null, source: 'import', status: 'confirmed' });
    }
    navigate('ledger');
  }

  const recognized = results?.filter(isMatched).length ?? 0;

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
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">저장할 결제수단</div>
                <select value={excelAccount} onChange={(e) => setExcelAccount(e.target.value)} className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div className="overflow-hidden rounded-[13px] shadow-card">
                  <PreviewHead />
                  {excel.rows.slice(0, 8).map((r, i) => <PreviewRow key={i} date={r.date.slice(5)} mer={r.merchant || '—'} amount={r.amount} icon="✓" />)}
                  {excel.rows.length > 8 && <div className="border-t border-line2 px-[13px] py-2.5 text-center text-[11px] font-semibold text-faint">＋ {excel.rows.length - 8}건 더</div>}
                </div>
                <SaveBtn onClick={saveExcel}>{excel.rows.length}건 모두 저장</SaveBtn>
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
function SaveBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="mt-3 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">{children}</button>;
}
