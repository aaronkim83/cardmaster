import { nanoid } from 'nanoid';
import { db } from './schema';
import type { Account, Benefit, Budget, CardConfig, RecurringRule, Transaction } from './types';

// 첫 실행 데모 데이터 — 계좌/카드/혜택/자동이체/거래/예산.
// 온보딩 UI 전까지 화면이 의미 있게 렌더링되도록 prototype과 유사한 데이터를 시드한다.
// demoSeeded 플래그가 없고 accounts 테이블이 비어 있을 때만 1회 실행.

export const DEMO_SEEDED_SETTING_KEY = 'demoSeeded';
export const ONBOARDED_SETTING_KEY = 'onboarded';

function card(cfg: Partial<CardConfig>): CardConfig {
  return {
    targetAmount: 300000,
    cycleType: 'prev_month',
    trackPerformance: true,
    excludedCategoryIds: [],
    ...cfg,
  };
}

function asset(
  id: string,
  name: string,
  type: Account['type'],
  over: Partial<Account>,
): Account {
  return {
    id,
    name,
    kind: 'asset',
    type,
    balanceMode: 'calculated',
    openingBalance: 0,
    isPinned: false,
    isActive: true,
    sortOrder: 0,
    createdAt: Date.now(),
    ...over,
  };
}

function cardAcc(
  id: string,
  name: string,
  color: string,
  icon: string,
  cfg: CardConfig,
  over: Partial<Account> = {},
): Account {
  return {
    id,
    name,
    kind: 'liability',
    type: 'card',
    balanceMode: 'calculated',
    openingBalance: 0,
    card: cfg,
    isPinned: false,
    isActive: true,
    sortOrder: 0,
    color,
    icon,
    createdAt: Date.now(),
    ...over,
  };
}

export async function seedDemoDataIfEmpty(): Promise<void> {
  const demoSeeded = await db.settings.get(DEMO_SEEDED_SETTING_KEY);
  if (demoSeeded?.value === true) return;

  if ((await db.accounts.count()) > 0) {
    await db.settings.put({ key: DEMO_SEEDED_SETTING_KEY, value: true });
    return;
  }

  await seedDemoData();
}

