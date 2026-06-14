import { useAppStore, type ScreenId } from '../store/useAppStore';
import { db } from '../db/schema';
import { AppHead } from '../ui/components';

const MANAGE: { screen: ScreenId; icon: string; name: string; desc: string }[] = [
  { screen: 'assets', icon: '📊', name: '자산', desc: '순자산 · 계좌별 잔액 · 추이' },
  { screen: 'cards', icon: '💳', name: '카드 · 혜택 관리', desc: '실적 추적 · 혜택 한도 · 핀 설정' },
  { screen: 'recurring', icon: '⟳', name: '자동이체', desc: '정기 결제 등록 · 실적 전망' },
  { screen: 'import', icon: '📥', name: '가져오기', desc: '카드 문자 · 엑셀 업로드' },
];

export function MoreScreen() {
  const navigate = useAppStore((s) => s.navigate);

  async function backup() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      benefits: await db.benefits.toArray(),
      recurringRules: await db.recurringRules.toArray(),
      balanceSnapshots: await db.balanceSnapshots.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siljeok-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AppHead title="더보기" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">관리</div>
        <div className="mb-4">
          {MANAGE.map((m) => (
            <Row key={m.screen} icon={m.icon} name={m.name} desc={m.desc} onClick={() => navigate(m.screen)} />
          ))}
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">설정</div>
        <Row icon="🏷️" name="카테고리 관리" desc="아이콘·색상·실적 제외 설정" onClick={() => navigate('category')} />
        <Row icon="💾" name="백업 · 복원" desc="JSON 내보내기" onClick={backup} />
        <Row icon="⚙️" name="환경설정" desc="알림 · 표시 · 저장소" />
      </div>
    </>
  );
}

function Row({ icon, name, desc, onClick }: { icon: string; name: string; desc: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="mb-2 flex items-center gap-[13px] rounded-[13px] bg-surface px-[15px] py-3.5 shadow-card">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-line2 text-[17px]">{icon}</span>
      <div>
        <div className="text-[14px] font-bold">{name}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-faint">{desc}</div>
      </div>
      <span className="ml-auto text-base text-faint">›</span>
    </div>
  );
}
