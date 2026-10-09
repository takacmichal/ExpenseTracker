/*
 * The backend omits null fields from JSON (`non_null` inclusion), so every nullable field of a
 * response is optional (`field?: T`), never `| null`: test it with `== null` / `??`, not `=== null`.
 * Request payloads may still send `null`; the backend reads it the same as a missing field.
 */

export type TransactionType = 'EXPENSE' | 'INCOME';
export type TransactionSource = 'MANUAL' | 'IMPORT';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: UserSummary;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  type: TransactionType;
  parentId?: string;
  parentName?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  description?: string;
  type: TransactionType;
  source: TransactionSource;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
}

export interface TransactionRequest {
  amount: number;
  date: string;
  description: string | null;
  type: TransactionType;
  accountId: string;
  categoryId: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface MonthlySummary {
  month: string;
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface CategoryTotal {
  categoryId?: string;
  categoryName?: string;
  color?: string;
  icon?: string;
  type: TransactionType;
  total: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  from: string;
  to: string;
  categories: CategoryTotal[];
}

export interface ParsedRow {
  lineNumber: number;
  date?: string;
  amount?: number;
  description?: string;
  type?: TransactionType;
  counterparty?: string;
  currency?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  error?: string;
  bankType?: string;
  /** True when the target account already holds this row; it is skipped on import. */
  duplicate: boolean;
}

export interface ImportPreview {
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  categorisedRows: number;
  duplicateRows: number;
  rows: ParsedRow[];
}

export interface ImportBatch {
  id: string;
  filename: string;
  importedAt: string;
  rowCount: number;
  /** Rows skipped because the account already held them (0 for batches before detection). */
  duplicateCount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
}

export interface MonthPoint {
  month: number;
  label: string;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
  complete: boolean;
}

export interface YearOverview {
  year: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  months: MonthPoint[];
}

export interface CategoryForecast {
  categoryName: string;
  color?: string;
  actualToDate: number;
  projectedYearEnd: number;
}

export interface Forecast {
  year: number;
  monthsUsed: number;
  actualIncome: number;
  actualExpense: number;
  actualBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  incomeMonthlyChange: number;
  expenseMonthlyChange: number;
  categories: CategoryForecast[];
}

export interface Income {
  id: string;
  date: string;
  netAmount: number;
  grossAmount?: number;
  employer?: string;
  note?: string;
  transactionId?: string;
}

export interface IncomePayload {
  date: string;
  netAmount: number;
  grossAmount: number | null;
  employer: string | null;
  note: string | null;
  transactionId: string | null;
}

export interface UndoImportResult {
  batchId: string;
  deletedTransactions: number;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  priority: number;
  active: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  categoryType: TransactionType;
}

export interface CategoryRuleRequest {
  pattern: string;
  categoryId: string;
  priority: number;
  active: boolean;
}

export interface RuleTestRequest {
  pattern: string;
  type?: TransactionType;
}

export interface RuleTestResponse {
  pattern: string;
  matchCount: number;
  /** Up to 10 matching transactions, newest first. */
  sample: Transaction[];
}

export interface Budget {
  id: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  amountLimit: number;
}

export interface BudgetRequest {
  /** Omitted for the overall monthly budget across all expenses. */
  categoryId?: string;
  amountLimit: number;
}

export interface BudgetStatus {
  budgetId: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  amountLimit: number;
  spent: number;
  /** Can be negative once the budget is exceeded. */
  remaining: number;
  /** Can exceed 100. */
  percentUsed: number;
  /** Only for the month in progress: spending extrapolated to the end of the month. */
  projectedSpend?: number;
  exceeded: boolean;
}

export interface BudgetStatusReport {
  year: number;
  month: number;
  currentMonth: boolean;
  budgets: BudgetStatus[];
}

export type BulkAction = 'SET_CATEGORY' | 'DELETE';

export interface BulkRequest {
  ids: string[];
  action: BulkAction;
  /** SET_CATEGORY only; omitted clears the category. */
  categoryId?: string;
}

export interface BulkResult {
  affected: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface RecurringPayment {
  label: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  averageAmount: number;
  occurrences: number;
  monthsSeen: number;
  lastDate: string;
  /** Median gap between charges, in days. */
  intervalDays: number;
  /** lastDate + intervalDays; in the past when the payment seems to have stopped. */
  nextExpectedDate: string;
  estimatedYearlyCost: number;
}

export interface RecurringReport {
  from: string;
  to: string;
  payments: RecurringPayment[];
}
