import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { accountBalance } from '../logic/balance';
import { AppHead, MonthNav } from '../ui/components';
import { won } from '../ui/format';

export function AssetsScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const transactions = useAppStore((s) => s.transactions);
  const data = useMonthlyData();

  const assets = accounts.filter((a) => a.kind === 'asset' && a.isActive);
  const liabilities = accounts.filter((a) => a.kind === 'liability' && a.isActive);

  return (
    <>
      <AppHead title="자산" right={<MonthNav />} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 overflow-hidden rounded-2xl bg-ink p-5 text-white">
          <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/50">순자산 · 총자산 − 총부채</div>
          <div className="num my-2 text-[33px] font-extrabold">{won(data.netWorth.net)}<span className="text-[17px] font-bold">원</span></div>
          <div className="num text-[12px] font-semibold text-[#7BD3A0]">자산 {won(data.netWorth.assets)} · 부채 {won(data.netWorth.liabilities)}</div>
        </div>

        <div className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-faint">자산</div>
        {assets.map((a) => (
          <Row key={a.id} color={a.color} icon={a.icon} name={a.name} type={a.type} manual={a.balanceMode === 'manual'} amount={accountBalance(a, transactions)} />
        ))}

        {liabilities.length > 0 && <div className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-faint">부채 · 카드대금</div>}
        {liabilities.map((a) => (
          <Row key={a.id} color={a.color} icon={a.icon} name={a.name} type={a.type} amount={accountBalance(a, transactions)} />
        ))}
      </div>
    </>
  );
}

function Row({ color, icon, name, type, amount, manual }: { color?: string; icon?: string; name: string; type: string; amount: number; manual?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-[13px] bg-surface px-[15px] py-[13px] shadow-card">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[13px] font-extrabold text-white" style={{ background: color ?? 'var(--sub)' }}>{icon ?? '·'}</span>
      <div>
        <div className="text-[13.5px] font-semibold">{name}</div>
        <div className="mt-px text-[11px] font-semibold text-faint">{TYPE_LABEL[type] ?? type}{manual && <span className="ml-1.5 rounded-[5px] border border-line px-1.5 py-px text-[9px] font-bold">수동</span>}</div>
      </div>
      <span className={`num ml-auto text-[14.5px] font-bold ${amount < 0 ? 'text-warn' : ''}`}>{amount < 0 ? '−' : ''}{won(Math.abs(amount))}원</span>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  bank: '입출금', savings: '예적금', investment: '투자', cash: '현금', card: '카드', realestate: '부동산', loan: '대출', other: '기타',
};