export async function seedDemoData(): Promise<void> {
  // 카테고리 이름 → id 매핑 (시드된 2단 카테고리에서)
  const cats = await db.categories.toArray();
  const catId = (name: string, parent?: boolean): string | undefined => {
    const c = cats.find((x) => x.name === name && (parent ? x.parentId === null : true));
    return c?.id;
  };
  const utilityMainId = catId('공과금', true);

  const accounts: Account[] = [
    asset('acc-bank', '주거래 통장', 'bank', { openingBalance: 2000000, color: '#3A7D44', icon: '통' }),
    asset('acc-invest', '증권계좌', 'investment', {
      balanceMode: 'manual',
      manualBalance: 24000000,
      color: '#B5852A',
      icon: '투',
    }),
    asset('acc-saving', '주택청약', 'savings', { openingBalance: 3470000, color: '#5A6ACF', icon: '청' }),
    cardAcc('card-samsung', '삼성 taptap', '#1A3FB0', 'S',
      card({ targetAmount: 300000, cycleType: 'prev_month', minPerTxn: 10000, settlementAccountId: 'acc-bank', settlementDay: 5, excludedCategoryIds: utilityMainId ? [utilityMainId] : [] }),
      { isPinned: true }),
    cardAcc('card-hyundai', '현대카드 M', '#222226', 'M',
      card({ targetAmount: 400000, cycleType: 'curr_month', settlementAccountId: 'acc-bank', settlementDay: 12 })),
    cardAcc('card-shinhan', '신한 Deep Dream', '#0A6CFF', '신',
      card({ targetAmount: 500000, cycleType: 'prev_month', minPerTxn: 5000 })),
    cardAcc('card-lotte', '롯데 LOCA Likit', '#D7263D', '롯',
      card({ targetAmount: 300000, cycleType: 'prev_month' })),
    cardAcc('card-kb', 'KB 굿데이', '#FFB81C', 'KB',
      card({ targetAmount: 200000, cycleType: 'prev_month' })),
    cardAcc('card-woori', '우리 카드의정석', '#0067AC', '우',
      card({ targetAmount: 250000, cycleType: 'prev_month' })),
    cardAcc('card-hana', '하나 트래블로그', '#00857C', '하',
      card({ trackPerformance: false }), { color: '#00857C' }),
  ];

  const benefits: Benefit[] = [
    { id: 'ben-sbux', accountId: 'card-samsung', name: '스타벅스 50% 할인', type: 'discount', targetMerchant: '스타벅스', rate: 0.5, monthlyLimit: 5000, limitBasis: 'benefit_amount', requiresPerformance: false, isActive: true },
    { id: 'ben-transit', accountId: 'card-samsung', name: '대중교통 10% 적립', type: 'point', targetCategoryId: catId('교통', true), rate: 0.1, requiresPerformance: false, isActive: true },
    { id: 'ben-mpoint', accountId: 'card-hyundai', name: 'M포인트 5% 적립', type: 'point', rate: 0.05, requiresPerformance: true, isActive: true },
    { id: 'ben-online', accountId: 'card-shinhan', name: '온라인쇼핑 7% 할인', type: 'discount', targetCategoryId: catId('쇼핑', true), rate: 0.07, monthlyLimit: 10000, limitBasis: 'benefit_amount', requiresPerformance: false, isActive: true },
    { id: 'ben-cvs', accountId: 'card-shinhan', name: '편의점 2% 적립', type: 'point', targetMerchant: 'GS25', rate: 0.02, requiresPerformance: false, isActive: true },
  ];

  const rules: RecurringRule[] = [
    { id: 'rec-insurance', name: '실비보험', type: 'expense', amount: 38000, isVariable: false, accountId: 'card-samsung', categoryId: catId('의료'), dayOfMonth: 5, startDate: '2026-01-01', autoConfirm: true, isActive: true },
    { id: 'rec-youtube', name: '유튜브 프리미엄', type: 'expense', amount: 14900, isVariable: false, accountId: 'card-hyundai', categoryId: catId('취미'), dayOfMonth: 10, startDate: '2026-01-01', autoConfirm: true, isActive: true },
    { id: 'rec-skt', name: 'SKT 통신비', type: 'expense', amount: 55000, isVariable: false, accountId: 'card-hyundai', categoryId: catId('통신'), dayOfMonth: 17, startDate: '2026-01-01', autoConfirm: true, isActive: true },
    { id: 'rec-netflix', name: '넷플릭스', type: 'expense', amount: 17000, isVariable: false, accountId: 'card-samsung', categoryId: catId('취미'), dayOfMonth: 25, startDate: '2026-01-01', autoConfirm: true, isActive: true },
    { id: 'rec-maint', name: '아파트 관리비', type: 'expense', amount: 180000, isVariable: true, accountId: 'acc-bank', categoryId: catId('관리비'), dayOfMonth: 28, startDate: '2026-01-01', autoConfirm: false, isActive: true },
  ];

  const mk = (over: Partial<Transaction> & { amount: number; accountId: string; date: string }): Transaction => ({
    id: nanoid(),
    type: 'expense',
    countsForPerformance: null,
    source: 'manual',
    status: 'confirmed',
    createdAt: Date.now(),
    ...over,
  });

  const txns: Transaction[] = [
    mk({ accountId: 'acc-bank', type: 'income', amount: 3200000, date: '2026-06-10', categoryId: catId('급여'), merchant: '6월 급여' }),
    mk({ accountId: 'card-samsung', amount: 52000, date: '2026-06-09', categoryId: catId('마트'), merchant: '이마트' }),
    mk({ accountId: 'card-samsung', amount: 6300, date: '2026-06-12', categoryId: catId('카페'), merchant: '스타벅스 강남R점' }),
    mk({ accountId: 'card-samsung', amount: 5500, date: '2026-06-08', categoryId: catId('카페'), merchant: '스타벅스 역삼점' }),
    mk({ accountId: 'card-samsung', amount: 12000, date: '2026-06-11', categoryId: catId('택시'), merchant: '카카오택시' }),
    mk({ accountId: 'card-samsung', amount: 88000, date: '2026-06-06', categoryId: catId('외식'), merchant: '한우다이닝' }),
    mk({ accountId: 'card-shinhan', amount: 40900, date: '2026-06-12', categoryId: catId('온라인몰'), merchant: '쿠팡' }),
    mk({ accountId: 'card-shinhan', amount: 34500, date: '2026-06-05', categoryId: catId('온라인몰'), merchant: '쿠팡' }),
    mk({ accountId: 'card-shinhan', amount: 8900, date: '2026-06-06', categoryId: catId('생활용품'), merchant: 'GS25 역삼점' }),
    mk({ accountId: 'card-lotte', amount: 23000, date: '2026-06-07', categoryId: catId('뷰티'), merchant: '올리브영' }),
    mk({ accountId: 'card-hana', amount: 80300, date: '2026-06-13', time: '09:32', categoryId: catId('의료'), merchant: '드림분당예치과병원', source: 'parsed' }),
    mk({ accountId: 'card-hyundai', amount: 33000, date: '2026-06-04', categoryId: catId('외식'), merchant: '배달의민족' }),
  ];

  const budgets: Budget[] = [
    { id: 'bud-all', categoryId: null, amount: 1200000, isActive: true },
    { id: 'bud-food', categoryId: catId('식비', true) ?? null, amount: 350000, isActive: true },
    { id: 'bud-shop', categoryId: catId('쇼핑', true) ?? null, amount: 150000, isActive: true },
    { id: 'bud-transit', categoryId: catId('교통', true) ?? null, amount: 120000, isActive: true },
  ];

  await db.transaction('rw', [db.accounts, db.benefits, db.recurringRules, db.transactions, db.budgets, db.settings], async () => {
    await db.accounts.bulkAdd(accounts);
    await db.benefits.bulkAdd(benefits);
    await db.recurringRules.bulkAdd(rules);
    await db.transactions.bulkAdd(txns);
    await db.budgets.bulkAdd(budgets);
    await db.settings.bulkPut([
      { key: DEMO_SEEDED_SETTING_KEY, value: true },
      { key: ONBOARDED_SETTING_KEY, value: false },
    ]);
  });
}
