import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppHead, AddButton } from '../ui/components';

export function CategoryScreen() {
  const categories = useAppStore((s) => s.categories);
  const [type, setType] = useState<'expense' | 'income'>('expense');

  const mains = categories
    .filter((c) => c.type === type && c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <AppHead title="카테고리 관리" right={<span className="rounded-lg bg-line2 px-[11px] py-1.5 text-[12px] font-bold text-sub">편집</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-1 flex rounded-xl bg-line2 p-[3px]">
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 rounded-[9px] py-[9px] text-center text-[13px] font-bold ${type === t ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t === 'expense' ? '지출' : '수입'}</button>
          ))}
        </div>

        {mains.map((main) => {
          const subs = categories.filter((c) => c.parentId === main.id).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={main.id}>
              <div className="mx-0.5 mb-[9px] mt-4 flex items-center gap-2 text-[13px] font-extrabold">
                <span className="text-[15px]">{main.icon}</span>{main.name}
                {main.defaultExcluded && <span className="ml-auto rounded-md bg-line2 px-2 py-[3px] text-[10px] font-bold text-sub">실적 제외</span>}
              </div>
              {subs.length > 0 && (
                <div className="overflow-hidden rounded-[13px] shadow-card">
                  {subs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-[13px] border-b border-line2 bg-surface px-[15px] py-[13px] last:border-b-0">
                      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-base" style={{ background: 'var(--line2)' }}>{sub.icon}</span>
                      <span className="text-[14px] font-semibold">{sub.name}</span>
                      <span className="ml-auto text-[15px] text-faint">⋮⋮</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-4"><AddButton>＋ 대분류 추가</AddButton></div>
      </div>
    </>
  );
}
