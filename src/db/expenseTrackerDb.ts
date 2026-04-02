import Dexie, { Table } from "dexie";
import { Expense, Category, TagMetadata, Account, SyncQueueItem, Budget } from "@/types/expense";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { toSupabase, processSyncQueue } from "./sync";

// Category colors palette
export const CATEGORY_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#64748B",
  "#0F172A",
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#CA8A04",
  "#65A30D",
  "#16A34A",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#9333EA",
  "#C026D3",
  "#DB2777",
  "#E11D48",
];

// Default categories to seed
export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  {
    name: "Food & Dining",
    icon: "UtensilsCrossed",
    color: "#F97316",
    isDefault: true,
  },
  { name: "Shopping", icon: "ShoppingBag", color: "#EC4899", isDefault: true },
  { name: "Transport", icon: "Car", color: "#3B82F6", isDefault: true },
  { name: "Medical", icon: "Heart", color: "#EF4444", isDefault: true },
  { name: "Bills", icon: "FileText", color: "#8B5CF6", isDefault: true },
  { name: "Entertainment", icon: "Tv", color: "#10B981", isDefault: true },
  { name: "Others", icon: "MoreHorizontal", color: "#64748B", isDefault: true },
];

class ExpenseDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  tagMetadata!: Table<TagMetadata, string>;
  accounts!: Table<Account, string>;
  budgets!: Table<Budget, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super("ExpenseTrackerDB");

    // Version 1: initial schema
    this.version(1).stores({
      expenses: "id, category, date, isAdhoc, *tags, createdAt",
      categories: "id, &name",
      tagMetadata: "tag, count, lastUsed",
    });

    // Version 2: add compound index [date+time] to expenses
    this.version(2).stores({
      expenses: "id, category, date, time, [date+time], isAdhoc, *tags, createdAt",
      categories: "id, &name",
      tagMetadata: "tag, count, lastUsed",
    });

    // Version 3: add accounts, update expenses to include type and accountId
    this.version(3).stores({
      expenses: "id, category, accountId, type, date, time, [date+time], isAdhoc, *tags, createdAt",
      categories: "id, &name",
      tagMetadata: "tag, count, lastUsed",
      accounts: "id, &name",
    }).upgrade(async (trans) => {
      let defaultAccountId = "";
      const accountsCount = await trans.table("accounts").count();
      if (accountsCount === 0) {
        defaultAccountId = uuidv4();
        await trans.table("accounts").add({
          name: "Main",
          icon: "Wallet",
          color: "#3B82F6",
          id: defaultAccountId,
          createdAt: new Date().toISOString(),
        });
      } else {
        const firstAccount = await trans.table("accounts").toCollection().first();
        if (firstAccount) defaultAccountId = firstAccount.id;
      }

      if (defaultAccountId) {
        await trans.table("expenses").toCollection().modify((expense) => {
          if (!expense.type) expense.type = "expense";
          if (!expense.accountId) expense.accountId = defaultAccountId;
        });
      }
    });

    // Version 4: sync_queue and updated schemas
    this.version(4).stores({
      expenses: "id, category, accountId, type, date, time, [date+time], isAdhoc, *tags, createdAt, updatedAt",
      categories: "id, &name, updatedAt",
      tagMetadata: "tag, count, lastUsed",
      accounts: "id, &name, updatedAt",
      sync_queue: "id, action, table, recordId, createdAt",
    });

    // Version 5: remove unique constraint on name for categories and accounts to prevent sync collisions
    this.version(5).stores({
      categories: "id, name, updatedAt",
      accounts: "id, name, updatedAt",
    });

    // Version 6: budgets and removed budgets from categories
    this.version(6).stores({
      budgets: "id, name, updatedAt",
    });
  }
}

export const db = new ExpenseDatabase();

// Default account to seed if missing
export const DEFAULT_ACCOUNT: Omit<Account, "id" | "createdAt"> = {
  name: "Main",
  icon: "Wallet",
  color: "#3B82F6",
};

// Initialize database with default categories and accounts
export async function initializeDatabase(): Promise<void> {
  const categoryCount = await db.categories.count();
  const accountCount = await db.accounts.count();

  const now = new Date().toISOString();

  if (accountCount === 0) {
    await db.accounts.add({
      ...DEFAULT_ACCOUNT,
      id: uuidv4(),
      createdAt: now,
    });
    console.log("Default account initialized");
  }

  if (categoryCount === 0) {
    const categories: Category[] = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      id: uuidv4(),
      createdAt: now,
    }));

    await db.categories.bulkAdd(categories);
    console.log("Default categories initialized");
  }
}

