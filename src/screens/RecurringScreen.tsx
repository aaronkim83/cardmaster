import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { useAccountMap } from '../store/lookups';
import { buildCategoryMap, isExcludedForCard } from '../logic/category';
import { isRuleActiveInMonth, dueDate } from '../logic/recurring';
import { AppHead, AddButton, Toggle } from '../ui/components';
import { Modal, Labeled, TextInput, NumberField, PrimaryButton, ChoiceRow } from '../ui/Modal';
import { won } from '../ui/format';
import type { RecurringRule } from '../db/types';

export function RecurringScreen() {
  const rules = useAppStore((s) => s.recurringRules);
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const saveRecurring = useAppStore((s) => s.saveRecurring);
  const deleteRecurring = useAppStore((s) => s.deleteRecurring);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const accMap = useAccountMap();
  const catMap = useMemo(() => buildCategoryMap(categories), [categories]);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  const active = rules.filter((r) => isRuleActiveInMonth(r, selectedMonth)).sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const monthTotal = active.reduce((s, r) => s + r.amount, 0);
  const perfTotal = active.reduce((s, r) => {
    const acc = accMap.get(r.accountId);
    if (r.type !== 'expense' || !acc?.card?.trackPerformance) return s;
    if (isExcludedForCard(acc, r.categoryId, catMap)) return s;
    return r.amount < (acc.card?.minPerTxn ?? 0) ? s : s + r.amount;
  }, 0);
  const variable = active.filter((r) => r.isVariable);

  async function confirmVariable(r: RecurringRule) {
    const input = prompt(`${r.name} 이번 달 실제 금액 (원)`, String(r.amount));
    if (!input) return;
    const amount = Number(input.replace(/[^\d]/g, ''));
    if (!amount) return;
    await addTransaction({
      date: dueDate(r, selectedMonth), type: r.type, amount, accountId: r.accountId,
      categoryId: r.categoryId, merchant: r.name, countsForPerformance: null,
      source: 'recurring', status: 'confirmed', recurringId: r.id,
    });
  }

  return (
    <>
      <AppHead title="자동이체" right={<span className="num text-[13px] font-semibold text-sub">{active.length}건 등록</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 flex gap-2.5">
          <Stat label="이번 달 예정 합계" value={won(monthTotal)} />
          <Stat label="카드 실적 반영분" value={won(perfTotal)} accent />
        </div>

        {variable.map((r) => (
          <div key={r.id} className="mb-3.5 flex items-center gap-2.5 rounded-[13px] border border-[#F3D6C7] bg-warn-bg px-[13px] py-[11px]">
            <span className="text-[15px]">⏳</span>
            <span className="flex-1 text-[12px] font-medium leading-snug"><b className="font-bold text-warn">{r.name}</b> 금액이 매달 달라요 · 지난달 {won(r.amount)}</span>
            <button onClick={() => confirmVariable(r)} className="rounded-[9px] bg-warn px-3 py-1.5 text-[11.5px] font-bold text-white">확인</button>
          </div>
        ))}

        <div className="mb-[9px] mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">등록된 자동이체</div>
        {active.map((r) => {
          const acc = accMap.get(r.accountId);
          const isCard = acc?.type === 'card';
          const excluded = acc ? isExcludedForCard(acc, r.categoryId, catMap) : false;
          const reflects = isCard && acc?.card?.trackPerformance && !excluded && r.type === 'expense' && r.amount >= (acc?.card?.minPerTxn ?? 0);
          return (
            <div key={r.id} onClick={() => setEditing(r)} className="mb-2 flex items-center gap-[11px] rounded-[13px] bg-surface px-[13px] py-[11px] shadow-card">
              <div className="flex h-[38px] w-[38px] flex-none flex-col items-center justify-center rounded-[10px] bg-line2 leading-none">
                <div className="num text-sm font-extrabold">{r.dayOfMonth}</div><div className="mt-px text-[8.5px] font-bold text-sub">매월</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold">{r.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-sub">
                  <span className="inline-block h-2 w-2 flex-none rounded-[3px]" style={{ background: acc?.color ?? 'var(--faint)' }} />{acc?.name}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="num text-sm font-extrabold">{won(r.amount)}</div>
                <span className={`mt-[3px] inline-block rounded-md px-1.5 py-px text-[9.5px] font-bold ${reflects ? 'bg-good-bg text-good' : 'bg-line2 text-faint'}`}>{reflects ? '실적 반영' : isCard ? '실적 제외' : '카드 아님'}</span>
              </div>
            </div>
          );
        })}
        <AddButton onClick={() => setEditing(blankRule(accounts[0]?.id ?? ''))}>＋ 자동이체 추가</AddButton>
      </div>

      {editing && (
        <RuleForm rule={editing} onClose={() => setEditing(null)} onDelete={async (id) => { await deleteRecurring(id); setEditing(null); }} onSave={async (r) => { await saveRecurring(r); setEditing(null); }} />
      )}
    </>
  );
}

function blankRule(accountId: string): RecurringRule {
  return { id: nanoid(), name: '', type: 'expense', amount: 0, isVariable: false, accountId, dayOfMonth: 1, startDate: new Date().toISOString().slice(0, 10), autoConfirm: true, isActive: true };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-[14px] bg-surface px-3.5 py-[13px] shadow-card">
      <div className="mb-1.5 text-[11px] font-semibold text-sub">{label}</div>
      <div className={`num text-base font-extrabold ${accent ? 'text-samsung' : ''}`}>{value}원</div>
    </div>
  );
}

