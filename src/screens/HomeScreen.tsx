import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { useAccountMap } from '../store/lookups';
import { topMerchants } from '../logic/merchants';
import type { CardForecast } from '../logic/forecast';
import { AppHead, Chip, GroupLabel, Meter, MonthNav } from '../ui/components';
import { manWon, pct, won } from '../ui/format';
import type { Account } from '../db/types';

export function HomeScreen() {
  const data = useMonthlyData();
  const accounts = useAppStore((s) => s.accounts);
  const navigate = useAppStore((s) => s.navigate);
  const accMap = useAccountMap();

  const tracked = accounts.filter((a) => a.card?.trackPerformance);
  const untracked = accounts.filter((a) => a.type === 'card' && !a.card?.trackPerformance);

  const action = data.performances.filter((p) => p.status === 'behind' || p.status === 'short');
  const progress = data.performances.filter((p) => p.status === 'ontrack' || p.status === 'upcoming');
  const achieved = data.performances.filter((p) => p.status === 'achieved');

  return (
    <>
      <AppHead title="실적가계부" right={<MonthNav />} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        {/* 통합 요약 카드 */}
        <div className="mb-4 rounded-2xl bg-surface px-4 py-3.5 shadow-card">
          <div className="flex items-center justify-between" onClick={() => navigate('stats')}>
            <div>
              <div className="mb-[3px] text-[11px] font-semibold text-sub">{data.selectedMonth.month}월 지출</div>
              <div className="num text-2xl font-extrabold tracking-[-0.02em]">{won(data.totalExpense)}원</div>
            </div>
            <span className="text-[17px] text-faint">›</span>
          </div>
          <div className="mt-[11px] flex gap-3.5 border-t border-line2 pt-[11px] text-[11.5px] font-semibold text-sub">
            <span className="inline-flex gap-1.5" onClick={() => navigate('stats')}>
              수입 <b className="num font-extrabold text-good">+{manWon(data.totalIncome)}</b>
            </span>
            <span className="inline-flex gap-1.5" onClick={() => navigate('assets')}>
              순자산 <b className="num font-extrabold text-ink">{manWon(data.netWorth.net)}</b>
            </span>
            <span className="inline-flex gap-1.5" onClick={() => navigate('cards')}>
              절약 <b className="num font-extrabold" style={{ color: '#B5852A' }}>{manWon(data.benefits.total.discount + data.benefits.total.point)}</b>
            </span>
          </div>
        </div>

        {/* 실적 섹션 헤더 */}
        <div className="mx-0.5 mb-3.5 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">카드 실적</span>
          <span className="text-[11px] font-semibold text-sub">
            <span className="text-warn">●</span> 액션 <b className="font-extrabold text-ink">{action.length}</b> · 진행{' '}
            <b className="font-extrabold text-ink">{progress.length}</b> · 달성{' '}
            <b className="font-extrabold text-ink">{achieved.length}</b> · 추적 {tracked.length}/{accounts.filter((a) => a.type === 'card').length}
          </span>
        </div>

        {action.length > 0 && <GroupLabel warn count={action.length}>⚠ 액션 필요</GroupLabel>}
        {action.map((p) => <PerfCard key={p.cardId} p={p} card={accMap.get(p.cardId)!} />)}

        {progress.length > 0 && <GroupLabel count={progress.length}>📌 진행 중</GroupLabel>}
        {progress.map((p) => <PerfCard key={p.cardId} p={p} card={accMap.get(p.cardId)!} />)}

        {achieved.length > 0 && <GroupLabel count={achieved.length}>✓ 달성</GroupLabel>}
        {achieved.map((p) => <AchievedRow key={p.cardId} p={p} card={accMap.get(p.cardId)!} />)}

        {untracked.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2.5 rounded-[13px] bg-line2 px-[15px] py-[13px]">
            <span className="text-base">💳</span>
            <span className="text-[12px] font-semibold leading-snug text-sub">
              실적 추적을 끈 카드 <b className="text-ink">{untracked.length}개</b>는 결제수단으로만 사용돼요.
            </span>
          </div>
        )}

        {/* 이번 달 지출 요약 */}
        <div className="mx-0.5 mb-3.5 mt-[22px] flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-faint">이번 달 지출</span>
          <span className="text-[12px] font-semibold text-faint" onClick={() => navigate('ledger')}>전체 보기 ›</span>
        </div>
        <ExpenseSummary breakdown={data.breakdown} />
      </div>
    </>
  );
}

