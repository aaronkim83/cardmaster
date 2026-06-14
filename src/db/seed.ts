import { nanoid } from 'nanoid';
import type { Category } from './types';
import { db } from './schema';

// 온보딩 시드 — PRD v6 부록 B (2단 카테고리).
// 대분류 defaultExcluded → 자식 상속(logic 레이어에서 OR 결합으로 해석).

interface SeedMain {
  name: string;
  icon: string;
  color: string;
  defaultExcluded?: boolean;
  children: { name: string; icon: string }[];
}

const EXPENSE_SEED: SeedMain[] = [
  {
    name: '식비',
    icon: '🍚',
    color: '#1F8A4C',
    children: [
      { name: '마트', icon: '🛒' },
      { name: '배달', icon: '🍱' },
      { name: '외식', icon: '🍴' },
      { name: '카페', icon: '☕' },
      { name: '간식', icon: '🍩' },
    ],
  },
  {
    name: '교통',
    icon: '🚇',
    color: '#4A5568',
    children: [
      { name: '대중교통', icon: '🚌' },
      { name: '택시', icon: '🚕' },
      { name: '주유', icon: '⛽' },
    ],
  },
  {
    name: '쇼핑',
    icon: '🛍',
    color: '#D7263D',
    children: [
      { name: '의류', icon: '👕' },
      { name: '온라인몰', icon: '📦' },
      { name: '뷰티', icon: '💄' },
    ],
  },
  {
    name: '생활',
    icon: '🧴',
    color: '#5A6ACF',
    children: [
      { name: '생활용품', icon: '🧻' },
      { name: '의료', icon: '🏥' },
      { name: '통신', icon: '📱' },
    ],
  },
  {
    name: '문화',
    icon: '🎬',
    color: '#8B6914',
    children: [
      { name: '영화/공연', icon: '🎬' },
      { name: '여행', icon: '✈️' },
      { name: '취미', icon: '🎨' },
    ],
  },
  {
    name: '공과금',
    icon: '🧾',
    color: '#8C887C',
    defaultExcluded: true, // 카드 실적 제외 (자식 상속)
    children: [
      { name: '관리비', icon: '🏢' },
      { name: '전기/가스', icon: '💡' },
      { name: '세금', icon: '🧾' },
    ],
  },
];

// 수입 분류 — 부록 B (단층)
const INCOME_SEED: { name: string; icon: string; color: string }[] = [
  { name: '급여', icon: '💰', color: '#1F8A4C' },
  { name: '이자/배당', icon: '📈', color: '#B5852A' },
  { name: '환급', icon: '↩️', color: '#5A6ACF' },
  { name: '기타수입', icon: '➕', color: '#8C887C' },
];

/** 시드 카테고리 배열 생성 (대분류 + 소분류, parentId 연결). */
export function buildSeedCategories(): Category[] {
  const out: Category[] = [];
  let order = 0;

  for (const main of EXPENSE_SEED) {
    const parentId = nanoid();
    const excluded = main.defaultExcluded ?? false;
    out.push({
      id: parentId,
      name: main.name,
      type: 'expense',
      icon: main.icon,
      color: main.color,
      parentId: null,
      defaultExcluded: excluded,
      isCustom: false,
      sortOrder: order++,
    });
    main.children.forEach((c, i) => {
      out.push({
        id: nanoid(),
        name: c.name,
        type: 'expense',
        icon: c.icon,
        color: main.color,
        parentId,
        defaultExcluded: false, // 자체 제외 아님 — 상속은 logic에서 부모와 OR 결합
        isCustom: false,
        sortOrder: i,
      });
    });
  }

  INCOME_SEED.forEach((inc) => {
    out.push({
      id: nanoid(),
      name: inc.name,
      type: 'income',
      icon: inc.icon,
      color: inc.color,
      parentId: null,
      defaultExcluded: false,
      isCustom: false,
      sortOrder: order++,
    });
  });

  return out;
}

/** DB가 비어 있으면 시드 카테고리를 채운다. (온보딩 1회) */
export async function seedDatabaseIfEmpty(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) return;
  await db.categories.bulkAdd(buildSeedCategories());
}
