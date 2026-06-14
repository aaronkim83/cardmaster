import { useState } from 'react';
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

export function ImportScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const navigate = useAppStore((s) => s.navigate);

  const [text, setText] = useState(SAMPLE);
  const [results, setResults] = useState<ParseResult[] | null>(null);

  const matchAccount = (issuer: string): string | undefined => {
    const key = issuer.replace('카드', '').replace('국민BC', '국민');
    return (accounts.find((a) => a.type === 'card' && a.name.includes(key.slice(0, 2))) ?? accounts.find((a) => a.type === 'card'))?.id;
  };

  async function saveAll() {
    if (!results) return;
    for (const r of results) {
      if (!isMatched(r)) continue;
      const accId = matchAccount(r.issuer);
      if (!accId) continue;
      await addTransaction({
        date: r.date ?? new Date().toISOString().slice(0, 10),
        time: r.time ?? undefined,
        type: 'expense',
        amount: r.amount,
        accountId: accId,
        merchant: r.merchant,
        countsForPerformance: null,
        source: 'parsed',
        status: 'confirmed',
      });
    }
    navigate('ledger');
  }

  const recognized = results?.filter(isMatched).length ?? 0;

  return (
    <>
      <AppHead title="가져오기" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 flex gap-1.5">
          <span className="flex-none rounded-[20px] border border-ink bg-ink px-[13px] py-[7px] text-[12.5px] font-semibold text-white">📋 붙여넣기</span>
          <span className="flex-none rounded-[20px] border border-line bg-surface px-[13px] py-[7px] text-[12.5px] font-semibold text-sub">📄 엑셀 (준비 중)</span>
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-[130px] w-full resize-y rounded-[13px] border-[1.5px] border-line bg-surface p-[13px] text-[12.5px] leading-relaxed outline-none focus:border-ink" />
        <button onClick={() => setResults(parseCardSms(text))} className="mt-2.5 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">인식하기</button>

        {results && (
          <>
            <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-good-bg px-[13px] py-[11px] text-[12.5px] font-semibold text-[#13633a]">
              ✅ <b className="font-extrabold">{recognized}건</b> 인식{results.length > recognized ? ` · 미인식 ${results.length - recognized}건` : ''}
            </div>
            <div className="mt-3.5 overflow-hidden rounded-[13px] shadow-card">
              <div className="flex bg-line2 px-[13px] py-[9px] text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
                <span className="w-[46px]">날짜</span><span className="flex-1">가맹점 · 카드</span><span className="w-16 text-right">금액</span><span className="w-[26px]" />
              </div>
              {results.map((r, i) => isMatched(r) ? (
                <div key={i} className="flex items-center border-t border-line2 px-[13px] py-2.5 text-[12px] font-semibold">
                  <span className="num w-[46px] text-sub">{r.date?.slice(5) ?? '--'}</span>
                  <span className="flex-1 truncate">{r.merchant} <span className="font-semibold text-faint">· {r.issuer}</span></span>
                  <span className="num w-16 text-right font-bold">{won(r.amount)}</span>
                  <span className="w-[26px] text-right">{r.kind === '매출접수' ? '📩' : '✓'}</span>
                </div>
              ) : (
                <div key={i} className="flex items-center border-t border-line2 px-[13px] py-2.5 text-[12px] font-semibold text-warn">
                  <span className="w-[46px]">⚠</span><span className="flex-1">미인식 — 직접 입력</span>
                </div>
              ))}
            </div>
            {recognized > 0 && <button onClick={saveAll} className="mt-3 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">{recognized}건 저장</button>}
          </>
        )}
      </div>
    </>
  );
}
