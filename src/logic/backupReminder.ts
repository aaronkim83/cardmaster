import type { Transaction } from '../db/types';

// 백업 리마인더 (PRD §7) — 마지막 백업 후 7일 경과 또는 신규 거래 50건 이상이면 알림.

export const BACKUP_REMINDER_DAYS = 7;
export const BACKUP_REMINDER_COUNT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminder {
  due: boolean;
  reason: 'days' | 'count' | null;
  daysSince: number | null; // 마지막 백업 후 경과일 (백업 이력 없으면 null)
  newCount: number; // 마지막 백업 이후 추가된 거래 수
}

export function shouldRemindBackup(
  lastBackupAt: number | undefined,
  txns: Pick<Transaction, 'createdAt'>[],
  now: number = Date.now(),
): BackupReminder {
  const newCount = txns.filter((t) => t.createdAt > (lastBackupAt ?? 0)).length;
  const daysSince = lastBackupAt === undefined ? null : Math.floor((now - lastBackupAt) / DAY_MS);

  if (newCount === 0) return { due: false, reason: null, daysSince, newCount };

  // 한 번도 백업 안 함: 거래가 임계치 이상 쌓였을 때만 권유(과도한 알림 방지)
  if (lastBackupAt === undefined) {
    const due = newCount >= BACKUP_REMINDER_COUNT;
    return { due, reason: due ? 'count' : null, daysSince, newCount };
  }

  if (now - lastBackupAt >= BACKUP_REMINDER_DAYS * DAY_MS) {
    return { due: true, reason: 'days', daysSince, newCount };
  }
  if (newCount >= BACKUP_REMINDER_COUNT) {
    return { due: true, reason: 'count', daysSince, newCount };
  }
  return { due: false, reason: null, daysSince, newCount };
}