export async function linkDataToUser(userId: string): Promise<void> {
  await db.transaction("rw", [db.expenses, db.categories, db.accounts, db.budgets], async () => {
    await db.accounts.toCollection().modify((acc) => {
      if (!acc.user_id) acc.user_id = userId;
    });
    await db.categories.toCollection().modify((cat) => {
      if (!cat.user_id) cat.user_id = userId;
    });
    await db.expenses.toCollection().modify((exp) => {
      if (!exp.user_id) exp.user_id = userId;
    });
    await db.budgets.toCollection().modify((budget) => {
      if (!budget.user_id) budget.user_id = userId;
    });
  });
}

async function executeOnlineFirst(
  action: "insert" | "update" | "delete",
  table: string,
  recordId: string,
  localData: any = null
) {
  let isOffline = !navigator.onLine;

  try {
    if (!isOffline) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (action === "delete") {
           const { error } = await supabase.from(table).delete().eq("id", recordId);
           if (error) throw error;
        } else {
           const mappedData = toSupabase(table, localData, session.user.id);
           if (!mappedData) throw new Error("Mapping failed");
           const { error } = await supabase.from(table).upsert(mappedData);
           if (error) throw error;
        }
      }
    }
  } catch (e) {
    console.error("Online push failed, falling back to local queue", e);
    isOffline = true;
  }

  if (isOffline) {
     await db.sync_queue.add({
       id: uuidv4(),
       action,
       table,
       recordId,
       data: localData,
       createdAt: new Date().toISOString()
     });
     setTimeout(processSyncQueue, 100);
  }
}

// Expense CRUD operations
export async function addExpense(
  expense: Omit<Expense, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const id = uuidv4();

  const newExpense: Expense = {
    ...expense,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await executeOnlineFirst("insert", "expenses", id, newExpense);
  await db.expenses.add(newExpense);

  // Update tag metadata
  for (const tag of expense.tags) {
    await updateTagMetadata(tag);
  }

  return id;
}

export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, "id" | "createdAt">>,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error("Expense not found");

  const updatedExpense = { ...existing, ...updates, updatedAt: now };
  await executeOnlineFirst("update", "expenses", id, updatedExpense);
  await db.expenses.update(id, { ...updates, updatedAt: now });

  // Update tag metadata for new tags
  if (updates.tags) {
    for (const tag of updates.tags) {
      await updateTagMetadata(tag);
    }
  }
}

export async function deleteExpense(id: string): Promise<void> {
  await executeOnlineFirst("delete", "expenses", id);
  await db.expenses.delete(id);
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  return db.expenses.get(id);
}

// Returns all expenses ordered by date and time (descending)
export async function getAllExpenses(): Promise<Expense[]> {
  // Dexie compound sort (date+time):
  return db.expenses.orderBy("[date+time]").reverse().toArray();
}

export async function getExpensesByCategory(categoryId: string): Promise<Expense[]> {
  return db.expenses.where("category").equals(categoryId).toArray();
}

// Category CRUD operations
export async function addCategory(category: Omit<Category, "id" | "createdAt">): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const newCategory = { ...category, id, createdAt: now };

  await executeOnlineFirst("insert", "categories", id, newCategory);
  await db.categories.add(newCategory);

  return id;
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<Category, "id" | "createdAt">>,
): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) throw new Error("Category not found");

  const updatedCategory = { ...existing, ...updates };
  await executeOnlineFirst("update", "categories", id, updatedCategory);
  await db.categories.update(id, updates);
}

export async function deleteCategory(id: string, moveToCategory?: string): Promise<void> {
  const category = await db.categories.get(id);

  if (category?.isDefault && category.name === "Others") {
    throw new Error('Cannot delete the default "Others" category');
  }

  if (moveToCategory) {
    // Move all expenses to the target category
    const expenses = await db.expenses.where("category").equals(id).toArray();
    for (const expense of expenses) {
      const updatedExpense = { ...expense, category: moveToCategory, updatedAt: new Date().toISOString() };
      await executeOnlineFirst("update", "expenses", expense.id, updatedExpense);
      await db.expenses.update(expense.id, { category: moveToCategory });
    }
  } else {
    // Delete all expenses in this category
    const expenses = await db.expenses.where("category").equals(id).toArray();
    for (const expense of expenses) {
      await executeOnlineFirst("delete", "expenses", expense.id);
      await db.expenses.delete(expense.id);
    }
  }

  await executeOnlineFirst("delete", "categories", id);
  await db.categories.delete(id);
}

