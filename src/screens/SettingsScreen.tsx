import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppHead } from '../ui/components';

export function SettingsScreen() {
  const accounts = useAppStore((s) => s.accounts);
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const benefits = useAppStore((s) => s.benefits);
  const recurringRules = useAppStore((s) => s.recurringRules);
  const resetAllData = useAppStore((s) => s.resetAllData);
  const loadDemoData = useAppStore((s) => s.loadDemoData);
  const navigate = useAppStore((s) => s.navigate);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void refreshPersisted();
  }, []);

  async function refreshPersisted() {
    if (!navigator.storage?.persisted) {
      setPersisted(false);
      return;
    }
    setPersisted(await navigator.storage.persisted());
  }

  async function requestPersist() {
    if (!navigator.storage?.persist) {
      alert('이 브라우저는 저장소 영속화 요청을 지원하지 않아요.');
      return;
    }
    const ok = await navigator.storage.persist();
    setPersisted(ok);
  }

  async function clearDemo() {
    if (!confirm('데모 계좌·카드·거래를 지우고 카테고리만 남길까요? 이 작업은 되돌릴 수 없어요.')) return;
    await resetAllData({ onboarded: true });
    alert('데모 데이터를 삭제했습니다. 이제 계좌와 카드를 새로 등록할 수 있어요.');
    navigate('home');
  }

  async function fullReset() {
    if (!confirm('전체 데이터를 초기화할까요? 계좌·카드·거래·예산·혜택·자동이체가 모두 삭제됩니다.')) return;
    if (!confirm('정말 초기화할까요? 백업하지 않은 데이터는 복구할 수 없어요.')) return;
    await resetAllData({ onboarded: false });
    alert('초기화했습니다.');
    navigate('home');
  }

  async function reloadDemo() {
    if (!confirm('현재 데이터를 모두 지우고 데모 데이터를 다시 불러올까요?')) return;
    await loadDemoData();
    alert('데모 데이터를 다시 불러왔습니다.');
    navigate('home');
  }

  return (
    <>
      <AppHead title="환경설정" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">저장소</div>
        <div className="mb-4 rounded-[13px] bg-surface px-[15px] py-3.5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-bold">브라우저 저장소</div>
              <div className="mt-0.5 text-[11px] font-semibold text-faint">
                {persisted === null ? '확인 중' : persisted ? '영속화됨' : '영속화 필요'}
              </div>
            </div>
            <button onClick={requestPersist} className="rounded-[10px] bg-ink px-3 py-2 text-[12px] font-bold text-white">
              요청
            </button>
          </div>
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">현재 데이터</div>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <Count label="계좌·카드" value={accounts.length} />
          <Count label="거래" value={transactions.length} />
          <Count label="카테고리" value={categories.length} />
          <Count label="혜택·자동이체" value={benefits.length + recurringRules.length} />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">실사용 시작</div>
        <Action name="데모 데이터 삭제" desc="카테고리만 남기고 계좌·카드·거래를 비웁니다" tone="primary" onClick={clearDemo} />
        <Action name="데모 다시 불러오기" desc="현재 데이터를 지우고 샘플 데이터를 다시 만듭니다" onClick={reloadDemo} />
        <Action name="전체 초기화" desc="모든 사용자 데이터를 삭제하고 기본 카테고리만 남깁니다" tone="danger" onClick={fullReset} />
      </div>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[13px] bg-surface px-3.5 py-3 shadow-card">
      <div className="text-[11px] font-semibold text-sub">{label}</div>
      <div className="num mt-1 text-[18px] font-extrabold">{value}</div>
    </div>
  );
}

function Action({
  name,
  desc,
  tone = 'neutral',
  onClick,
}: {
  name: string;
  desc: string;
  tone?: 'neutral' | 'primary' | 'danger';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-warn-bg text-warn'
      : tone === 'primary'
        ? 'bg-ink text-white'
        : 'bg-surface text-ink';

  return (
    <button onClick={onClick} className={`mb-2 w-full rounded-[13px] px-[15px] py-3.5 text-left shadow-card ${toneClass}`}>
      <div className="text-[14px] font-bold">{name}</div>
      <div className={`mt-0.5 text-[11px] font-semibold ${tone === 'primary' ? 'text-white/70' : 'text-faint'}`}>{desc}</div>
    </button>
  );
}
