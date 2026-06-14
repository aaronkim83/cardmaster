import { useMemo } from 'react';
import { useAppStore } from './useAppStore';
import type { Account, Category } from '../db/types';

export function useAccountMap(): Map<string, Account> {
  const accounts = useAppStore((s) => s.accounts);
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useAppStore((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

/** 카테고리 표시명 (소분류면 '대분류 · 소분류'는 과해서 소분류명만). */
export function categoryLabel(map: Map<string, Category>, id?: string): { icon: string; name: string } {
  if (!id) return { icon: '🏷️', name: '미분류' };
  const c = map.get(id);
  if (!c) return { icon: '🏷️', name: '미분류' };
  return { icon: c.icon, name: c.name };
}