export async function getCategory(id: string): Promise<Category | undefined> {
  return db.categories.get(id);
}

export async function getAllCategories(): Promise<Category[]> {
  return db.categories.toArray();
}

export async function getCategoryByName(name: string): Promise<Category | undefined> {
  return db.categories.where("name").equals(name).first();
}

// Budget CRUD operations
export async function addBudget(budget: Omit<Budget, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const newBudget: Budget = { ...budget, id, createdAt: now, updatedAt: now };

  await executeOnlineFirst("insert", "budgets", id, newBudget);
  await db.budgets.add(newBudget);

  return id;
}

export async function updateBudget(
  id: string,
  updates: Partial<Omit<Budget, "id" | "createdAt">>,
): Promise<void> {
  const existing = await db.budgets.get(id);
  if (!existing) throw new Error("Budget not found");
  const now = new Date().toISOString();

  const updatedBudget = { ...existing, ...updates, updatedAt: now };
  await executeOnlineFirst("update", "budgets", id, updatedBudget);
  await db.budgets.update(id, { ...updates, updatedAt: now });
}

export async function deleteBudget(id: string): Promise<void> {
  await executeOnlineFirst("delete", "budgets", id);
  await db.budgets.delete(id);
}

export async function getBudget(id: string): Promise<Budget | undefined> {
  return db.budgets.get(id);
}

export async function getAllBudgets(): Promise<Budget[]> {
  return db.budgets.toArray();
}

// Account CRUD operations
export async function addAccount(account: Omit<Account, "id" | "createdAt">): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const newAccount = { ...account, id, createdAt: now };

  await executeOnlineFirst("insert", "accounts", id, newAccount);
  await db.accounts.add(newAccount);

  return id;
}

export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, "id" | "createdAt">>,
): Promise<void> {
  const existing = await db.accounts.get(id);
  if (!existing) throw new Error("Account not found");

  const updatedAccount = { ...existing, ...updates };
  await executeOnlineFirst("update", "accounts", id, updatedAccount);
  await db.accounts.update(id, updates);
}

export async function deleteAccount(id: string, moveToAccountId?: string): Promise<void> {
  const accountCount = await db.accounts.count();
  if (accountCount <= 1) {
    throw new Error('Cannot delete the last account');
  }

  if (moveToAccountId) {
    // Move all expenses to the target account
    const expenses = await db.expenses.where("accountId").equals(id).toArray();
    for (const exp of expenses) {
      const updatedExpense = { ...exp, accountId: moveToAccountId, updatedAt: new Date().toISOString() };
      await executeOnlineFirst("update", "expenses", exp.id, updatedExpense);
      await db.expenses.update(exp.id, { accountId: moveToAccountId });
    }
    const transfersTo = await db.expenses.filter(e => e.type === "transfer" && e.toAccountId === id).toArray();
    for (const transfer of transfersTo) {
      const updatedTransfer = { ...transfer, toAccountId: moveToAccountId, updatedAt: new Date().toISOString() };
      await executeOnlineFirst("update", "expenses", transfer.id, updatedTransfer);
      await db.expenses.update(transfer.id, { toAccountId: moveToAccountId });
    }
  } else {
    // Delete all transactions linked to this account
    const expenses = await db.expenses.where("accountId").equals(id).toArray();
    for (const exp of expenses) {
      await executeOnlineFirst("delete", "expenses", exp.id);
      await db.expenses.delete(exp.id);
    }
    const transfersTo = await db.expenses.filter(e => e.type === "transfer" && e.toAccountId === id).toArray();
    for (const transfer of transfersTo) {
      await executeOnlineFirst("delete", "expenses", transfer.id);
      await db.expenses.delete(transfer.id);
    }
  }

  await executeOnlineFirst("delete", "accounts", id);
  await db.accounts.delete(id);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id);
}

export async function getAllAccounts(): Promise<Account[]> {
  return db.accounts.toArray();
}

export async function getAccountByName(name: string): Promise<Account | undefined> {
  return db.accounts.where("name").equals(name).first();
}

// Tag operations
async function updateTagMetadata(tag: string): Promise<void> {
  const existing = await db.tagMetadata.get(tag);
  const now = new Date().toISOString();

  if (existing) {
    await db.tagMetadata.update(tag, {
      count: existing.count + 1,
      lastUsed: now,
    });
  } else {
    await db.tagMetadata.add({
      tag,
      count: 1,
      lastUsed: now,
    });
  }
}

