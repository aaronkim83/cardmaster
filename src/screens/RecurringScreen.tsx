import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAccountMap } from '../store/lookups';
import { buildCategoryMap, isExcludedForCard } from '../logic/category';
import { isRuleActiveInMonth } from '../logic/recurring';
import { AppHead, AddButton } from '../ui/components';
import { won } from '../ui/format';

export function RecurringScreen() {
  const rules = useAppStore((s) => s.recurringRules);
  const categories = useAppStore((s) => s.categories);
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const accMap = useAccountMap();
  const catMap = useMemo(() => buildCategoryMap(categories), [categories]);

  const active = rules.filter((r) => isRuleActiveInMonth(r, selectedMonth)).sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const monthTotal = active.reduce((s, r) => s + r.amount, 0);

  const perfTotal = active.reduce((s, r) => {
    const acc = accMap.get(r.accountId);
    if (r.type !== 'expense' || !acc?.card?.trackPerformance) return s;
    if (isExcludedForCard(acc, r.categoryId, catMap)) return s;
    if (r.amount < (acc.card?.minPerTxn ?? 0)) return s;
    return s + r.amount;
  }, 0);

  const variable = active.filter((r) => r.isVariable);

  return (
    <>
      <AppHead title="자동이체" right={<span className="num text-[13px] font-semibold text-sub">{active.length}건 등록</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 flex gap-2.5">
          <div className="flex-1 rounded-[14px] bg-surface px-3.5 py-[13px] shadow-card">
            <div className="mb-1.5 text-[11px] font-semibold text-sub">이번 달 예정 합계</div>
            <div className="num text-base font-extrabold">{won(monthTotal)}원</div>
          </div>
          <div className="flex-1 rounded-[14px] bg-surface px-3.5 py-[13px] shadow-card">
            <div className="mb-1.5 text-[11px] font-semibold text-sub">카드 실적 반영분</div>
            <div className="num text-base font-extrabold text-samsung">{won(perfTotal)}원</div>
          </div>
        </div>

        {variable.map((r) => (
          <div key={r.id} className="mb-3.5 flex items-center gap-2.5 rounded-[13px] border border-[#F3D6C7] bg-warn-bg px-[13px] py-[11px]">
            <span className="text-[15px]">⏳</span>
            <span className="flex-1 text-[12px] font-medium leading-snug"><b className="font-bold text-warn">{r.name}</b> 결제일 도래 — 금액이 매달 달라요</span>
            <span className="rounded-[9px] bg-warn px-3 py-1.5 text-[11.5px] font-bold text-white">확인</span>
          </div>
        ))}

        <div className="mb-[9px] mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">등록된 자동이체</div>
        {active.map((r) => {
          const acc = accMap.get(r.accountId);
          const isCard = acc?.type === 'card';
          const tracked = acc?.card?.trackPerformance;
          const excluded = acc ? isExcludedForCard(acc, r.categoryId, catMap) : false;
          const reflects = isCard && tracked && !excluded && r.type === 'expense' && r.amount >= (acc?.card?.minPerTxn ?? 0);
          return (
            <div key={r.id} className="mb-2 flex items-center gap-[11px] rounded-[13px] bg-surface px-[13px] py-[11px] shadow-card">
              <div className="flex h-[38px] w-[38px] flex-none flex-col items-center justify-center rounded-[10px] bg-line2 leading-none">
                <div className="num text-sm font-extrabold">{r.dayOfMonth}</div>
                <div className="mt-px text-[8.5px] font-bold text-sub">매월</div>
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
        <AddButton>＋ 자동이체 추가</AddButton>
      </div>
    </>
  );
}
