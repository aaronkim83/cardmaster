import { describe, it, expect } from 'vitest';
import { shouldRemindBackup, BACKUP_REMINDER_DAYS } from './backupReminder';

const NOW = Date.parse('2026-06-16T00:00:00Z');
const day = 24 * 60 * 60 * 1000;
const txnsAt = (...times: number[]) => times.map((createdAt) => ({ createdAt }));

describe('shouldRemindBackup', () => {
  it('신규 거래 없으면 알림 안 함', () => {
    const r = shouldRemindBackup(NOW - 30 * day, txnsAt(NOW - 40 * day), NOW);
    expect(r.due).toBe(false);
    expect(r.newCount).toBe(0);
  });

  it('마지막 백업 후 7일 경과 + 신규 거래 있으면 days', () => {
    const last = NOW - (BACKUP_REMINDER_DAYS + 1) * day;
    const r = shouldRemindBackup(last, txnsAt(NOW - day), NOW);
    expect(r.due).toBe(true);
    expect(r.reason).toBe('days');
    expect(r.newCount).toBe(1);
  });

  it('7일 이내라도 신규 거래 50건 이상이면 count', () => {
    const last = NOW - day;
    const r = shouldRemindBackup(last, txnsAt(...Array(50).fill(NOW)), NOW);
    expect(r.due).toBe(true);
    expect(r.reason).toBe('count');
  });

  it('백업 이력 없음: 50건 미만이면 알림 안 함, 50건 이상이면 count', () => {
    expect(shouldRemindBackup(undefined, txnsAt(...Array(10).fill(NOW)), NOW).due).toBe(false);
    const big = shouldRemindBackup(undefined, txnsAt(...Array(50).fill(NOW)), NOW);
    expect(big.due).toBe(true);
    expect(big.reason).toBe('count');
    expect(big.daysSince).toBeNull();
  });
});
