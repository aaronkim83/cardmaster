import { useMonthlyData } from '../store/useMonthlyData';
import { useCategoryMap } from '../store/lookups';
import { useAppStore } from '../store/useAppStore';
import { AppHead, MonthNav } from '../ui/components';
import { won, pct } from '../ui/format';

export function StatsScreen() {
  const data = useMonthlyData();
  const catMap = useCategoryMap();
  const navigate = useAppStore((s) => s.navigate);

  const budgetName = (id: string | null) => (id === null ? '전체 예산' : `${catMap.get(id)?.icon ?? ''} ${catMap.get(id)?.name ?? '예산'}`);
  const maxCat = data.breakdown[0]?.amount ?? 1;
  const trendMax = Math.max(...data.trend.map((t) => t.total), 1);

  return (
    <>
      <AppHead title="통계" right={<MonthNav />} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 flex gap-2.5">
          <Box label="이번 달 지출" value={won(data.totalExpense)} sub={data.mom.pct !== null ? `${data.mom.pct <= 0 ? '▼' : '▲'} 전월 ${pct(Math.abs(data.mom.pct))}` : '—'} subColor={data.mom.delta <= 0 ? 'var(--good)' : 'var(--warn)'} />
          <Box label="일 평균" value={won(data.dailyAvg.average)} sub={`${data.dailyAvg.days}일 기준`} />
        </div>

        <Card
          title="예산"
          right={<button onClick={() => navigate('budget', {}, { preserveHistory: true })} className="text-[12px] font-bold text-sub">설정 ›</button>}
        >
          {data.budgets.length === 0 && (
            <button onClick={() => navigate('budget', {}, { preserveHistory: true })} className="w-full py-2 text-center text-[13px] font-semibold text-faint">
              예산을 등록해 월 지출을 관리하세요.
            </button>
          )}
          {data.budgets.map((b) => (
            <div key={b.budgetId} className="mb-3.5 last:mb-0">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-bold">{budgetName(b.categoryId)}</span>
                <span className="num text-[11.5px] font-semibold text-sub">
                  {won(b.spent)} / {won(b.amount)}{' '}
                  <span className={`text-[10px] font-bold ${b.status === 'over' ? 'text-warn' : b.status === 'near' ? 'text-[#B5852A]' : 'text-sub'}`}>{pct(b.ratio)}{b.status === 'over' ? ' 초과' : ''}</span>
                </span>
              </div>
              <div className="h-[9px] overflow-hidden rounded-md bg-line2">
                <i className={`block h-full rounded-md ${b.status === 'over' ? 'bg-warn' : b.status === 'near' ? 'bg-[#D9A52A]' : 'bg-ink'}`} style={{ width: `${Math.min(b.ratio, 1) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>

        <Card title="카테고리별 지출">
          {data.breakdown.length === 0 && <div className="py-2 text-center text-[13px] text-faint">내역 없음</div>}
          {data.breakdown.map((slice) => {
            const c = catMap.get(slice.categoryId);
            return (
              <div key={slice.categoryId} className="flex items-center gap-2.5 py-2">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-line2 text-[13px]">{c?.icon ?? '⋯'}</span>
                <span className="w-[62px] text-[12.5px] font-semibold">{c?.name ?? '기타'}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-md bg-line2"><i className="block h-full rounded-md" style={{ width: `${(slice.amount / maxCat) * 100}%`, background: c?.color ?? 'var(--sub)' }} /></span>
                <span className="num min-w-[54px] text-right text-[12px] font-bold">{won(slice.amount)}</span>
                <span className="w-[30px] text-right text-[10.5px] font-semibold text-faint">{pct(slice.pct)}</span>
              </div>
            );
          })}
        </Card>

        <Card title="월별 지출 추이">
          <div className="flex h-24 items-end gap-[7px]">
            {data.trend.map((t, i) => {
              const cur = i === data.trend.length - 1;
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div className={`w-[70%] rounded-t ${cur ? 'bg-ink' : 'bg-line2'}`} style={{ height: `${Math.max((t.total / trendMax) * 100, 2)}%` }} />
                  <div className="text-[9.5px] font-semibold text-faint">{t.month.month}월</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function Box({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div className="flex-1 rounded-[14px] bg-surface px-3.5 py-[13px] shadow-card">
      <div className="mb-1.5 text-[11px] font-semibold text-sub">{label}</div>
      <div className="num text-[17px] font-extrabold">{value}</div>
      <div className="num mt-[3px] text-[10.5px] font-semibold" style={{ color: subColor ?? 'var(--faint)' }}>{sub}</div>
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 rounded-2xl bg-surface p-[17px] shadow-card">
      <div className="mb-[15px] flex justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-sub">
        <span>{title}</span>
        {right && <span className="normal-case tracking-normal">{right}</span>}
      </div>
      {children}
    </div>
  );
}
