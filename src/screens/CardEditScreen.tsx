import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { AppHead, AddButton, Chip, Toggle } from '../ui/components';
import { NumberField } from '../ui/Modal';
import { won } from '../ui/format';
import type { Account, CardConfig } from '../db/types';

function blankCard(): Account {
  return {
    id: nanoid(),
    name: '새 카드',
    kind: 'liability',
    type: 'card',
    balanceMode: 'calculated',
    openingBalance: 0,
    card: { targetAmount: 0, cycleType: 'prev_month', trackPerformance: true, excludedCategoryIds: [] },
    isPinned: false,
    isActive: true,
    sortOrder: 0,
    color: '#1A1916',
    icon: '카',
    createdAt: Date.now(),
  };
}

export function CardEditScreen() {
  const accountId = useAppStore((s) => s.params.accountId);
  const accounts = useAppStore((s) => s.accounts);
  const benefits = useAppStore((s) => s.benefits);
  const saveAccount = useAppStore((s) => s.saveAccount);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const navigate = useAppStore((s) => s.navigate);
  const goBack = useAppStore((s) => s.goBack);
  const data = useMonthlyData();

  const existing = accounts.find((a) => a.id === accountId);
  const [draft, setDraft] = useState<Account>(() => existing ?? blankCard());
  const cfg = draft.card!;
  const setCfg = (patch: Partial<CardConfig>) => setDraft((d) => ({ ...d, card: { ...d.card!, ...patch } }));

  const cardBenefits = benefits.filter((b) => b.accountId === draft.id);
  const monthBenefit = data.benefits.byCard.get(draft.id) ?? 0;

  async function save() {
    await saveAccount(draft);
    goBack();
  }

  return (
    <>
      <AppHead
        title="카드 설정"
        right={existing && <span className="rounded-lg bg-warn-bg px-[11px] py-1.5 text-[12px] font-bold text-warn" onClick={async () => { await deleteAccount(draft.id); navigate('cards'); }}>🗑 삭제</span>}
      />
      <div className="px-[18px] pb-[120px]">
        <div className="mb-4 flex items-center gap-[11px]">
          <Chip color={draft.color} size={36}>{draft.icon}</Chip>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-lg bg-surface px-2 py-1 text-base font-bold shadow-card outline-none" />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">실적 설정</div>
        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Field k="실적 추적" v={<Toggle on={cfg.trackPerformance} onChange={(v) => setCfg({ trackPerformance: v })} />} />
          <Field k="핀 고정(집중)" v={<Toggle on={draft.isPinned} onChange={(v) => setDraft({ ...draft, isPinned: v })} />} />
          <NumField k="목표 금액" value={cfg.targetAmount} onChange={(n) => setCfg({ targetAmount: n })} />
          <Field k="산정 기준" v={<button onClick={() => setCfg({ cycleType: cfg.cycleType === 'prev_month' ? 'curr_month' : 'prev_month' })} className="text-[13.5px] font-bold">{cfg.cycleType === 'prev_month' ? '전월기준' : '당월기준'} ⇄</button>} />
          <NumField k="최소 건당금액" value={cfg.minPerTxn ?? 0} onChange={(n) => setCfg({ minPerTxn: n })} />
          <NumField k="결제일" value={cfg.settlementDay ?? 0} onChange={(n) => setCfg({ settlementDay: n })} last />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-sub">혜택 {cardBenefits.length}</span>
          <span className="text-[12px] font-bold text-good">{data.selectedMonth.month}월 +{won(monthBenefit)}원</span>
        </div>
        <div className="overflow-hidden rounded-[13px] shadow-card">
          {cardBenefits.length === 0 && <div className="bg-surface px-[15px] py-4 text-center text-[12.5px] text-faint">등록된 혜택이 없어요</div>}
          {cardBenefits.map((b, i) => {
            const prog = data.benefits.byBenefit.get(b.id);
            return (
              <div key={b.id} onClick={() => navigate('benefit', { benefitId: b.id, accountId: draft.id })} className={`flex items-center justify-between bg-surface px-[15px] py-3.5 ${i < cardBenefits.length - 1 ? 'border-b border-line2' : ''}`}>
                <span className="text-[12.5px] font-semibold">🎁 {b.name}</span>
                <span className="text-[12.5px] font-semibold text-sub">
                  <b className="text-good">{won(prog?.received ?? 0)}</b>{b.monthlyLimit ? ` / ${won(b.monthlyLimit)}원` : `원 ${b.type === 'point' ? '적립' : '할인'}`} ›
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1"><AddButton onClick={() => navigate('benefit', { accountId: draft.id })}>＋ 혜택 추가</AddButton></div>

        <button onClick={save} className="mt-4 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">저장</button>
      </div>
    </>
  );
}

function Field({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between bg-surface px-[15px] py-3.5 ${last ? '' : 'border-b border-line2'}`}>
      <span className="text-[12.5px] font-semibold text-sub">{k}</span>{v}
    </div>
  );
}
function NumField({ k, value, onChange, last }: { k: string; value: number; onChange: (n: number) => void; last?: boolean }) {
  return (
    <Field k={k} last={last} v={<NumberField value={value} onChange={onChange} className="num w-32 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} />
  );
}
