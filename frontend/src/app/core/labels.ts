import { ImportBatch, TransactionType } from './models';

export interface Option<T> {
  label: string;
  value: T;
}

export const TRANSACTION_TYPE_OPTIONS: Option<TransactionType>[] = [
  { label: 'Výdavok', value: 'EXPENSE' },
  { label: 'Príjem', value: 'INCOME' },
];

export function transactionTypeLabel(type: TransactionType): string {
  return type === 'EXPENSE' ? 'Výdavok' : 'Príjem';
}

export function isTransactionType(value: unknown): value is TransactionType {
  return value === 'EXPENSE' || value === 'INCOME';
}

export const IMPORT_STATUS_LABELS: Record<ImportBatch['status'], string> = {
  PENDING: 'Prebieha',
  COMPLETED: 'Dokončený',
  FAILED: 'Zlyhal',
};

/** Slovak has three plural forms: 1 transakcia, 2–4 transakcie, 5+ transakcií. */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count);
  if (n === 1) {
    return one;
  }
  return n >= 2 && n <= 4 ? few : many;
}