function PerfCard({ p, card }: { p: CardForecast; card: Account }) {
  const navigate = useAppStore((s) => s.navigate);
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const benefits = useAppStore((s) => s.benefits);
  const top = useMemo(
    () => topMerchants(card, transactions, categories, p.benefitMonth, benefits, 3),
    [card, transactions, categories, benefits, p.benefitMonth],
  );
  const behind = p.status === 'behind' || p.status === 'short';
  const tagText = p.status === 'behind' || p.status === 'short' ? '뒤처짐' : card.isPinned ? '📌 집중' : '진행';

  return (
    <div className="mb-[9px] rounded-[14px] bg-surface px-3.5 py-[13px] shadow-card" onClick={() => navigate('cardedit', { accountId: card.id })}>
      <div className="mb-[9px] flex items-center gap-2.5">
        <Chip color={card.color} size={28}>{card.icon}</Chip>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold">{card.name}</div>
          <div className="mt-px text-[10.5px] font-semibold text-sub">
            {card.card?.cycleType === 'prev_month' ? '전월' : '당월'} · {p.benefitMonth.month}월 혜택용
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="num text-base font-extrabold leading-none">{pct(p.ratio)}</div>
          <div className={`mt-[3px] inline-block rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold ${behind ? 'bg-warn-bg text-warn' : 'bg-line2 text-sub'}`}>{tagText}</div>
        </div>
      </div>
      <Meter fillPct={p.ratio} plannedPct={p.projected / (p.target || 1)} pacePct={p.pacePct} color={card.color} />
      <div className={`mt-1.5 text-[11px] font-semibold ${behind ? 'text-warn' : 'text-sub'}`}>
        {p.shortfall > 0 ? (
          <><b className="num font-bold">{won(p.shortfall)}</b> 부족</>
        ) : (
          <><b className="num font-bold">{won(p.achieved - p.target)}</b> 초과</>
        )}
        {p.projected > 0 && p.shortfall > 0 && <> · 자동이체 포함 {manWon(p.forecast)} 전망</>}
      </div>
      {top.length > 0 && (
        <div className="mt-[9px] border-t border-line2 pt-[9px] text-[11.5px] font-semibold text-ink">
          <span className="mr-[7px] text-[9.5px] font-bold uppercase tracking-[0.05em] text-faint">실적 채우기</span>
          {top.map((m, i) => (
            <span key={m.merchant}>{i > 0 && ' · '}{m.isBenefit && '🎁'}{m.merchant}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function AchievedRow({ p, card }: { p: CardForecast; card: Account }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <div className="relative mb-2 flex items-center gap-3 rounded-[13px] bg-surface px-3.5 py-3 shadow-card" onClick={() => navigate('cardedit', { accountId: card.id })}>
      <span className="absolute left-0 top-[9px] bottom-[9px] w-[3px] rounded-r bg-good" />
      <Chip color={card.color} size={28}>{card.icon}</Chip>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{card.name}</div>
        <div className="my-1.5 h-[5px] overflow-hidden rounded-md bg-line2"><i className="block h-full rounded-md bg-good" style={{ width: '100%' }} /></div>
        <div className="text-[11px] font-semibold text-sub"><b className="text-good">혜택 확정</b> · {won(p.achieved - p.target)} 초과</div>
      </div>
      <div className="flex-none text-right">
        <div className="num text-[17px] font-extrabold text-good">{pct(p.ratio)}</div>
        <div className="mt-px text-[11px] text-faint">›</div>
      </div>
    </div>
  );
}

function ExpenseSummary({ breakdown }: { breakdown: ReturnType<typeof useMonthlyData>['breakdown'] }) {
  const categories = useAppStore((s) => s.categories);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const top = breakdown.slice(0, 3);
  const max = top[0]?.amount ?? 1;
  if (top.length === 0) return <div className="rounded-2xl bg-surface px-4 py-6 text-center text-[13px] text-faint shadow-card">지출 내역이 없어요</div>;
  return (
    <div className="rounded-2xl bg-surface px-4 pb-1.5 pt-4 shadow-card">
      {top.map((slice) => {
        const c = catMap.get(slice.categoryId);
        return (
          <div key={slice.categoryId} className="flex items-center gap-[11px] border-t border-line2 py-[9px] first:border-t-0">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-line2 text-sm">{c?.icon ?? '⋯'}</span>
            <span className="w-[62px] text-[13px] font-semibold">{c?.name ?? '기타'}</span>
            <span className="h-[5px] flex-1 overflow-hidden rounded-md bg-line2"><i className="block h-full rounded-md bg-ink opacity-65" style={{ width: `${(slice.amount / max) * 100}%` }} /></span>
            <span className="num min-w-[58px] text-right text-[12px] font-bold">{won(slice.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}
