import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { accountBalance } from '../logic/balance';
import { AppHead, AddButton, Chip, MonthNav } from '../ui/components';
import { Modal, Labeled, TextInput, NumberField, PrimaryButton, ChoiceRow } from '../ui/Modal';
import { won } from '../ui/format';
import type { Account, AccountType } from '../db/types';

const TYPE_LABEL: Record<string, string> = { bank: '입출금', savings: '예적금', investment: '투자', cash: '현금', card: '카드', realestate: '부동산', loan: '대출', other: '기타' };
const ASSET_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank', label: '입출금' }, { value: 'savings', label: '예적금' }, { value: 'investment', label: '투자' }, { value: 'cash', label: '현금' }, { value: 'realestate', label: '부동산' }, { value: 'other', label: '기타' },
];

export function AssetsScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const transactions = useAppStore((s) => s.transactions);
  const saveAccount = useAppStore((s) => s.saveAccount);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const navigate = useAppStore((s) => s.navigate);
  const data = useMonthlyData();
  const [editing, setEditing] = useState<Account | null>(null);

  const assets = accounts.filter((a) => a.kind === 'asset' && a.isActive);
  const liabilities = accounts.filter((a) => a.kind === 'liability' && a.isActive);

  const open = (a: Account) => (a.type === 'card' ? navigate('cardedit', { accountId: a.id }) : setEditing(a));

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
        {assets.map((a) => <Row key={a.id} a={a} amount={accountBalance(a, transactions)} onClick={() => open(a)} />)}
        <div className="mt-1"><AddButton onClick={() => setEditing(blank())}>＋ 계좌 추가</AddButton></div>

        {liabilities.length > 0 && <div className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-faint">부채 · 카드대금</div>}
        {liabilities.map((a) => <Row key={a.id} a={a} amount={accountBalance(a, transactions)} onClick={() => open(a)} />)}
      </div>

      {editing && <AccountForm account={editing} onClose={() => setEditing(null)} onSave={async (a) => { await saveAccount(a); setEditing(null); }} onDelete={async (id) => { await deleteAccount(id); setEditing(null); }} />}
    </>
  );
}

function blank(): Account {
  return { id: nanoid(), name: '', kind: 'asset', type: 'bank', balanceMode: 'calculated', openingBalance: 0, isPinned: false, isActive: true, sortOrder: 0, color: '#3A7D44', icon: '계', createdAt: Date.now() };
}

function Row({ a, amount, onClick }: { a: Account; amount: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 flex w-full items-center gap-3 rounded-[13px] bg-surface px-[15px] py-[13px] text-left shadow-card">
      <Chip color={a.color} imageSrc={a.iconImage} size={32}>{a.icon ?? '·'}</Chip>
      <div>
        <div className="text-[13.5px] font-semibold">{a.name}</div>
        <div className="mt-px text-[11px] font-semibold text-faint">{TYPE_LABEL[a.type] ?? a.type}{a.balanceMode === 'manual' && <span className="ml-1.5 rounded-[5px] border border-line px-1.5 py-px text-[9px] font-bold">수동</span>}</div>
      </div>
      <span className={`num ml-auto text-[14.5px] font-bold ${amount < 0 ? 'text-warn' : ''}`}>{amount < 0 ? '−' : ''}{won(Math.abs(amount))}원</span>
    </button>
  );
}

function AccountForm({ account, onClose, onSave, onDelete }: { account: Account; onClose: () => void; onSave: (a: Account) => void; onDelete: (id: string) => void }) {
  const [d, setD] = useState<Account>(account);
  const isNew = !useAppStore.getState().accounts.some((x) => x.id === account.id);

  return (
    <Modal title={isNew ? '계좌 추가' : '계좌 편집'} onClose={onClose}>
      <div className="flex gap-2.5">
        <Labeled label="아이콘"><TextInput value={d.icon ?? ''} onChange={(e) => setD({ ...d, icon: e.target.value })} style={{ width: 64, textAlign: 'center' }} /></Labeled>
        <div className="flex-1"><Labeled label="이름"><TextInput value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="계좌 이름" /></Labeled></div>
      </div>
      <Labeled label="종류"><ChoiceRow options={ASSET_TYPES} value={d.type} onChange={(v) => setD({ ...d, type: v })} /></Labeled>
      <Labeled label="잔액 방식"><ChoiceRow options={[{ value: 'calculated', label: '거래로 계산' }, { value: 'manual', label: '수동 입력' }]} value={d.balanceMode} onChange={(v) => setD({ ...d, balanceMode: v })} /></Labeled>
      {d.balanceMode === 'calculated' ? (
        <BalanceLabeled label="시작 잔액 (원)" value={d.openingBalance} onChange={(n) => setD({ ...d, openingBalance: n })} />
      ) : (
        <BalanceLabeled label="현재 잔액 (원)" value={d.manualBalance ?? 0} onChange={(n) => setD({ ...d, manualBalance: n })} />
      )}
      <div className="flex gap-2.5">
        <Labeled label="색상"><input type="color" value={d.color ?? '#3A7D44'} onChange={(e) => setD({ ...d, color: e.target.value })} className="h-11 w-16 rounded-[10px] border-[1.5px] border-line bg-surface" /></Labeled>
      </div>
      <PrimaryButton onClick={() => d.name.trim() && onSave(d)}>저장</PrimaryButton>
      {!isNew && <button onClick={() => onDelete(d.id)} className="mt-2 w-full rounded-[13px] bg-warn-bg py-3 text-center text-[13px] font-bold text-warn">삭제</button>}
    </Modal>
  );
}

function BalanceLabeled({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">{label}</div>
      <BalanceField label={label} value={value} onChange={onChange} />
    </div>
  );
}

function BalanceField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-label="잔액 부호 전환"
        onClick={() => value !== 0 && onChange(-value)}
        className={`h-11 w-12 rounded-[10px] border-[1.5px] text-[18px] font-extrabold ${
          value < 0 ? 'border-warn bg-warn-bg text-warn' : 'border-line bg-surface text-sub'
        }`}
      >
        {value < 0 ? '−' : '+'}
      </button>
      <NumberField
        allowNegative
        ariaLabel={label}
        value={value}
        onChange={onChange}
        className="num h-11 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-right text-[14px] font-bold outline-none focus:border-ink"
      />
    </div>
  );
}
