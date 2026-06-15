import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { isCategoryExcluded, buildCategoryMap } from '../logic/category';
import { won } from '../ui/format';
import type { TxnType } from '../db/types';
import dayjs from 'dayjs';

const TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense', label: '지출' },
  { value: 'income', label: '수입' },
  { value: 'transfer', label: '이체' },
];

export function InputScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const navigate = useAppStore((s) => s.navigate);

  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [mainCatId, setMainCatId] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [incomeCatId, setIncomeCatId] = useState('');
  const [perfOverride, setPerfOverride] = useState<boolean | null>(null);
  const [merchant, setMerchant] = useState('');
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showAllMainCats, setShowAllMainCats] = useState(false);

  const catMap = useMemo(() => buildCategoryMap(categories), [categories]);
  const mains = categories.filter((c) => c.type === 'expense' && c.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const subs = categories.filter((c) => c.parentId === mainCatId).sort((a, b) => a.sortOrder - b.sortOrder);
  const incomeCats = categories.filter((c) => c.type === 'income').sort((a, b) => a.sortOrder - b.sortOrder);

  const paymentAccounts = accounts.filter((a) => a.type === 'card' || a.type === 'cash' || a.type === 'bank');
  const depositAccounts = accounts.filter((a) => a.kind === 'asset');
  const incomeMode = type === 'income';
  const fromAccounts = incomeMode ? depositAccounts : paymentAccounts;
  const activeAccountId = fromAccounts.some((a) => a.id === accountId) ? accountId : fromAccounts[0]?.id;
  const visibleFromAccounts = showAllAccounts ? fromAccounts : fromAccounts.slice(0, 4);
  const visibleMains = showAllMainCats ? mains : mains.slice(0, 8);

  const effectiveCatId = type === 'income' ? incomeCatId : subCatId || mainCatId;
  const autoExcluded = type === 'expense' && isCategoryExcluded(effectiveCatId, catMap);
  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const autoCounts = type === 'expense' && !!selectedAccount?.card?.trackPerformance && !autoExcluded;
  const perfOn = perfOverride ?? autoCounts;

  function key(k: string) {
    if (k === '⌫') setAmount((a) => Math.floor(a / 10));
    else if (k === '00') setAmount((a) => Math.min(a * 100, 99999999));
    else setAmount((a) => Math.min(a * 10 + Number(k), 99999999));
  }

  async function save() {
    if (amount <= 0) return;
    const acc = activeAccountId;
    if (!acc) return;
    await addTransaction({
      date,
      type,
      amount,
      accountId: acc,
      toAccountId: type === 'transfer' ? toAccountId || depositAccounts[0]?.id : undefined,
      categoryId: type === 'transfer' ? undefined : effectiveCatId || undefined,
      merchant: merchant || undefined,
      countsForPerformance: type === 'expense' ? perfOverride : null,
      source: 'manual',
      status: 'confirmed',
    });
    navigate('ledger');
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between px-[18px] pb-1.5 pt-2">
        <h1 className="text-[21px] font-extrabold tracking-[-0.03em]">{incomeMode ? '수입 입력' : type === 'transfer' ? '이체' : '지출 입력'}</h1>
        <span className="rounded-lg bg-line2 px-[11px] py-1.5 text-[12px] font-bold text-sub" onClick={() => navigate('import')}>📄 엑셀·붙여넣기</span>
      </div>

      <div className="mx-[18px] flex rounded-xl bg-line2 p-[3px]">
        {TYPES.map((t) => (
          <button key={t.value} onClick={() => { setType(t.value); setPerfOverride(null); setShowAllAccounts(false); }} className={`flex-1 rounded-[9px] py-2 text-center text-[13px] font-bold ${type === t.value ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex-none px-5 pb-1.5 pt-2 text-center">
        <div className="mb-[5px] text-[11.5px] font-semibold text-sub">금액</div>
        <div className={`num text-[30px] font-extrabold tracking-[-0.03em] ${incomeMode ? 'text-good' : ''}`}>{won(amount)}<span className="text-faint">원</span></div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 [&::-webkit-scrollbar]:hidden">
        <Group label="날짜">
          <Opts>
            {[0, 1].map((d) => {
              const dt = dayjs().subtract(d, 'day').format('YYYY-MM-DD');
              return <Opt key={d} sel={date === dt} onClick={() => setDate(dt)}>{d === 0 ? '오늘' : '어제'} {dayjs(dt).format('M/D')}</Opt>;
            })}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-[10px] border-[1.5px] border-dashed border-line bg-surface px-2.5 py-2 text-[12.5px] font-semibold text-sub" />
          </Opts>
        </Group>

        <Group label={type === 'transfer' ? '출금 계좌' : incomeMode ? '입금 계좌' : '결제수단'}>
          <Opts scroll={showAllAccounts && fromAccounts.length > 4}>
            {visibleFromAccounts.map((a) => (
              <Opt key={a.id} sel={activeAccountId === a.id} onClick={() => setAccountId(a.id)}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-middle" style={{ background: a.color ?? 'var(--faint)' }} />{a.name}
              </Opt>
            ))}
            {fromAccounts.length > 4 && (
              <Opt more onClick={() => setShowAllAccounts((v) => !v)}>{showAllAccounts ? '접기' : `+${fromAccounts.length - visibleFromAccounts.length}개`}</Opt>
            )}
          </Opts>
        </Group>

        {type === 'transfer' ? (
          <Group label="입금 계좌">
            <Opts>
              {depositAccounts.concat(accounts.filter((a) => a.type === 'card')).map((a) => (
                <Opt key={a.id} sel={(toAccountId || depositAccounts[0]?.id) === a.id} onClick={() => setToAccountId(a.id)}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-middle" style={{ background: a.color ?? 'var(--faint)' }} />{a.name}{a.type === 'card' ? ' (카드대금)' : ''}
                </Opt>
              ))}
            </Opts>
          </Group>
        ) : incomeMode ? (
          <Group label="수입 분류">
            <Opts>
              {incomeCats.map((c) => <Opt key={c.id} sel={incomeCatId === c.id} onClick={() => setIncomeCatId(c.id)}>{c.icon} {c.name}</Opt>)}
            </Opts>
          </Group>
        ) : (
          <Group label="카테고리">
            <Opts>
              {visibleMains.map((c) => (
                <Opt key={c.id} sel={mainCatId === c.id} onClick={() => { setMainCatId(c.id); setSubCatId(''); setPerfOverride(null); }}>{c.icon} {c.name}{c.defaultExcluded ? '' : ''}</Opt>
              ))}
              {mains.length > 8 && (
                <Opt more onClick={() => setShowAllMainCats((v) => !v)}>{showAllMainCats ? '접기' : `+${mains.length - visibleMains.length}개`}</Opt>
              )}
            </Opts>
            {subs.length > 0 && (
              <div className="mt-2 max-h-[92px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"><Opts>
                {subs.map((c) => <Opt key={c.id} sub sel={subCatId === c.id} onClick={() => setSubCatId(c.id)}>{c.name}</Opt>)}
              </Opts></div>
            )}
          </Group>
        )}

        {!incomeMode && type !== 'transfer' && (
          <Group label="가맹점 (선택)">
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="가맹점·메모" className="w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[13px] outline-none" />
          </Group>
        )}

        {type === 'expense' && (
          <div className="mb-3">
            <div className="flex items-center justify-between rounded-xl border-[1.5px] border-line bg-surface px-3.5 py-3">
              <div>
                <div className="text-[13.5px] font-bold">실적 인정</div>
                <div className={`mt-[3px] text-[11px] font-semibold ${perfOn ? 'text-sub' : 'text-warn'}`}>
                  {perfOverride === null ? `자동 판정: ${autoCounts ? '인정 · 카드 실적 포함' : autoExcluded ? '실적 제외 카테고리' : '미포함'}` : `수동 설정 · 실적 ${perfOn ? '포함' : '미포함'}`}
                </div>
              </div>
              <button onClick={() => setPerfOverride(perfOn ? false : true)} className={`relative h-6 w-[42px] flex-none rounded-full ${perfOn ? 'bg-good' : 'bg-line'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${perfOn ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid flex-none grid-cols-3 gap-px border-t border-line bg-line">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((k) => (
          <button key={k} onClick={() => key(k)} className="bg-canvas py-2 text-center text-lg font-semibold">{k}</button>
        ))}
      </div>
      <button onClick={save} className={`mx-[18px] mb-2 mt-2 flex-none rounded-[13px] py-2.5 text-center text-[14.5px] font-bold text-white ${incomeMode ? 'bg-good' : 'bg-ink'}`}>저장</button>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">{label}</div>
      {children}
    </div>
  );
}
function Opts({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  return <div className={`flex flex-wrap gap-[7px] ${scroll ? 'max-h-[106px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden' : ''}`}>{children}</div>;
}
function Opt({ children, sel, sub, more, onClick }: { children: React.ReactNode; sel?: boolean; sub?: boolean; more?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-[10px] border-[1.5px] px-[11px] py-2 text-[12.5px] font-semibold ${more ? 'border-dashed border-line bg-surface text-sub' : sub ? (sel ? 'border-ink bg-surface text-ink' : 'border-transparent bg-line2 text-sub') : sel ? 'border-ink bg-surface text-ink' : 'border-line bg-surface text-sub'}`}>{children}</button>
  );
}
