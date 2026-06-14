// 표시 포맷 헬퍼 (KRW 단일 통화).

export function won(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 큰 금액 축약: 32,450,000 → "3,245만" */
export function manWon(n: number): string {
  const man = Math.round(n / 10000);
  return `${man.toLocaleString('ko-KR')}만`;
}

export function signedWon(n: number): string {
  return `${n >= 0 ? '+' : '−'}${won(Math.abs(n))}`;
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '6월 13일 (금)' */
export function formatDayHead(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}
