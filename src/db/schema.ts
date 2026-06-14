import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Transaction,
  Category,
  Budget,
  Benefit,
  RecurringRule,
  ImportProfile,
  MerchantRule,
  BalanceSnapshot,
  Setting,
} from './types';

// Dexie 스키마 v1 — PRD v6 §3.6 그대로.
export class SiljeokDB extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  benefits!: Table<Benefit, string>;
  recurringRules!: Table<RecurringRule, string>;
  importProfiles!: Table<ImportProfile, string>;
  merchantRules!: Table<MerchantRule, string>;
  balanceSnapshots!: Table<BalanceSnapshot, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('siljeok-ledger');
    this.version(1).stores({
      accounts: 'id, type, kind, isActive, isPinned, sortOrder',
      transactions:
        'id, date, type, accountId, toAccountId, categoryId, status, recurringId, importBatchId',
      categories: 'id, type, parentId, isCustom, sortOrder',
      budgets: 'id, categoryId, isActive',
      benefits: 'id, accountId, isActive',
      recurringRules: 'id, accountId, dayOfMonth, isActive',
      importProfiles: 'id',
      merchantRules: 'id, pattern',
      balanceSnapshots: 'id, accountId, period',
      settings: 'key',
    });
  }
}

export const db = new SiljeokDB();
