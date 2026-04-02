// Expense Tracker Type Definitions

export type TransactionType = "expense" | "income" | "transfer";

export interface Account {
  id: string;
  user_id?: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  user_id?: string;
  type: TransactionType;
  accountId: string;
  toAccountId?: string; // used for transfers
  value: number;
  category: string; // Category ID (can be empty string for transfers)
  description?: string;
  tags: string[];
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // HH:mm format
  isAdhoc: boolean;
  attachment?: string; // base64 encoded image
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  icon: string; // Lucide icon name
  color: string; // Hex color code
  isDefault?: boolean; // Cannot delete default categories
  createdAt: string;
}

export interface Budget {
  id: string;
  user_id?: string;
  name: string;
  categoryIds: string[]; // List of category IDs
  dailyAmount?: number;
  weeklyAmount?: number;
  monthlyAmount?: number;
  yearlyAmount?: number;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  action: "insert" | "update" | "delete";
  table: string;
  recordId: string;
  data?: any;
  createdAt: string;
}

export interface TagMetadata {
  tag: string;
  count: number;
  lastUsed: string; // ISO timestamp
}

// Form types
export interface AccountFormData {
  name: string;
  icon: string;
  color: string;
}

export interface ExpenseFormData {
  type: TransactionType;
  accountId: string;
  toAccountId?: string;
  value: number | null;
  category: string;
  description?: string;
  tags: string[];
  date: string;
  time: string;
  isAdhoc: boolean;
  attachment?: string;
}

export interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
}

export interface BudgetFormData {
  name: string;
  categoryIds: string[];
  dailyAmount?: number | null;
  weeklyAmount?: number | null;
  monthlyAmount?: number | null;
  yearlyAmount?: number | null;
  icon: string;
  color: string;
}

// Filter types
export type TimePeriod = "week" | "month" | "year" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ExpenseFilters {
  search?: string;
  categories?: string[];
  accounts?: string[];
  types?: TransactionType[];
  tags?: string[];
  dateRange?: DateRange;
  includeAdhoc?: boolean;
  timePeriod?: TimePeriod;
}

// Analysis types
export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  total: number;
  count: number;
  percentage: number;
}

export interface DailySummary {
  date: string;
  total: number;
  count: number;
}

export interface AnalysisSummary {
  totalExpenses: number;
  totalIncome: number;
  totalTransactions: number;
  averageExpense: number;
  topCategory: CategorySummary | null;
  categoryBreakdown: CategorySummary[];
  dailyTrend: DailySummary[];
}

// Export types
export type ExportFormat = "csv" | "json";

export interface ExportOptions {
  format: ExportFormat;
  includeAttachments: boolean;
  respectFilters: boolean;
}

// Theme types
export type Theme = "light" | "dark" | "system";

// Navigation
export type NavTab = "home" | "add" | "categories" | "analysis";

// Context menu for long press
export interface ContextMenuAction {
  id: string;
  label: string;
  icon: string;
  variant?: "default" | "destructive";
  onClick: () => void;
}
