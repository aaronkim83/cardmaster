import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { useMonthlyData } from '../store/useMonthlyData';
import { AppHead, AddButton, Toggle } from '../ui/components';
import { Modal, Labeled, NumberField, PrimaryButton } from '../ui/Modal';
import { pct, won } from '../ui/format';
import type { Budget, Category } from '../db/types';

const ALL_BUDGET = '__all__';

export function BudgetScreen() {
  const budgets = useAppStore((s) => s.budgets);
  const categories = useAppStore((s) => s.categories);
  const saveBudget = useAppStore((s) => s.saveBudget);
  const deleteBudget = useAppStore((s) => s.deleteBudget);
  const data = useMonthlyData();
  const [editing, setEditing] = useState<Budget | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense').sort(categorySort(categories)),
    [categories],
  );
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const progressMap = useMemo(() => new Map(data.budgets.map((b) => [b.budgetId, b])), [data.budgets]);
  const sortedBudgets = budgets.slice().sort((a, b) => {
    if (a.categoryId === null) return -1;
    if (b.categoryId === null) return 1;
    return budgetLabel(a.categoryId, catMap).localeCompare(budgetLabel(b.categoryId, catMap), 'ko');
  });

  async function remove(budget: Budget) {
    const name = budgetLabel(budget.categoryId, catMap);
    if (confirm(`${name} 예산을 삭제할까요?`)) await deleteBudget(budget.id);
  }

  const blank = (): Budget => ({
    id: nanoid(),
    categoryId: firstUnusedBudgetCategory(budgets, expenseCategories),
    amount: 0,
    isActive: true,
  });

  return (
    <>
      <AppHead title="예산 설정" right={<span className="num text-[13px] font-semibold text-sub">{budgets.filter((b) => b.isActive).length}개 사용</span>} />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-3.5 rounded-[13px] bg-surface px-3.5 py-3 shadow-card">
          <div className="mb-1.5 text-[11px] font-semibold text-sub">이번 달 지출</div>
          <div className="num text-xl font-extrabold">{won(data.totalExpense)}원</div>
          <div className="mt-1 text-[11px] font-semibold text-faint">예산은 매월 반복 적용되고, 지출 거래에서 실시간 계산돼요.</div>
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sub">등록된 예산</div>
        {sortedBudgets.length === 0 && (
          <div className="mb-3.5 rounded-[13px] bg-surface px-4 py-7 text-center text-[13px] font-semibold text-faint shadow-card">
            등록된 예산이 없어요.
          </div>
        )}

        {sortedBudgets.map((budget) => {
          const progress = progressMap.get(budget.id);
          const ratio = progress?.ratio ?? 0;
          const spent = progress?.spent ?? 0;
          const status = progress?.status ?? 'ok';
          return (
            <div key={budget.id} className={`mb-2 rounded-[13px] bg-surface px-[15px] py-3.5 shadow-card ${budget.isActive ? '' : 'opacity-55'}`}>
              <div className="mb-2 flex items-start gap-3">
                <button onClick={() => setEditing(budget)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[14px] font-extrabold">{budgetLabel(budget.categoryId, catMap)}</div>
                  <div className="num mt-0.5 text-[11px] font-semibold text-sub">
                    {won(spent)} / {won(budget.amount)}원 · {pct(ratio)}
                    {!budget.isActive && ' · 꺼짐'}
                  </div>
                </button>
                <button onClick={() => remove(budget)} className="rounded-lg bg-warn-bg px-2.5 py-1.5 text-[11px] font-bold text-warn">삭제</button>
              </div>
              <div className="h-[8px] overflow-hidden rounded-md bg-line2">
                <i
                  className={`block h-full rounded-md ${status === 'over' ? 'bg-warn' : status === 'near' ? 'bg-[#D9A52A]' : 'bg-ink'}`}
                  style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                />
              </div>
            </div>
          );
        })}

        <AddButton onClick={() => setEditing(blank())}>＋ 예산 추가</AddButton>
      </div>

      {editing && (
        <BudgetForm
          budget={editing}
          budgets={budgets}
          categories={expenseCategories}
          catMap={catMap}
          onClose={() => setEditing(null)}
          onSave={async (budget) => {
            await saveBudget(budget);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function BudgetForm({
  budget,
  budgets,
  categories,
  catMap,
  onClose,
  onSave,
}: {
  budget: Budget;
  budgets: Budget[];
  categories: Category[];
  catMap: Map<string, Category>;
  onClose: () => void;
  onSave: (budget: Budget) => void;
}) {
  const [draft, setDraft] = useState<Budget>(budget);
  const targetValue = draft.categoryId ?? ALL_BUDGET;
  const isNew = !budgets.some((b) => b.id === budget.id);

  function save() {
    const duplicate = budgets.some((b) => b.id !== draft.id && (b.categoryId ?? ALL_BUDGET) === (draft.categoryId ?? ALL_BUDGET));
    if (duplicate) {
      alert('이미 같은 대상의 예산이 있어요.');
      return;
    }
    if (draft.amount <= 0) return;
    onSave(draft);
  }

  return (
    <Modal title={isNew ? '예산 추가' : '예산 편집'} onClose={onClose}>
      <Labeled label="대상">
        <select
          value={targetValue}
          onChange={(e) => setDraft({ ...draft, categoryId: e.target.value === ALL_BUDGET ? null : e.target.value })}
          className="w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5 text-[14px] outline-none"
        >
          <option value={ALL_BUDGET}>전체 예산</option>
          {categories.map((c) => {
            const parent = c.parentId ? catMap.get(c.parentId) : undefined;
            return (
              <option key={c.id} value={c.id}>
                {parent ? `${parent.icon} ${parent.name} › ${c.name}` : `${c.icon} ${c.name}`}
              </option>
            );
          })}
        </select>
      </Labeled>
      <Labeled label="월 예산 (원)">
        <NumberField value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} />
      </Labeled>
      <div className="mb-3 flex items-center justify-between rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5">
        <span className="text-[13px] font-semibold">사용 중</span>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} />
      </div>
      <PrimaryButton onClick={save}>저장</PrimaryButton>
    </Modal>
  );
}

function categorySort(all: Category[]) {
  const catMap = new Map(all.map((c) => [c.id, c]));
  return (a: Category, b: Category) => {
    const aParent = a.parentId ? catMap.get(a.parentId) : a;
    const bParent = b.parentId ? catMap.get(b.parentId) : b;
    if ((aParent?.sortOrder ?? 0) !== (bParent?.sortOrder ?? 0)) return (aParent?.sortOrder ?? 0) - (bParent?.sortOrder ?? 0);
    if (a.parentId === null && b.parentId !== null) return -1;
    if (a.parentId !== null && b.parentId === null) return 1;
    return a.sortOrder - b.sortOrder;
  };
}

function budgetLabel(categoryId: string | null, catMap: Map<string, Category>): string {
  if (categoryId === null) return '전체 예산';
  const category = catMap.get(categoryId);
  if (!category) return '삭제된 카테고리';
  if (!category.parentId) return `${category.icon} ${category.name}`;
  const parent = catMap.get(category.parentId);
  return `${parent?.icon ?? category.icon} ${parent?.name ?? '상위'} › ${category.name}`;
}

function firstUnusedBudgetCategory(budgets: Budget[], categories: Category[]): string | null {
  const used = new Set(budgets.map((b) => b.categoryId ?? ALL_BUDGET));
  if (!used.has(ALL_BUDGET)) return null;
  return categories.find((c) => !used.has(c.id))?.id ?? null;
}
