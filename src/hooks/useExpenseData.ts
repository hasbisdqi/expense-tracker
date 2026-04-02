import { useLiveQuery } from "dexie-react-hooks";
import { db, getAllExpenses, getAllCategories, getAllTags, getAllBudgets } from "@/db/expenseTrackerDb";
import {
  Expense,
  ExpenseFilters,
  AnalysisSummary,
  CategorySummary,
  DailySummary,
  Budget
} from "@/types/expense";
import { useMemo } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
} from "date-fns";

export function useExpenses() {
  const expenses = useLiveQuery(() => getAllExpenses(), [], []);
  return expenses as Expense[];
}

export function useCategories() {
  const categories = useLiveQuery(() => getAllCategories(), [], []);
  return categories;
}

export function useTags() {
  const tags = useLiveQuery(() => getAllTags(), [], []);
  return tags;
}

export function useCategory(id: string | undefined) {
  const category = useLiveQuery(() => (id ? db.categories.get(id) : undefined), [id], undefined);
  return category;
}

export function useBudgets() {
  const budgets = useLiveQuery(() => getAllBudgets(), [], []);
  return budgets || [];
}

export function useExpense(id: string | undefined) {
  const expense = useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id], undefined);
  return expense;
}

export function useCategoryExpenseCounts() {
  const expenses = useExpenses();

  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const expense of expenses) {
      counts[expense.category] = (counts[expense.category] || 0) + 1;
    }
    return counts;
  }, [expenses]);
}

export function useFilteredExpenses(filters: ExpenseFilters = {}) {
  const expenses = useExpenses();
  const categories = useCategories();

  return useMemo(() => {
    let filtered = [...expenses];

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter((expense) => {
        const category = categories.find((c) => c.id === expense.category);
        return (
          expense.description?.toLowerCase().includes(search) ||
          category?.name.toLowerCase().includes(search) ||
          expense.tags.some((tag) => tag.toLowerCase().includes(search))
        );
      });
    }

    // Account filter
    if (filters.accounts && filters.accounts.length > 0) {
      filtered = filtered.filter((expense) => {
        if (expense.type === "transfer" && expense.toAccountId) {
          return filters.accounts!.includes(expense.accountId) || filters.accounts!.includes(expense.toAccountId);
        }
        return filters.accounts!.includes(expense.accountId);
      });
    }

    // Type filter
    if (filters.types && filters.types.length > 0) {
      filtered = filtered.filter((expense) => filters.types!.includes(expense.type || "expense"));
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter((expense) => filters.categories!.includes(expense.category));
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((expense) =>
        expense.tags.some((tag) => filters.tags!.includes(tag)),
      );
    }

    // Date range filter
    if (filters.dateRange) {
      filtered = filtered.filter((expense) => {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, {
          start: filters.dateRange!.start,
          end: filters.dateRange!.end,
        });
      });
    }

    // Adhoc filter
    if (filters.includeAdhoc === false) {
      filtered = filtered.filter((expense) => !expense.isAdhoc);
    }

    return filtered;
  }, [expenses, categories, filters]);
}

