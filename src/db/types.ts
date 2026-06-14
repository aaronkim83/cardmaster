// 데이터 모델 — PRD v6 §3. 금액은 정수 KRW, id는 nanoid.

// ── 3.1 Account (카드 흡수) ──────────────────────────────
export type AccountKind = 'asset' | 'liability';
export type AccountType =
  | 'cash'
  | 'bank'
  | 'savings'
  | 'investment'
  | 'realestate'
  | 'card'
  | 'loan'
  | 'other';
export type BalanceMode = 'calculated' | 'manual';
export type CardCycleType = 'prev_month' | 'curr_month';

export interface CardConfig {
  targetAmount: number;
  cycleType: CardCycleType;
  trackPerformance: boolean;
  minPerTxn?: number;
  excludedCategoryIds: string[]; // 대분류 지정 시 자식 소분류 포함
  settlementAccountId?: string;
  settlementDay?: number;
  benefitMemo?: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  type: AccountType;
  balanceMode: BalanceMode;
  openingBalance: number;
  manualBalance?: number;
  card?: CardConfig;
  isPinned: boolean;
  lastUsedAt?: number;
  color?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
}

// ── 3.2 Transaction ──────────────────────────────────────
export type TxnType = 'expense' | 'income' | 'transfer';
export type TxnSource = 'manual' | 'parsed' | 'recurring' | 'import';
export type TxnStatus = 'confirmed' | 'pending';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: TxnType;
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string; // 최하위(소분류) 연결 권장
  merchant?: string;
  memo?: string;
  countsForPerformance: boolean | null; // null=자동판정, true/false=수동(우선)
  appliedBenefitId?: string;
  benefitAmount?: number;
  source: TxnSource;
  status: TxnStatus;
  recurringId?: string;
  importBatchId?: string;
  createdAt: number;
}

// ── 3.3 Category (2단 계층) ──────────────────────────────
export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  parentId: string | null; // null=대분류, 값=소분류(부모 id)
  defaultExcluded: boolean; // 카드 실적 기본 제외. 대분류→자식 상속, 소분류 오버라이드 가능
  isCustom: boolean;
  sortOrder: number;
}

// ── 3.4 Budget ───────────────────────────────────────────
export interface Budget {
  id: string;
  categoryId: string | null; // null → 전체(월 총) 예산
  amount: number;
  isActive: boolean;
}

// ── 3.5 Benefit / RecurringRule / ImportProfile / MerchantRule / BalanceSnapshot / Setting ──
export interface Benefit {
  id: string;
  accountId: string;
  name: string;
  type: 'discount' | 'point';
  targetMerchant?: string;
  targetCategoryId?: string;
  rate: number;
  monthlyLimit?: number;
  limitBasis?: 'benefit_amount' | 'spend_amount';
  requiresPerformance: boolean;
  memo?: string;
  isActive: boolean;
}

export interface RecurringRule {
  id: string;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  isVariable: boolean;
  accountId: string;
  categoryId?: string;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  autoConfirm: boolean;
  lastGeneratedPeriod?: string; // YYYY-MM
  isActive: boolean;
}

export interface ImportProfile {
  id: string;
  name: string;
  columnMap: { date: string; amount: string; merchant: string; type?: string };
  defaultAccountId?: string;
  dateFormat?: string;
  amountSign?: 'positive_expense' | 'negative_expense';
}

export interface MerchantRule {
  id: string;
  pattern: string;
  categoryId: string;
  hitCount: number;
}

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  period: string; // YYYY-MM
  balance: number;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
