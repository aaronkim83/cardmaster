import dayjs from 'dayjs';

// 기준월 헬퍼 — 모든 월별 집계는 YearMonth(1~12월) 기준. (PRD §4.0)
export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export function monthKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function dateMonthKey(date: string): string {
  return date.slice(0, 7);
}

export function ymOfDate(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function inMonth(date: string, ym: YearMonth): boolean {
  return dateMonthKey(date) === monthKey(ym);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const d = dayjs(`${monthKey(ym)}-01`).add(n, 'month');
  return { year: d.year(), month: d.month() + 1 };
}

export function prevMonth(ym: YearMonth): YearMonth {
  return addMonths(ym, -1);
}

export function nextMonth(ym: YearMonth): YearMonth {
  return addMonths(ym, 1);
}

export function daysInMonth(ym: YearMonth): number {
  return dayjs(`${monthKey(ym)}-01`).daysInMonth();
}

/** 음수=a 이전, 0=같음, 양수=a 이후 */
export function compareYM(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function todayYM(today?: string): YearMonth {
  const d = today ? dayjs(today) : dayjs();
  return { year: d.year(), month: d.month() + 1 };
}

/** selectedMonth가 today 기준 현재달인지 */
export function isCurrentMonth(ym: YearMonth, today?: string): boolean {
  return compareYM(ym, todayYM(today)) === 0;
}
