import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store/useAppStore';
import { AppHead, AddButton, Toggle } from '../ui/components';
import { Modal, Labeled, TextInput, PrimaryButton } from '../ui/Modal';
import type { Category } from '../db/types';

type Editing =
  | { mode: 'add-main' }
  | { mode: 'add-sub'; parentId: string }
  | { mode: 'edit'; category: Category };

export function CategoryScreen() {
  const categories = useAppStore((s) => s.categories);
  const transactions = useAppStore((s) => s.transactions);
  const saveCategory = useAppStore((s) => s.saveCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<Editing | null>(null);

  const mains = categories.filter((c) => c.type === type && c.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const usedCount = (id: string) => transactions.filter((t) => t.categoryId === id).length;

  async function remove(c: Category) {
    const childIds = categories.filter((x) => x.parentId === c.id).map((x) => x.id);
    const used = [c.id, ...childIds].reduce((n, id) => n + usedCount(id), 0);
    const msg = used > 0 ? `'${c.name}'에 연결된 거래 ${used}건이 미분류로 남습니다. 삭제할까요?` : `'${c.name}'을(를) 삭제할까요?`;
    if (confirm(msg)) await deleteCategory(c.id);
  }

  return (
    <>
      <AppHead title="카테고리 관리" />
      <div className="px-[18px] pb-[120px] pt-1.5">
        <div className="mb-1 flex rounded-xl bg-line2 p-[3px]">
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 rounded-[9px] py-[9px] text-center text-[13px] font-bold ${type === t ? 'bg-surface text-ink shadow-sm' : 'text-sub'}`}>{t === 'expense' ? '지출' : '수입'}</button>
          ))}
        </div>

        {mains.map((main) => {
          const subs = categories.filter((c) => c.parentId === main.id).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={main.id}>
              <div className="mx-0.5 mb-[9px] mt-4 flex items-center gap-2 text-[13px] font-extrabold">
                <span className="text-[15px]">{main.icon}</span>{main.name}
                {main.defaultExcluded && <span className="rounded-md bg-line2 px-2 py-[3px] text-[10px] font-bold text-sub">실적 제외</span>}
                <span className="ml-auto flex gap-2 text-[12px] font-semibold text-faint">
                  <button onClick={() => setEditing({ mode: 'edit', category: main })}>편집</button>
                  <button onClick={() => remove(main)}>삭제</button>
                </span>
              </div>
              {subs.length > 0 && (
                <div className="overflow-hidden rounded-[13px] shadow-card">
                  {subs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-[13px] border-b border-line2 bg-surface px-[15px] py-[13px] last:border-b-0">
                      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-line2 text-base">{sub.icon}</span>
                      <span className="text-[14px] font-semibold">{sub.name}</span>
                      <span className="ml-auto flex gap-2.5 text-[12px] font-semibold text-faint">
                        <button onClick={() => setEditing({ mode: 'edit', category: sub })}>편집</button>
                        <button onClick={() => remove(sub)}>삭제</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setEditing({ mode: 'add-sub', parentId: main.id })} className="mt-1.5 text-[12.5px] font-bold text-sub">＋ 소분류 추가</button>
            </div>
          );
        })}
        <div className="mt-4"><AddButton onClick={() => setEditing({ mode: 'add-main' })}>＋ 대분류 추가</AddButton></div>
      </div>

      {editing && (
        <CategoryForm
          editing={editing}
          type={type}
          existingCount={categories.length}
          onClose={() => setEditing(null)}
          onSave={async (c) => { await saveCategory(c); setEditing(null); }}
        />
      )}
    </>
  );
}

function CategoryForm({ editing, type, existingCount, onClose, onSave }: {
  editing: Editing;
  type: 'expense' | 'income';
  existingCount: number;
  onClose: () => void;
  onSave: (c: Category) => void;
}) {
  const base: Category = editing.mode === 'edit'
    ? editing.category
    : {
        id: nanoid(), name: '', type, icon: '🏷️', color: '#8C887C',
        parentId: editing.mode === 'add-sub' ? editing.parentId : null,
        defaultExcluded: false, isCustom: true, sortOrder: existingCount,
      };
  const [draft, setDraft] = useState<Category>(base);
  const isMain = draft.parentId === null;
  const title = editing.mode === 'edit' ? '카테고리 편집' : isMain ? '대분류 추가' : '소분류 추가';

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex gap-2.5">
        <Labeled label="아이콘">
          <TextInput value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} style={{ width: 64, textAlign: 'center' }} />
        </Labeled>
        <div className="flex-1"><Labeled label="이름"><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="카테고리 이름" /></Labeled></div>
      </div>
      {isMain && type === 'expense' && (
        <div className="mb-3 flex items-center justify-between rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2.5">
          <span className="text-[13px] font-semibold">카드 실적 기본 제외</span>
          <Toggle on={draft.defaultExcluded} onChange={(v) => setDraft({ ...draft, defaultExcluded: v })} />
        </div>
      )}
      <PrimaryButton onClick={() => draft.name.trim() && onSave(draft)}>저장</PrimaryButton>
    </Modal>
  );
}
