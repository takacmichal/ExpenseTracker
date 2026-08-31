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
  color: string | null;
  icon: string | null;
  type: TransactionType;
  parentId: string | null;
  parentName: string | null;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  type: TransactionType;
  source: TransactionSource;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
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
  categoryId: string | null;
  categoryName: string | null;
  color: string | null;
  icon: string | null;
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
  date: string | null;
  amount: number | null;
  description: string | null;
  type: TransactionType | null;
  counterparty: string | null;
  currency: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  error: string | null;
}

export interface ImportPreview {
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  categorisedRows: number;
  rows: ParsedRow[];
}

export interface ImportBatch {
  id: string;
  filename: string;
  importedAt: string;
  rowCount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
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
  color: string | null;
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
  grossAmount: number | null;
  employer: string | null;
  note: string | null;
  transactionId: string | null;
}

export interface IncomePayload {
  date: string;
  netAmount: number;
  grossAmount: number | null;
  employer: string | null;
  note: string | null;
  transactionId: string | null;
}