function RuleForm({ rule, onClose, onSave, onDelete }: { rule: RecurringRule; onClose: () => void; onSave: (r: RecurringRule) => void; onDelete: (id: string) => void }) {
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const [d, setD] = useState<RecurringRule>(rule);
  const isNew = !useAppStore.getState().recurringRules.some((x) => x.id === rule.id);
  const leafCats = categories.filter((c) => c.type === d.type && (c.parentId !== null || !categories.some((x) => x.parentId === c.id)));

  return (
    <Modal title={isNew ? '자동이체 추가' : '자동이체 편집'} onClose={onClose}>
      <Labeled label="이름"><TextInput value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="예: 넷플릭스" /></Labeled>
      <Labeled label="유형"><ChoiceRow options={[{ value: 'expense', label: '지출' }, { value: 'income', label: '수입' }]} value={d.type} onChange={(v) => setD({ ...d, type: v })} /></Labeled>
      <div className="flex gap-2.5">
        <div className="flex-1"><Labeled label="금액 (원)"><NumberField value={d.amount} onChange={(n) => setD({ ...d, amount: n })} /></Labeled></div>
        <div className="w-28"><Labeled label="결제일"><NumberField value={d.dayOfMonth} onChange={(n) => setD({ ...d, dayOfMonth: Math.min(Math.max(n, 1), 31) })} /></Labeled></div>
      </div>
      <Labeled label="결제수단">
        <select value={d.accountId} onChange={(e) => setD({ ...d, accountId: e.target.value })} className="w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Labeled>
      <Labeled label="카테고리">
        <select value={d.categoryId ?? ''} onChange={(e) => setD({ ...d, categoryId: e.target.value || undefined })} className="w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none">
          <option value="">미지정</option>
          {leafCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Labeled>
      <div className="mb-3 flex items-center justify-between rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5">
        <span className="text-[13px] font-semibold">금액이 매달 다름 (변동·확인 필요)</span>
        <Toggle on={d.isVariable} onChange={(v) => setD({ ...d, isVariable: v, autoConfirm: !v })} />
      </div>
      <PrimaryButton onClick={() => d.name.trim() && onSave(d)}>저장</PrimaryButton>
      {!isNew && <button onClick={() => onDelete(d.id)} className="mt-2 w-full rounded-[13px] bg-warn-bg py-3 text-center text-[13px] font-bold text-warn">삭제</button>}
    </Modal>
  );
}
