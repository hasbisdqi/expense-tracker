import { useLiveQuery } from "dexie-react-hooks";
import { db, getAllAccounts } from "@/db/expenseTrackerDb";
import { Account } from "@/types/expense";
import { useMemo } from "react";
import { useExpenses } from "./useExpenseData";

export function useAccounts() {
  const accounts = useLiveQuery(() => getAllAccounts(), [], []);
  return accounts as Account[];
}

export function useAccount(id: string | undefined) {
  const account = useLiveQuery(() => (id ? db.accounts.get(id) : undefined), [id], undefined);
  return account;
}

export function useAccountBalances() {
  const expenses = useExpenses() || [];
  const accounts = useAccounts() || [];

  return useMemo(() => {
    const balances: Record<string, number> = {};

    for (const account of accounts) {
      balances[account.id] = 0;
    }

    for (const expense of expenses) {
      if (expense.type === "income") {
        if (balances[expense.accountId] !== undefined) balances[expense.accountId] += expense.value;
      } else if (expense.type === "expense") {
        if (balances[expense.accountId] !== undefined) balances[expense.accountId] -= expense.value;
      } else if (expense.type === "transfer") {
        if (balances[expense.accountId] !== undefined) balances[expense.accountId] -= expense.value;
        if (expense.toAccountId && balances[expense.toAccountId] !== undefined) {
          balances[expense.toAccountId] += expense.value;
        }
      }
    }

    // calculate total balance
    const totalBalance = Object.values(balances).reduce((sum, bal) => sum + bal, 0);

    return { balances, totalBalance };
  }, [expenses, accounts]);
}
