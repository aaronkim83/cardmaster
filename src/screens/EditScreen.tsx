import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAccountMap, useCategoryMap } from '../store/lookups';
import { buildCategoryMap, isExcludedForCard } from '../logic/category';
import { FieldRow, Toggle } from '../ui/components';
import { won } from '../ui/format';

const SOURCE_LABEL: Record<string, string> = { manual: '✍️ 직접 입력', parsed: '📋 문자 인식', recurring: '⟳ 자동이체', import: '📄 엑셀 가져오기' };

export function EditScreen() {
  const txnId = useAppStore((s) => s.params.txnId);
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const goBack = useAppStore((s) => s.goBack);
  const accMap = useAccountMap();
  const catMap = useCategoryMap();

  const txn = transactions.find((t) => t.id === txnId);
  const [override, setOverride] = useState<boolean | null>(txn?.countsForPerformance ?? null);

  const catLogicMap = useMemo(() => buildCategoryMap(categories), [categories]);

  if (!txn) return <div className="p-10 text-center text-sm text-sub">거래를 찾을 수 없어요</div>;

  const acc = accMap.get(txn.accountId);
  const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined;
  const autoCounts = txn.type === 'expense' && !!acc?.card?.trackPerformance && !isExcludedForCard(acc, txn.categoryId, catLogicMap);
  const perfOn = override ?? autoCounts;

  async function toggle() {
    const next = perfOn ? false : true;
    setOverride(next);
    await updateTransaction(txn!.id, { countsForPerformance: next });
  }

  return (
    <>
      <div className="flex items-baseline justify-between px-[18px] pb-3 pt-2.5">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em]">거래 수정</h1>
        <span className="rounded-lg bg-warn-bg px-[11px] py-1.5 text-[12px] font-bold text-warn" onClick={async () => { await deleteTransaction(txn.id); goBack(); }}>🗑 삭제</span>
      </div>
      <div className="px-[18px] pb-[120px]">
        <div className="px-5 pb-3 pt-1.5 text-center">
          <div className="mb-1 text-[11.5px] font-semibold text-sub">금액 · {txn.type === 'income' ? '수입' : txn.type === 'transfer' ? '이체' : '지출'}</div>
          <div className={`num text-[32px] font-extrabold ${txn.type === 'income' ? 'text-good' : ''}`}>{won(txn.amount)}<span className="text-faint">원</span></div>
        </div>

        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <FieldRow k="날짜" v={<span className="num">{txn.date}</span>} />
          {txn.time && <FieldRow k="시간" v={<span className="num">{txn.time}</span>} />}
          <FieldRow k="결제수단" v={acc?.name ?? '—'} />
          <FieldRow k="카테고리" v={cat ? `${cat.icon} ${cat.name}` : '미분류'} />
          <FieldRow k="가맹점" v={txn.merchant || '입력 없음'} />
          <FieldRow k="메모" v={txn.memo || '입력 없음'} last />
        </div>

        {txn.type === 'expense' && (
          <>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">실적 · 혜택</div>
            <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
              <div className="flex items-center justify-between border-b border-line2 bg-surface px-[15px] py-3.5">
                <span className="text-[12.5px] font-semibold">
                  실적 인정 <span className="font-semibold text-faint">· 자동판정: {autoCounts ? '인정' : '미인정'}</span>
                </span>
                <Toggle on={perfOn} onChange={toggle} />
              </div>
              <FieldRow k="적용 혜택" v={txn.benefitAmount ? `${won(txn.benefitAmount)}원` : '없음'} last />
            </div>
          </>
        )}

        <div className="overflow-hidden rounded-[13px] shadow-card">
          <FieldRow k="출처" v={SOURCE_LABEL[txn.source] ?? txn.source} last />
        </div>

        <button onClick={goBack} className="mt-4 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">확인</button>
      </div>
    </>
  );
}
