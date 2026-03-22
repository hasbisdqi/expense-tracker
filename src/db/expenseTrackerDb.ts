import Dexie, { Table } from "dexie";
import { Expense, Category, TagMetadata, Account } from "@/types/expense";
import { v4 as uuidv4 } from "uuid";

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
  await db.expenses.update(id, { ...updates, updatedAt: now });

  // Update tag metadata for new tags
  if (updates.tags) {
    for (const tag of updates.tags) {
      await updateTagMetadata(tag);
    }
  }
}

export async function deleteExpense(id: string): Promise<void> {
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

  await db.categories.add({
    ...category,
    id,
    createdAt: now,
  });

  return id;
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<Category, "id" | "createdAt">>,
): Promise<void> {
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
      await db.expenses.update(expense.id, { category: moveToCategory });
    }
  } else {
    // Delete all expenses in this category
    await db.expenses.where("category").equals(id).delete();
  }

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

// Account CRUD operations
export async function addAccount(account: Omit<Account, "id" | "createdAt">): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.accounts.add({
    ...account,
    id,
    createdAt: now,
  });

  return id;
}

export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, "id" | "createdAt">>,
): Promise<void> {
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
      await db.expenses.update(exp.id, { accountId: moveToAccountId });
    }
    const transfersTo = await db.expenses.filter(e => e.type === "transfer" && e.toAccountId === id).toArray();
    for (const transfer of transfersTo) {
      await db.expenses.update(transfer.id, { toAccountId: moveToAccountId });
    }
  } else {
    // Delete all transactions linked to this account
    await db.expenses.where("accountId").equals(id).delete();
    const transfersTo = await db.expenses.filter(e => e.type === "transfer" && e.toAccountId === id).toArray();
    for (const transfer of transfersTo) {
      await db.expenses.delete(transfer.id);
    }
  }

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
}> {
  const expenses = await db.expenses.toArray();
  const categories = await db.categories.toArray();
  const accounts = await db.accounts.toArray();
  return { expenses, categories, accounts };
}

// Import data
export async function importData(data: {
  expenses: Expense[];
  categories: Category[];
  accounts?: Account[];
}): Promise<void> {
  await db.transaction("rw", [db.expenses, db.categories, db.tagMetadata, db.accounts], async () => {
    // Clear existing data
    await db.expenses.clear();
    await db.categories.clear();
    await db.tagMetadata.clear();
    await db.accounts.clear();

    // Import categories
    await db.categories.bulkAdd(data.categories);

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
