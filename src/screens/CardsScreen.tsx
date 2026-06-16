import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { AppHead, AddButton, Chip } from '../ui/components';
import { won } from '../ui/format';
import type { Account } from '../db/types';

export function CardsScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const benefits = useAppStore((s) => s.benefits);
  const saveAccount = useAppStore((s) => s.saveAccount);
  const reorderAccounts = useAppStore((s) => s.reorderAccounts);
  const navigate = useAppStore((s) => s.navigate);
  const data = useMonthlyData();

  const [tab, setTab] = useState<'tracked' | 'payment'>('tracked');
  const cards = accounts.filter((a) => a.type === 'card').sort(cardSort);
  const tracked = cards.filter((c) => c.card?.trackPerformance);
  const payment = cards.filter((c) => !c.card?.trackPerformance);
  const list = tab === 'tracked' ? tracked : payment;
  const moveCard = async (id: string, delta: -1 | 1) => {
    const next = moveItem(list, id, delta);
    if (next !== list) await reorderAccounts(next);
  };

  return (
    <>
      <AppHead title="카드 · 혜택" right={<span className="num text-[13px] font-semibold text-sub">보유 {cards.length}</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-4 flex items-center gap-[11px] rounded-[13px] bg-surface px-3.5 py-3 shadow-card">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#FBEED9] text-base">🎁</span>
          <div className="flex-1">
            <div className="num text-[13.5px] font-bold">{data.selectedMonth.month}월 카드 혜택 <b style={{ color: '#B5852A' }}>{won(data.benefits.total.discount + data.benefits.total.point)}원</b></div>
            <div className="num mt-0.5 text-[10.5px] font-semibold text-faint">할인 {won(data.benefits.total.discount)} · 적립 {won(data.benefits.total.point)}</div>
          </div>
        </div>

        <div className="mb-3.5 flex gap-1.5">
          <Seg on={tab === 'tracked'} onClick={() => setTab('tracked')}>실적 추적 ({tracked.length})</Seg>
          <Seg on={tab === 'payment'} onClick={() => setTab('payment')}>결제수단만 ({payment.length})</Seg>
        </div>

        {list.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            benefitTotal={data.benefits.byCard.get(card.id) ?? 0}
            met={data.metCardIds.has(card.id)}
            hasBenefits={benefits.some((b) => b.accountId === card.id)}
            canMoveUp={list[0]?.id !== card.id}
            canMoveDown={list[list.length - 1]?.id !== card.id}
            onMoveUp={() => moveCard(card.id, -1)}
            onMoveDown={() => moveCard(card.id, 1)}
            onTogglePin={() => saveAccount({ ...card, isPinned: !card.isPinned })}
            onClick={() => navigate('cardedit', { accountId: card.id })}
          />
        ))}
        <AddButton onClick={() => navigate('cardedit', {})}>＋ 카드 추가</AddButton>
      </div>
    </>
  );
}

function CardItem({
  card,
  benefitTotal,
  met,
  hasBenefits,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onTogglePin,
  onClick,
}: {
  card: Account;
  benefitTotal: number;
  met: boolean;
  hasBenefits: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTogglePin: () => void;
  onClick: () => void;
}) {
  const c = card.card;
  return (
    <div className="mb-[11px] rounded-2xl bg-surface p-[15px] shadow-card" style={{ opacity: c?.trackPerformance ? 1 : 0.72 }}>
      <div className="mb-3 flex items-center gap-2.5">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Chip color={card.color} imageSrc={card.iconImage} size={28}>{card.icon}</Chip>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-bold">{card.name} {card.isPinned && <span className="text-[10px] text-faint">📌</span>}</div>
            <div className="mt-px text-[11px] font-semibold text-sub">
              {c?.trackPerformance ? `목표 ${Math.round((c.targetAmount ?? 0) / 10000)}만 · ${c.cycleType === 'prev_month' ? '전월' : '당월'}기준` : '결제수단으로만 사용'}
            </div>
          </div>
        </button>
        <button type="button" aria-label={`${card.name} 핀`} onClick={onTogglePin} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${card.isPinned ? 'bg-good-bg text-good' : 'bg-line2 text-faint'}`}>
          📌
        </button>
        <div className="flex flex-col gap-1 text-[11px] font-bold text-faint">
          <button aria-label={`${card.name} 위로`} disabled={!canMoveUp} onClick={onMoveUp} className="rounded-md bg-line2 px-2 py-0.5 disabled:opacity-25">↑</button>
          <button aria-label={`${card.name} 아래로`} disabled={!canMoveDown} onClick={onMoveDown} className="rounded-md bg-line2 px-2 py-0.5 disabled:opacity-25">↓</button>
        </div>
        <button type="button" onClick={onClick} className="text-base text-faint">›</button>
      </div>
      {c?.trackPerformance && hasBenefits && (
        <div className="mb-2 flex justify-end">
          <span className={`num text-[13px] font-extrabold ${met || benefitTotal > 0 ? 'text-good' : 'text-warn'}`}>{benefitTotal > 0 ? `+${won(benefitTotal)}원` : met ? '+0원' : '실적 미충족'}</span>
        </div>
      )}
      {c?.trackPerformance && (
        <div className="flex flex-wrap gap-[7px]">
          <Pill>최소 <b>{c.minPerTxn ? `${won(c.minPerTxn)}/건` : '제한 없음'}</b></Pill>
          {c.settlementDay && <Pill>결제 <b>매월 {c.settlementDay}일</b></Pill>}
        </div>
      )}
    </div>
  );
}

function cardSort(a: Account, b: Account): number {
  return Number(b.isPinned) - Number(a.isPinned) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko');
}

function moveItem<T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg bg-line2 px-[9px] py-[5px] text-[11px] font-semibold text-sub [&_b]:text-ink">{children}</span>;
}
function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex-none rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-sub'}`}>{children}</button>;
}