export async function getAllTags(): Promise<TagMetadata[]> {
  return db.tagMetadata.orderBy("count").reverse().toArray();
}

export async function getTagSuggestions(limit: number = 100): Promise<string[]> {
  const tags = await db.tagMetadata.orderBy("count").reverse().limit(limit).toArray();
  return tags.map((t) => t.tag);
}

// Get unique descriptions from past expenses
export async function getDescriptionSuggestions(
  searchQuery?: string,
  limit: number = 10,
): Promise<string[]> {
  const expenses = await db.expenses.orderBy("[date+time]").reverse().toArray();

  // Filter expenses with non-empty descriptions
  const descriptions = expenses
    .filter((e) => e.description && e.description.trim() !== "")
    .map((e) => e.description!.trim());

  // Get unique descriptions
  const uniqueDescriptions = Array.from(new Set(descriptions));

  // Filter by search query if provided (case-insensitive, contains match)
  const filtered = searchQuery
    ? uniqueDescriptions.filter((desc) => desc.toLowerCase().includes(searchQuery.toLowerCase()))
    : uniqueDescriptions;

  // Return limited results
  return filtered.slice(0, limit);
}

export async function deleteTag(tag: string): Promise<void> {
  // Remove tag from all expenses
  const expenses = await db.expenses.where("tags").equals(tag).toArray();
  for (const expense of expenses) {
    const updatedTags = expense.tags.filter((t) => t !== tag);
    await db.expenses.update(expense.id, { tags: updatedTags });
  }

  await db.tagMetadata.delete(tag);
}

export async function renameTag(oldTag: string, newTag: string): Promise<void> {
  const expenses = await db.expenses.where("tags").equals(oldTag).toArray();

  for (const expense of expenses) {
    const updatedTags = expense.tags.map((t) => (t === oldTag ? newTag : t));
    await db.expenses.update(expense.id, { tags: updatedTags });
  }

  const metadata = await db.tagMetadata.get(oldTag);
  if (metadata) {
    await db.tagMetadata.delete(oldTag);
    await db.tagMetadata.put({ ...metadata, tag: newTag });
  }
}

// Get expenses count per category
export async function getCategoryExpenseCounts(): Promise<Record<string, number>> {
  const expenses = await db.expenses.toArray();
  const counts: Record<string, number> = {};

  for (const expense of expenses) {
    counts[expense.category] = (counts[expense.category] || 0) + 1;
  }

  return counts;
}

// Export all data
export async function exportAllData(): Promise<{
  expenses: Expense[];
  categories: Category[];
  accounts: Account[];
  budgets?: Budget[];
}> {
  const expenses = await db.expenses.toArray();
  const categories = await db.categories.toArray();
  const accounts = await db.accounts.toArray();
  const budgets = await db.budgets.toArray();
  return { expenses, categories, accounts, budgets };
}

// Import data
export async function importData(data: {
  expenses: Expense[];
  categories: Category[];
  accounts?: Account[];
  budgets?: Budget[];
}): Promise<void> {
  await db.transaction("rw", [db.expenses, db.categories, db.tagMetadata, db.accounts, db.budgets], async () => {
    // Clear existing data
    await db.expenses.clear();
    await db.categories.clear();
    await db.tagMetadata.clear();
    await db.accounts.clear();
    await db.budgets.clear();

    // Import categories
    await db.categories.bulkAdd(data.categories);

    // Import budgets
    if (data.budgets && data.budgets.length > 0) {
      await db.budgets.bulkAdd(data.budgets);
    }

    // Import accounts
    if (data.accounts && data.accounts.length > 0) {
      await db.accounts.bulkAdd(data.accounts);
    } else {
      // Fallback
      await db.accounts.add({
        ...DEFAULT_ACCOUNT,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      });
    }

    // Import expenses and rebuild tag metadata
    await db.expenses.bulkAdd(data.expenses);

    // Rebuild tag metadata
    const tagCounts: Record<string, number> = {};
    for (const expense of data.expenses) {
      for (const tag of expense.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const now = new Date().toISOString();
    const tagMetadata: TagMetadata[] = Object.entries(tagCounts).map(([tag, count]) => ({
      tag,
      count,
      lastUsed: now,
    }));

    await db.tagMetadata.bulkAdd(tagMetadata);
  });
}
