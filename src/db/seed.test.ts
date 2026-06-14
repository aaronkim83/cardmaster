import { describe, it, expect } from 'vitest';
import { buildSeedCategories } from './seed';
import { buildCategoryMap, isCategoryExcluded } from '../logic/category';

// 시드 구조 회귀 — PRD 부록 B (2단 카테고리).
describe('buildSeedCategories', () => {
  const cats = buildSeedCategories();
  const byName = (n: string) => cats.find((c) => c.name === n)!;

  it('대분류/소분류 2단 구조를 만든다', () => {
    const food = byName('식비');
    expect(food.parentId).toBeNull();
    const children = cats.filter((c) => c.parentId === food.id).map((c) => c.name);
    expect(children).toEqual(['마트', '배달', '외식', '카페', '간식']);
  });

  it('공과금은 실적 제외 대분류이고 자식이 상속한다', () => {
    const util = byName('공과금');
    expect(util.defaultExcluded).toBe(true);
    const map = buildCategoryMap(cats);
    const maint = byName('관리비');
    expect(maint.defaultExcluded).toBe(false); // 자체값 아님
    expect(isCategoryExcluded(maint.id, map)).toBe(true); // 부모 상속으로 제외
  });

  it('수입 분류를 포함한다', () => {
    const income = cats.filter((c) => c.type === 'income').map((c) => c.name);
    expect(income).toEqual(['급여', '이자/배당', '환급', '기타수입']);
  });
});
