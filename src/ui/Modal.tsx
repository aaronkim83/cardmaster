import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// 하단 시트형 모달. document.body로 포털 → 탭바/앱 컨테이너 위로 확실히 띄움.
// 키보드가 뜨면 --keyboard-inset 만큼 위로 올려 저장 버튼이 키보드에 가리지 않게 함.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-canvas p-[18px] pb-[max(28px,env(safe-area-inset-bottom))] [&::-webkit-scrollbar]:hidden"
        style={{ marginBottom: 'var(--keyboard-inset, 0px)', maxHeight: 'calc(100dvh - var(--keyboard-inset, 0px) - env(safe-area-inset-top) - 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="text-xl text-faint">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-sub">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-ink" />;
}

// 숫자 입력 — 0일 때 빈 칸으로 표시(강제 0/선행 0 방지), 숫자만 허용.
export function NumberField({
  value,
  onChange,
  placeholder = '0',
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      value={value === 0 ? '' : String(value)}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        onChange(digits === '' ? 0 : Number(digits));
      }}
      className={className ?? 'w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-ink'}
    />
  );
}

export function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="mt-2 w-full rounded-[13px] bg-ink py-3 text-center text-[14.5px] font-bold text-white">{children}</button>;
}

export function ChoiceRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`rounded-[10px] border-[1.5px] px-3 py-2 text-[13px] font-semibold ${value === o.value ? 'border-ink bg-surface text-ink' : 'border-line bg-surface text-sub'}`}>{o.label}</button>
      ))}
    </div>
  );
}