export function useAnalysisSummary(filters: ExpenseFilters): AnalysisSummary {
  const filteredExpenses = useFilteredExpenses(filters);
  const categories = useCategories();

  return useMemo(() => {
    const expensesOnly = filteredExpenses.filter((exp) => exp.type === "expense" || !exp.type);
    const incomeOnly = filteredExpenses.filter((exp) => exp.type === "income");

    const totalExpenses = expensesOnly.reduce((sum, exp) => sum + exp.value, 0);
    const totalIncome = incomeOnly.reduce((sum, exp) => sum + exp.value, 0);
    const totalTransactions = filteredExpenses.length;
    
    const expenseCount = expensesOnly.length;
    const averageExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

    // Category breakdown
    const categoryTotals: Record<string, { total: number; count: number }> = {};

    for (const expense of expensesOnly) {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = { total: 0, count: 0 };
      }
      categoryTotals[expense.category].total += expense.value;
      categoryTotals[expense.category].count += 1;
    }

    const categoryBreakdown: CategorySummary[] = Object.entries(categoryTotals)
      .map(([categoryId, { total, count }]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          categoryName: category?.name || "Unknown",
          categoryColor: category?.color || "#64748B",
          categoryIcon: category?.icon || "MoreHorizontal",
          total,
          count,
          percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    const topCategory = categoryBreakdown[0] || null;

    // Daily trend (Expenses only)
    const dailyTotals: Record<string, { total: number; count: number }> = {};

    for (const expense of expensesOnly) {
      if (!dailyTotals[expense.date]) {
        dailyTotals[expense.date] = { total: 0, count: 0 };
      }
      dailyTotals[expense.date].total += expense.value;
      dailyTotals[expense.date].count += 1;
    }

    const dailyTrend: DailySummary[] = Object.entries(dailyTotals)
      .map(([date, { total, count }]) => ({ date, total, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalExpenses,
      totalIncome,
      totalTransactions,
      averageExpense,
      topCategory,
      categoryBreakdown,
      dailyTrend,
    };
  }, [filteredExpenses, categories]);
}

export function useMonthSummary(accountId?: string) {
  const expenses = useExpenses();

  return useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let totalExpense = 0;
    let totalIncome = 0;
    let totalExcludingAdhoc = 0;

    for (const expense of expenses) {
      if (accountId && expense.accountId !== accountId && expense.toAccountId !== accountId) {
        continue;
      }

      const expenseDate = parseISO(expense.date);
      if (isWithinInterval(expenseDate, { start: monthStart, end: monthEnd })) {
        if (expense.type === "expense" || !expense.type) {
          totalExpense += expense.value;
          if (!expense.isAdhoc) {
            totalExcludingAdhoc += expense.value;
          }
        } else if (expense.type === "income") {
          totalIncome += expense.value;
        }
      }
    }

    return {
      total: totalExpense, // backward compatible name for UI
      totalExpense,
      totalIncome,
      totalExcludingAdhoc,
      monthStart,
      monthEnd,
    };
  }, [expenses, accountId]);
}

export function useRecentExpenses(limit: number = 10, accountId?: string) {
  const expenses = useExpenses();

  return useMemo(() => {
    let filtered = expenses;
    if (accountId) {
      filtered = filtered.filter(e => e.accountId === accountId || e.toAccountId === accountId);
    }
    return filtered.slice(0, limit);
  }, [expenses, limit, accountId]);
}

export function getDateRangeForPeriod(
  period: "week" | "month" | "year",
  anchorDate?: Date,
  customRange?: { start: Date; end: Date },
) {
  const date = anchorDate || new Date();

  switch (period) {
    case "week":
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
    default:
      return customRange || { start: startOfMonth(date), end: endOfMonth(date) };
  }
}

export interface BudgetProgress {
  period: "daily" | "weekly" | "monthly" | "yearly";
  spent: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  isWarning: boolean;
  isOverBudget: boolean;
}

export interface BudgetCalculations {
  budgetId: string;
  name: string;
  icon: string;
  color: string;
  categoryIds: string[];
  progress: BudgetProgress[];
}

export function useBudgetCalculations(accountId?: string): BudgetCalculations[] {
  const budgets = useBudgets();
  const expenses = useExpenses();

  return useMemo(() => {
    const now = new Date();
    
    const bounds = {
      daily: { start: startOfDay(now), end: endOfDay(now) },
      weekly: { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
      monthly: { start: startOfMonth(now), end: endOfMonth(now) },
      yearly: { start: startOfYear(now), end: endOfYear(now) },
    };

    const results: BudgetCalculations[] = [];
    
    for (const budget of budgets) {
      const progress: BudgetProgress[] = [];
      const catIds = new Set(budget.categoryIds);
      
      const relevantExpenses = expenses.filter(expense => {
        if (accountId && expense.accountId !== accountId && expense.toAccountId !== accountId) return false;
        if (expense.type && expense.type !== "expense") return false;
        return catIds.has(expense.category);
      });

      const calculateProgress = (period: "daily" | "weekly" | "monthly" | "yearly", limit: number) => {
        const periodBounds = bounds[period];
        let spent = 0;
        
        for (const expense of relevantExpenses) {
          const expenseDate = parseISO(expense.date);
          if (isWithinInterval(expenseDate, { start: periodBounds.start, end: periodBounds.end })) {
             spent += expense.value;
          }
        }
        
        const remaining = limit - spent;
        return {
          period,
          limit,
          spent,
          remaining,
          percentageUsed: (spent / limit) * 100,
          isWarning: remaining > 0 && remaining < limit * 0.2,
          isOverBudget: remaining < 0
        };
      };

      if (budget.dailyAmount && budget.dailyAmount > 0) {
        progress.push(calculateProgress("daily", budget.dailyAmount));
      }
      if (budget.weeklyAmount && budget.weeklyAmount > 0) {
        progress.push(calculateProgress("weekly", budget.weeklyAmount));
      }
      if (budget.monthlyAmount && budget.monthlyAmount > 0) {
        progress.push(calculateProgress("monthly", budget.monthlyAmount));
      }
      if (budget.yearlyAmount && budget.yearlyAmount > 0) {
        progress.push(calculateProgress("yearly", budget.yearlyAmount));
      }

      results.push({
        budgetId: budget.id,
        name: budget.name,
        icon: budget.icon,
        color: budget.color,
        categoryIds: budget.categoryIds,
        progress
      });
    }

    return results;
  }, [budgets, expenses, accountId]);
}
