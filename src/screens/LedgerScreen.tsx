import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAccountMap, useCategoryMap } from '../store/lookups';
import { inMonth } from '../logic/period';
import { AppHead, MonthNav } from '../ui/components';
import { formatDayHead, won } from '../ui/format';
import type { Transaction, TxnType } from '../db/types';

const TYPE_FILTERS: { value: 'all' | TxnType; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'expense', label: '지출' },
  { value: 'income', label: '수입' },
  { value: 'transfer', label: '이체' },
];

export function LedgerScreen() {
  const transactions = useAppStore((s) => s.transactions);
  const accounts = useAppStore((s) => s.accounts);
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const navigate = useAppStore((s) => s.navigate);
  const accMap = useAccountMap();
  const catMap = useCategoryMap();

  const [query, setQuery] = useState('');
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TxnType>('all');

  const cards = accounts.filter((a) => a.type === 'card');

  const monthTxns = useMemo(
    () => transactions.filter((t) => inMonth(t.date, selectedMonth)),
    [transactions, selectedMonth],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTxns
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (cardFilter !== 'all' && t.accountId !== cardFilter && t.toAccountId !== cardFilter) return false;
        if (q) {
          const acc = accMap.get(t.accountId);
          const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
          const hay = `${t.merchant ?? ''} ${t.memo ?? ''} ${acc?.name ?? ''} ${cat?.name ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [monthTxns, query, cardFilter, typeFilter, accMap, catMap]);

  const expense = monthTxns.filter((t) => t.type === 'expense' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0);
  const income = monthTxns.filter((t) => t.type === 'income' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0);
  const pendingCount = monthTxns.filter((t) => t.status === 'pending').length;

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <>
      <AppHead title="내역" right={<span className="rounded-lg bg-line2 px-[11px] py-1.5 text-[12px] font-bold text-sub" onClick={() => navigate('import')}>📥 가져오기</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3 flex justify-center"><MonthNav /></div>

        <div className="mb-3 flex gap-3.5 rounded-[13px] bg-surface px-3.5 py-3 text-[12px] font-semibold shadow-card">
          <span className="text-sub">지출 <b className="num text-ink">{won(expense)}</b></span>
          <span className="text-sub">수입 <b className="num text-good">{won(income)}</b></span>
          <span className="text-sub">건수 <b>{monthTxns.length}</b></span>
        </div>

        <div className="mb-[11px] flex items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-surface px-3.5 py-2.5">
          <span className="text-sm text-faint">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="거래처 · 카드 · 메모 검색"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
          />
          {query && <span className="text-base font-bold text-faint" onClick={() => setQuery('')}>✕</span>}
        </div>

        <Seg
          options={[{ value: 'all', label: '전체 카드' }, ...cards.map((c) => ({ value: c.id, label: c.name.split(' ')[0] }))]}
          value={cardFilter}
          onChange={setCardFilter}
        />
        <Seg options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />

        {pendingCount > 0 && (
          <div className="mb-3.5 flex items-center gap-2.5 rounded-[13px] border border-[#F3D6C7] bg-warn-bg px-[13px] py-[11px]">
            <span className="text-[15px]">⏳</span>
            <span className="flex-1 text-[12px] font-medium leading-snug">변동 자동이체 <b className="font-bold text-warn">{pendingCount}건</b> 금액 확인 필요 · pending</span>
          </div>
        )}

        {groups.length === 0 && <div className="py-9 text-center text-[13px] font-semibold text-faint">내역이 없어요</div>}

        {groups.map(([date, items]) => {
          const daySum = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
          return (
            <div key={date} className="mb-1.5">
              <div className="flex justify-between px-0.5 pb-[7px] pt-3.5 text-[12px] font-bold text-sub">
                <span>{formatDayHead(date)}</span>
                <span className={`num ${daySum >= 0 ? 'text-good' : 'text-ink'}`}>{daySum >= 0 ? '+' : '−'}{won(Math.abs(daySum))}</span>
              </div>
              {items.map((t) => {
                const acc = accMap.get(t.accountId);
                const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
                const counts = t.type === 'expense' && (t.countsForPerformance ?? acc?.card?.trackPerformance);
                return (
                  <div key={t.id} className="mb-[7px] flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3 shadow-card" onClick={() => navigate('edit', { txnId: t.id })}>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-line2 text-base">{cat?.icon ?? (t.type === 'income' ? '💰' : t.type === 'transfer' ? '🔄' : '💸')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold">{t.merchant || cat?.name || (t.type === 'transfer' ? '이체' : '거래')}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-sub">
                        <span className="inline-block h-[7px] w-[7px] flex-none rounded-[3px]" style={{ background: acc?.color ?? 'var(--faint)' }} />
                        {acc?.name}{cat ? ` · ${cat.name}` : ''}
                        {counts && <span className="rounded-[5px] bg-good-bg px-[5px] py-px text-[9px] font-bold text-good">실적</span>}
                        {t.status === 'pending' && <span className="rounded-[5px] bg-warn-bg px-[5px] py-px text-[9px] font-bold text-warn">pending</span>}
                      </div>
                    </div>
                    <span className={`num flex-none text-[14.5px] font-extrabold ${t.type === 'income' ? 'text-good' : ''}`}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{won(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function groupByDay(txns: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const arr = map.get(t.date) ?? [];
    arr.push(t);
    map.set(t.date, arr);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-3.5 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`flex-none rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-semibold ${value === o.value ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-sub'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
