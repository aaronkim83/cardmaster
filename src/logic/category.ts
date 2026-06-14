import type { Account, Category } from '../db/types';

// 2단 카테고리 실적 제외 해석 — 불변식 #5.
// defaultExcluded는 plain boolean(PRD §3.3)이므로 상속은 부모와 OR 결합으로 해석한다:
//   effectiveExcluded(leaf) = leaf.defaultExcluded || parent.defaultExcluded
// → 대분류 제외 시 자식 상속, 일반 부모 아래 소분류를 제외로 오버라이드 가능.

export type CategoryMap = Map<string, Category>;

export function buildCategoryMap(categories: Category[]): CategoryMap {
  return new Map(categories.map((c) => [c.id, c]));
}

/** 카테고리 자체의 실적 제외 여부 (대분류 상속 포함). */
export function isCategoryExcluded(categoryId: string | undefined, map: CategoryMap): boolean {
  if (!categoryId) return false;
  const cat = map.get(categoryId);
  if (!cat) return false;
  if (cat.defaultExcluded) return true;
  if (cat.parentId) {
    const parent = map.get(cat.parentId);
    if (parent?.defaultExcluded) return true;
  }
  return false;
}

/** 카드의 excludedCategoryIds에 의한 제외 (대분류 id면 자식 전부 제외). */
export function cardExcludesCategory(
  card: Account,
  categoryId: string | undefined,
  map: CategoryMap,
): boolean {
  if (!categoryId) return false;
  const excluded = card.card?.excludedCategoryIds ?? [];
  if (excluded.length === 0) return false;
  if (excluded.includes(categoryId)) return true;
  const cat = map.get(categoryId);
  if (cat?.parentId && excluded.includes(cat.parentId)) return true;
  return false;
}

/** 특정 카드의 실적 산정에서 이 카테고리가 제외되는지 (전역 상속 + 카드별 제외). */
export function isExcludedForCard(
  card: Account,
  categoryId: string | undefined,
  map: CategoryMap,
): boolean {
  return isCategoryExcluded(categoryId, map) || cardExcludesCategory(card, categoryId, map);
}

/** 소분류 → 대분류 id (없으면 자기 자신). 통계 롤업용. */
export function rootCategoryId(categoryId: string | undefined, map: CategoryMap): string | undefined {
  if (!categoryId) return undefined;
  const cat = map.get(categoryId);
  if (!cat) return categoryId;
  return cat.parentId ?? cat.id;
}
