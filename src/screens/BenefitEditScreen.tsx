import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { AppHead, Toggle } from '../ui/components';
import { NumberField } from '../ui/Modal';
import type { Benefit, BenefitValueType } from '../db/types';

function blank(accountId: string): Benefit {
  return { id: nanoid(), accountId, name: '새 혜택', type: 'discount', valueType: 'rate', rate: 0.1, requiresPerformance: false, isActive: true, limitBasis: 'benefit_amount' };
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
  const [rateText, setRateText] = useState(() => formatPercent(existing?.rate ?? 0.1));
  const valueType = draft.valueType ?? 'rate';

  useEffect(() => {
    const next = existing ?? blank(accountId ?? '');
    setDraft(next);
    setRateText(formatPercent(next.rate));
  }, [benefitId, accountId]);

  async function save() {
    if (!draft.name.trim()) return;
    await saveBenefit(normalizeBenefitDraft(draft));
    goBack();
  }

  return (
    <>
      <AppHead
        title="혜택 설정"
        right={existing && <span className="rounded-lg bg-warn-bg px-[11px] py-1.5 text-[12px] font-bold text-warn" onClick={async () => { await deleteBenefit(draft.id); goBack(); }}>🗑 삭제</span>}
      />
      <div className="px-[18px] pb-[120px]">
        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Row k="혜택 이름" v={<input aria-label="혜택 이름" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} last />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">유형</div>
        <div className="mb-3.5 flex rounded-xl bg-line2 p-[3px]">
          {(['discount', 'point'] as const).map((t) => (
            <button key={t} onClick={() => setDraft({ ...draft, type: t })} className={`flex-1 rounded-[9px] py-[9px] text-center text-[13px] font-bold ${draft.type === t ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t === 'discount' ? '할인' : '적립'}</button>
          ))}
        </div>

        <div className="mb-3.5 overflow-hidden rounded-[13px] shadow-card">
          <Row k="적용 대상 가맹점" v={<input value={draft.targetMerchant ?? ''} onChange={(e) => setDraft({ ...draft, targetMerchant: e.target.value || undefined })} placeholder="(전체)" className="rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} />
          <Row k="혜택 방식" v={<ValueTypeTabs value={valueType} onChange={(v) => setDraft({ ...draft, valueType: v })} />} />
          {valueType === 'rate' ? (
            <Row k="비율 (%)" v={<PercentField value={rateText} onChange={(text, rate) => { setRateText(text); setDraft({ ...draft, rate }); }} />} />
          ) : (
            <Row k="혜택액 (원)" v={<NumberField ariaLabel="혜택액 (원)" value={draft.fixedAmount ?? 0} onChange={(n) => setDraft({ ...draft, fixedAmount: n })} className="num w-28 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} />
          )}
          <Row k="월 한도 (원)" v={<NumberField value={draft.monthlyLimit ?? 0} onChange={(n) => setDraft({ ...draft, monthlyLimit: n || undefined })} className="num w-28 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none" />} last />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">조건</div>
        <div className="overflow-hidden rounded-[13px] shadow-card">
          <Row k="실적 충족 시에만 적용" v={<Toggle on={draft.requiresPerformance} onChange={(v) => setDraft({ ...draft, requiresPerformance: v })} />} last />
        </div>

        <button onClick={save} className="mt-4 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">저장</button>
      </div>
    </>
  );
}

function normalizeBenefitDraft(draft: Benefit): Benefit {
  const valueType = draft.valueType ?? 'rate';
  return {
    ...draft,
    name: draft.name.trim(),
    valueType,
    rate: valueType === 'rate' ? draft.rate : 0,
    fixedAmount: valueType === 'fixed' && (draft.fixedAmount ?? 0) > 0 ? draft.fixedAmount : undefined,
    monthlyLimit: draft.monthlyLimit && draft.monthlyLimit > 0 ? draft.monthlyLimit : undefined,
  };
}

function ValueTypeTabs({ value, onChange }: { value: BenefitValueType; onChange: (v: BenefitValueType) => void }) {
  const options: { value: BenefitValueType; label: string }[] = [
    { value: 'rate', label: '정률' },
    { value: 'fixed', label: '정액' },
  ];
  return (
    <div className="flex rounded-lg bg-line2 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${value === option.value ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PercentField({ value, onChange }: { value: string; onChange: (text: string, rate: number) => void }) {
  return (
    <input
      aria-label="비율 (%)"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const text = normalizePercentInput(e.target.value);
        onChange(text, percentTextToRate(text));
      }}
      onBlur={(e) => {
        const rate = percentTextToRate(e.target.value);
        onChange(formatPercent(rate), rate);
      }}
      className="num w-20 rounded-md bg-line2 px-2 py-1 text-right text-[13.5px] font-bold outline-none"
    />
  );
}

function normalizePercentInput(raw: string): string {
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [first, ...rest] = normalized.split('.');
  return rest.length === 0 ? first : `${first}.${rest.join('')}`;
}

function percentTextToRate(text: string): number {
  const percent = Number(text || 0);
  return Number.isFinite(percent) ? percent / 100 : 0;
}

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0';
  return String(Math.round(rate * 10000) / 100).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function Row({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between bg-surface px-[15px] py-3.5 ${last ? '' : 'border-b border-line2'}`}>
      <span className="text-[12.5px] font-semibold text-sub">{k}</span>{v}
    </div>
  );
}
