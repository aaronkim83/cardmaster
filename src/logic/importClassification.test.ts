import { describe, expect, it } from 'vitest';
import { buildSeedCategories } from '../db/seed';
import { suggestExpenseCategory } from './importClassification';

const categories = buildSeedCategories();

describe('suggestExpenseCategory', () => {
  it('온라인몰 가맹점을 쇼핑/온라인몰로 추천한다', () => {
    expect(suggestExpenseCategory(categories, '쿠팡')?.name).toBe('온라인몰');
  });

  it('의료 키워드를 생활/의료로 추천한다', () => {
    expect(suggestExpenseCategory(categories, '판교예스치과')?.name).toBe('의료');
  });

  it('주유소 키워드를 교통/주유로 추천한다', () => {
    expect(suggestExpenseCategory(categories, '판교서울주유소')?.name).toBe('주유');
  });

  it('알 수 없는 가맹점은 추천하지 않는다', () => {
    expect(suggestExpenseCategory(categories, '비바리퍼블리카')).toBeUndefined();
  });
});
