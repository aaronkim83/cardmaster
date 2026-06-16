import { useRef } from 'react';
import { useAppStore, type ScreenId } from '../store/useAppStore';
import { db } from '../db/schema';
import { AppHead } from '../ui/components';
import { transactionsToCsv } from '../logic/csv';
import { shouldRemindBackup } from '../logic/backupReminder';

const LAST_BACKUP_SETTING_KEY = 'lastBackupAt';

function triggerDownload(content: BlobPart, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MANAGE: { screen: ScreenId; icon: string; name: string; desc: string }[] = [
  { screen: 'assets', icon: '📊', name: '자산', desc: '순자산 · 계좌별 잔액 · 추이' },
  { screen: 'cards', icon: '💳', name: '카드 · 혜택 관리', desc: '실적 추적 · 혜택 한도 · 핀 설정' },
  { screen: 'recurring', icon: '⟳', name: '자동이체', desc: '정기 결제 등록 · 실적 전망' },
  { screen: 'import', icon: '📥', name: '가져오기', desc: '카드 문자 · 엑셀 업로드' },
];

export function MoreScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const restoreFromBackup = useAppStore((s) => s.restoreFromBackup);
  const setSetting = useAppStore((s) => s.setSetting);
  const transactions = useAppStore((s) => s.transactions);
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const settings = useAppStore((s) => s.settings);
  const fileRef = useRef<HTMLInputElement>(null);

  const lastBackupAt = settings.find((s) => s.key === LAST_BACKUP_SETTING_KEY)?.value as number | undefined;
  const reminder = shouldRemindBackup(lastBackupAt, transactions);

  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !Array.isArray(data.transactions)) {
        alert('백업 파일 형식이 올바르지 않아요.');
        return;
      }
      if (!confirm('현재 데이터를 모두 지우고 백업으로 복원할까요?')) return;
      await restoreFromBackup(data);
      alert('복원되었습니다.');
      navigate('home');
    } catch {
      alert('파일을 읽을 수 없어요.');
    }
  }

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
      importProfiles: await db.importProfiles.toArray(),
      merchantRules: await db.merchantRules.toArray(),
      balanceSnapshots: await db.balanceSnapshots.toArray(),
      settings: await db.settings.toArray(),
    };
    triggerDownload(JSON.stringify(data, null, 2), 'application/json', `siljeok-backup-${new Date().toISOString().slice(0, 10)}.json`);
    await setSetting(LAST_BACKUP_SETTING_KEY, Date.now());
  }

  function exportCsv() {
    const csv = transactionsToCsv(transactions, accounts, categories);
    triggerDownload('﻿' + csv, 'text/csv;charset=utf-8', `siljeok-거래내역-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <>
      <AppHead title="더보기" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        {reminder.due && (
          <button onClick={backup} className="mb-3.5 flex w-full items-center gap-2.5 rounded-[13px] border border-[#F3D6C7] bg-warn-bg px-[13px] py-[11px] text-left">
            <span className="text-[15px]">💾</span>
            <span className="flex-1 text-[12px] font-medium leading-snug text-ink">
              {reminder.reason === 'days'
                ? <>마지막 백업 후 <b className="font-bold text-warn">{reminder.daysSince}일</b> 지났어요. 지금 백업하세요.</>
                : <>백업 후 거래 <b className="font-bold text-warn">{reminder.newCount}건</b>이 쌓였어요. 백업을 권장해요.</>}
            </span>
            <span className="rounded-[9px] bg-warn px-3 py-1.5 text-[11.5px] font-bold text-white">백업</span>
          </button>
        )}
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">관리</div>
        <div className="mb-4">
          {MANAGE.map((m) => (
            <Row key={m.screen} icon={m.icon} name={m.name} desc={m.desc} onClick={() => navigate(m.screen)} />
          ))}
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">설정</div>
        <Row icon="💸" name="예산 설정" desc="전체·카테고리별 월 예산" onClick={() => navigate('budget')} />
        <Row icon="🏷️" name="카테고리 관리" desc="아이콘·색상·실적 제외 설정" onClick={() => navigate('category')} />
        <Row icon="💾" name="백업 (JSON 내보내기)" desc={lastBackupAt ? `마지막 백업 ${new Date(lastBackupAt).toLocaleDateString('ko-KR')}` : '전 데이터를 파일로 저장'} onClick={backup} />
        <Row icon="♻️" name="복원 (JSON 불러오기)" desc="백업 파일에서 데이터 복구" onClick={() => fileRef.current?.click()} />
        <Row icon="📄" name="CSV 내보내기" desc="거래 내역을 표 형식으로 저장" onClick={exportCsv} />
        <Row icon="⚙️" name="환경설정" desc="데모 데이터 · 저장소 상태" onClick={() => navigate('settings')} />
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
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
