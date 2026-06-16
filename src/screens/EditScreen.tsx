import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { useAccountMap } from '../store/lookups';
import { buildCategoryMap, isExcludedForCard } from '../logic/category';
import { AppHead, Toggle } from '../ui/components';
import { NumberField } from '../ui/Modal';
import { won } from '../ui/format';
import type { Category, Transaction, TxnType } from '../db/types';

const SOURCE_LABEL: Record<string, string> = { manual: '✍️ 직접 입력', parsed: '📋 문자 인식', recurring: '⟳ 자동이체', import: '📄 엑셀 가져오기' };
const TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense', label: '지출' },
  { value: 'income', label: '수입' },
  { value: 'transfer', label: '이체' },
];

type Draft = Pick<Transaction, 'type' | 'amount' | 'date' | 'accountId' | 'toAccountId' | 'categoryId' | 'merchant' | 'memo' | 'countsForPerformance' | 'status'>;

export function EditScreen() {
  const txnId = useAppStore((s) => s.params.txnId);
  const transactions = useAppStore((s) => s.transactions);
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const benefitsList = useAppStore((s) => s.benefits);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const goBack = useAppStore((s) => s.goBack);
  const monthly = useMonthlyData();
  const accMap = useAccountMap();

  const txn = transactions.find((t) => t.id === txnId);
  const [draft, setDraft] = useState<Draft | null>(() => txn ? pick(txn) : null);

  const catLogicMap = useMemo(() => buildCategoryMap(categories), [categories]);

  if (!txn || !draft) return <div className="p-10 text-center text-sm text-sub">거래를 찾을 수 없어요</div>;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const acc = accMap.get(draft.accountId);
  const autoCounts = draft.type === 'expense' && !!acc?.card?.trackPerformance && !isExcludedForCard(acc, draft.categoryId, catLogicMap);
  const perfOn = draft.countsForPerformance ?? autoCounts;

  // 적용 혜택은 저장하지 않고 월 단위로 실시간 계산(computeBenefits)한 값을 표시.
  const appliedBenefit = monthly.benefits.applied.get(txn.id);
  const appliedBenefitName = appliedBenefit ? benefitsList.find((b) => b.id === appliedBenefit.benefitId)?.name : undefined;

  const paymentAccounts = accounts.filter((a) => a.isActive);
  const depositAccounts = accounts.filter((a) => a.kind === 'asset' && a.isActive);

  function changeType(type: TxnType) {
    set({
      type,
      categoryId: type === 'transfer' ? undefined : draft!.categoryId,
      toAccountId: type === 'transfer' ? draft!.toAccountId ?? depositAccounts.find((a) => a.id !== draft!.accountId)?.id : undefined,
      countsForPerformance: type === 'expense' ? draft!.countsForPerformance : null,
    });
  }

  async function save() {
    if (draft!.amount <= 0) return;
    await updateTransaction(txn!.id, {
      type: draft!.type,
      amount: draft!.amount,
      date: draft!.date,
      accountId: draft!.accountId,
      toAccountId: draft!.type === 'transfer' ? draft!.toAccountId : undefined,
      categoryId: draft!.type === 'transfer' ? undefined : draft!.categoryId,
      merchant: draft!.merchant?.trim() || undefined,
      memo: draft!.memo?.trim() || undefined,
      countsForPerformance: draft!.type === 'expense' ? draft!.countsForPerformance : null,
      status: draft!.status,
    });
    goBack();
  }

  return (
    <>
      <AppHead
        title="거래 수정"
        right={<button aria-label="거래 삭제" className="rounded-lg bg-warn-bg px-[11px] py-1.5 text-[12px] font-bold text-warn" onClick={async () => { if (confirm('이 거래를 삭제할까요?')) { await deleteTransaction(txn.id); goBack(); } }}>🗑 삭제</button>}
      />
      <div className="px-[18px] pb-[140px]">
        <div className="px-5 pb-3 pt-1.5 text-center">
          <div className="mb-1 text-[11.5px] font-semibold text-sub">금액</div>
          <NumberField
            ariaLabel="금액"
            value={draft.amount}
            onChange={(n) => set({ amount: n })}
            className={`num w-full bg-transparent text-center text-[32px] font-extrabold outline-none ${draft.type === 'income' ? 'text-good' : ''}`}
          />
        </div>

        <div className="mb-3.5 flex rounded-xl bg-line2 p-[3px]">
          {TYPES.map((t) => (
            <button key={t.value} onClick={() => changeType(t.value)} className={`flex-1 rounded-[9px] py-[9px] text-center text-[13px] font-bold ${draft.type === t.value ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t.label}</button>
          ))}
        </div>

        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Field k="날짜">
            <input aria-label="날짜" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="num rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />
          </Field>
          <Field k={draft.type === 'transfer' ? '출금 계좌' : draft.type === 'income' ? '입금 계좌' : '결제수단'}>
            <Select aria-label="결제수단" value={draft.accountId} onChange={(v) => set({ accountId: v })} options={(draft.type === 'income' ? depositAccounts : paymentAccounts).map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
          {draft.type === 'transfer' ? (
            <Field k="입금 계좌" last>
              <Select aria-label="입금 계좌" value={draft.toAccountId ?? ''} onChange={(v) => set({ toAccountId: v })} options={accounts.filter((a) => a.isActive && a.id !== draft.accountId).map((a) => ({ value: a.id, label: a.name }))} />
            </Field>
          ) : (
            <>
              <Field k="카테고리">
                <CategorySelect type={draft.type} categories={categories} value={draft.categoryId ?? ''} onChange={(v) => set({ categoryId: v || undefined })} />
              </Field>
              <Field k="가맹점">
                <input aria-label="가맹점" value={draft.merchant ?? ''} onChange={(e) => set({ merchant: e.target.value })} placeholder="입력 없음" className="w-[150px] rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />
              </Field>
              <Field k="메모" last>
                <input aria-label="메모" value={draft.memo ?? ''} onChange={(e) => set({ memo: e.target.value })} placeholder="입력 없음" className="w-[150px] rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />
              </Field>
            </>
          )}
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">상태 · 실적</div>
        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <div className="flex items-center justify-between border-b border-line2 bg-surface px-[15px] py-3.5">
            <span className="text-[12.5px] font-semibold">확정 거래 <span className="font-semibold text-faint">· {draft.status === 'pending' ? '대기(집계 제외)' : '집계 포함'}</span></span>
            <Toggle ariaLabel="확정 거래" on={draft.status === 'confirmed'} onChange={(v) => set({ status: v ? 'confirmed' : 'pending' })} />
          </div>
          {draft.type === 'expense' && (
            <div className="flex items-center justify-between border-b border-line2 bg-surface px-[15px] py-3.5">
              <span className="text-[12.5px] font-semibold">실적 인정 <span className="font-semibold text-faint">· 자동판정: {autoCounts ? '인정' : '미인정'}</span></span>
              <Toggle ariaLabel="실적 인정" on={perfOn} onChange={(v) => set({ countsForPerformance: v })} />
            </div>
          )}
          <Field k="적용 혜택" last>
            {appliedBenefit ? (
              <span className="text-[13.5px] font-bold text-good">🎁 {appliedBenefitName ?? '혜택'} {won(appliedBenefit.benefitAmount)}원</span>
            ) : (
              <span className="text-[13.5px] font-bold text-faint">없음</span>
            )}
          </Field>
        </div>

        <div className="overflow-hidden rounded-[13px] shadow-card">
          <Field k="출처" last><span className="text-[13.5px] font-bold">{SOURCE_LABEL[txn.source] ?? txn.source}</span></Field>
        </div>

        <button onClick={save} className="mt-4 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">저장</button>
      </div>
    </>
  );
}

function pick(t: Transaction): Draft {
  return {
    type: t.type, amount: t.amount, date: t.date, accountId: t.accountId, toAccountId: t.toAccountId,
    categoryId: t.categoryId, merchant: t.merchant, memo: t.memo, countsForPerformance: t.countsForPerformance, status: t.status,
  };
}

function Field({ k, children, last }: { k: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 bg-surface px-[15px] py-3 ${last ? '' : 'border-b border-line2'}`}>
      <span className="flex-none text-[12.5px] font-semibold text-sub">{k}</span>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] } & { 'aria-label'?: string }) {
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[180px] rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function CategorySelect({ type, categories, value, onChange }: { type: TxnType; categories: Category[]; value: string; onChange: (v: string) => void }) {
  const mains = categories.filter((c) => c.type === type && c.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <select aria-label="카테고리" value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[180px] rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none">
      <option value="">미분류</option>
      {mains.map((main) => {
        const subs = categories.filter((c) => c.parentId === main.id).sort((a, b) => a.sortOrder - b.sortOrder);
        if (subs.length === 0) return <option key={main.id} value={main.id}>{main.icon} {main.name}</option>;
        return (
          <optgroup key={main.id} label={`${main.icon} ${main.name}`}>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}
