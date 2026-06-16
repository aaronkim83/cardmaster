import type { ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { monthLabel } from './format';

export function Chip({
  color,
  imageSrc,
  children,
  size = 28,
}: {
  color?: string;
  imageSrc?: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-lg font-extrabold text-white"
      style={{ background: color ?? 'var(--ink)', width: size, height: size, fontSize: size * 0.4 }}
    >
      {imageSrc ? <img src={imageSrc} alt="" className="h-full w-full object-cover" /> : children}
    </span>
  );
}

export function AppHead({ title, right }: { title: string; right?: ReactNode }) {
  const canGoBack = useAppStore((s) => s.history.length > 0);
  const goBack = useAppStore((s) => s.goBack);

  return (
    <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-[10px]">
      <div className="flex min-w-0 items-center gap-1.5">
        {canGoBack && (
          <button
            type="button"
            aria-label="이전 화면"
            onClick={goBack}
            className="-ml-2 flex h-9 w-9 flex-none items-center justify-center rounded-full text-[24px] font-semibold leading-none text-sub active:bg-line2"
          >
            ‹
          </button>
        )}
        <h1 className="truncate text-[22px] font-extrabold tracking-[-0.03em]">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function MonthNav() {
  const { selectedMonth, goPrevMonth, goNextMonth } = useAppStore();
  return (
    <div className="flex items-center gap-1.5">
      <button className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-lg font-semibold text-sub" onClick={goPrevMonth}>
        ‹
      </button>
      <span className="num min-w-[84px] text-center text-sm font-bold">
        {monthLabel(selectedMonth.year, selectedMonth.month)}
      </span>
      <button className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-lg font-semibold text-sub" onClick={goNextMonth}>
        ›
      </button>
    </div>
  );
}

export function GroupLabel({ children, count, warn }: { children: ReactNode; count?: number; warn?: boolean }) {
  return (
    <div className={`mx-0.5 mb-[9px] mt-4 flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.08em] ${warn ? 'text-warn' : 'text-sub'}`}>
      {children}
      {count !== undefined && <span className="font-bold text-faint">{count}</span>}
    </div>
  );
}

export function Meter({
  fillPct,
  plannedPct = 0,
  pacePct,
  color = 'var(--ink)',
  height = 7,
}: {
  fillPct: number;
  plannedPct?: number;
  pacePct?: number;
  color?: string;
  height?: number;
}) {
  const fill = Math.min(Math.max(fillPct, 0), 1) * 100;
  const planned = Math.min(Math.max(plannedPct, 0), 1) * 100;
  return (
    <div className="relative rounded-md bg-line2" style={{ height }}>
      <div className="absolute left-0 top-0 bottom-0 rounded-md" style={{ width: `${fill}%`, background: color }} />
      {planned > 0 && (
        <div className="absolute top-0 bottom-0 rounded-md opacity-30" style={{ left: `${fill}%`, width: `${planned}%`, background: color }} />
      )}
      {pacePct !== undefined && (
        <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-ink opacity-45" style={{ left: `${Math.min(pacePct, 1) * 100}%` }} />
      )}
    </div>
  );
}

export function SegTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-3.5 flex gap-1.5 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-none rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-semibold ${
            value === o.value ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-sub'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, ariaLabel }: { on: boolean; onChange?: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange?.(!on)}
      className={`relative h-6 w-[42px] flex-none rounded-full transition-colors ${on ? 'bg-good' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

export function FieldRow({ k, v, onClick, last }: { k: ReactNode; v: ReactNode; onClick?: () => void; last?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between gap-3 bg-surface px-[15px] py-3.5 ${last ? '' : 'border-b border-line2'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="text-[12.5px] font-semibold text-sub">{k}</span>
      <span className="text-right text-[13.5px] font-bold">{v}</span>
    </div>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 w-full rounded-[13px] border-[1.5px] border-dashed border-line p-3.5 text-center text-[13px] font-bold text-sub"
    >
      {children}
    </button>
  );
}
