import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { Toggle } from '../ui/components';
import { NumberField } from '../ui/Modal';
import type { Benefit } from '../db/types';

function blank(accountId: string): Benefit {
  return { id: nanoid(), accountId, name: '새 혜택', type: 'discount', rate: 0.1, requiresPerformance: false, isActive: true, limitBasis: 'benefit_amount' };
}

export function BenefitEditScreen() {
  const benefitId = useAppStore((s) => s.params.benefitId);
  const accountId = useAppStore((s) => s.params.accountId);
  const benefits = useAppStore((s) => s.benefits);
  const saveBenefit = useAppStore((s) => s.saveBenefit);
  const deleteBenefit = useAppStore((s) => s.deleteBenefit);
  const goBack = useAppStore((s) => s.goBack);

  const existing = benefits.find((b) => b.id === benefitId);
  const [draft, setDraft] = useState<Benefit>(() => existing ?? blank(accountId ?? ''));

  return (
    <>
      <div className="flex items-baseline justify-between px-[18px] pb-3 pt-2.5">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em]">혜택 설정</h1>
        {existing && <span className="rounded-lg bg-warn-bg px-[11px] py-1.5 text-[12px] font-bold text-warn" onClick={async () => { await deleteBenefit(draft.id); goBack(); }}>🗑 삭제</span>}
      </div>
      <div className="px-[18px] pb-[120px]">
        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Row k="혜택 이름" v={<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} last />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">유형</div>
        <div className="mb-3.5 flex rounded-xl bg-line2 p-[3px]">
          {(['discount', 'point'] as const).map((t) => (
            <button key={t} onClick={() => setDraft({ ...draft, type: t })} className={`flex-1 rounded-[9px] py-[9px] text-center text-[13px] font-bold ${draft.type === t ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t === 'discount' ? '할인' : '적립'}</button>
          ))}
        </div>

        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Row k="적용 대상 가맹점" v={<input value={draft.targetMerchant ?? ''} onChange={(e) => setDraft({ ...draft, targetMerchant: e.target.value || undefined })} placeholder="(전체)" className="rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} />
          <Row k="비율 (%)" v={<NumberField value={Math.round(draft.rate * 100)} onChange={(n) => setDraft({ ...draft, rate: n / 100 })} className="num w-20 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} />
          <Row k="월 한도 (원)" v={<NumberField value={draft.monthlyLimit ?? 0} onChange={(n) => setDraft({ ...draft, monthlyLimit: n || undefined })} className="num w-28 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} last />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">조건</div>
        <div className="overflow-hidden rounded-[13px] shadow-card">
          <Row k="실적 충족 시에만 적용" v={<Toggle on={draft.requiresPerformance} onChange={(v) => setDraft({ ...draft, requiresPerformance: v })} />} last />
        </div>

        <button onClick={async () => { await saveBenefit(draft); goBack(); }} className="mt-4 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">저장</button>
      </div>
    </>
  );
}

function Row({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between bg-surface px-[15px] py-3.5 ${last ? '' : 'border-b border-line2'}`}>
      <span className="text-[12.5px] font-semibold text-sub">{k}</span>{v}
    </div>
  );
}
