import { useState } from "react";
import { useNavigate } from "react-router";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { format } from "date-fns";
import { getCurrentTime24 } from "@/lib/time";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { ExpenseList } from "@/components/expenses/ExpenseCard";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useMonthSummary, useRecentExpenses, useCategories } from "@/hooks/useExpenseData";
import { useAccountBalances, useAccounts } from "@/hooks/useAccounts";
import { deleteExpense } from "@/db/expenseTrackerDb";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Expense } from "@/types/expense";
import { useIsMobile } from "@/hooks/use-mobile";

export function FloatingActionButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/add")}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center  z-50 fab"
      aria-label="Add transaction"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const isMobile = useIsMobile();

  const accounts = useAccounts() || [];
  const { balances, totalBalance } = useAccountBalances();
  
  const displayBalance = selectedAccountId === "all" ? totalBalance : (balances[selectedAccountId] || 0);

  const { totalExpense, totalIncome, monthStart, monthEnd } = useMonthSummary(
    selectedAccountId === "all" ? undefined : selectedAccountId
  );
  const { currency, formatValue } = useCurrency();
  const categories = useCategories();
  const displayExpenses = useRecentExpenses(10, selectedAccountId === "all" ? undefined : selectedAccountId);

  const handleExpenseClick = (expense: Expense) => {
    navigate(`/expense/${expense.id}`);
  };

  const handleDuplicate = (expense: Expense) => {
    navigate("/add", {
      state: {
        duplicate: {
          ...expense,
          date: format(new Date(), "yyyy-MM-dd"),
          time: getCurrentTime24(),
        },
      },
    });
  };

  const handleEdit = (expense: Expense) => {
    navigate(`/expense/${expense.id}/edit`);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteExpense(expenseToDelete.id);
      toast.success("Transaction deleted");
    } catch {
      toast.error("Failed to delete");
    }
    setExpenseToDelete(null);
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Monthly Summary Card */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="summary-card space-y-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm opacity-80 font-medium">Total Balance</p>
              <p className="text-3xl font-bold">
                {displayBalance < 0 ? "-" : ""}{currency.symbol}{formatValue(Math.abs(displayBalance))}
              </p>
            </div>
            
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[140px] h-9 bg-background/20 border-primary-foreground/20 text-primary-foreground text-xs shadow-none hover:bg-background/30 transition-colors">
                <SelectValue placeholder="All Accounts">
                  {selectedAccountId === "all" ? "All Accounts" : accounts.find(a => a.id === selectedAccountId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <CategoryIcon icon={account.icon} color={account.color} size="sm" />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary-foreground/20">
            <div>
              <p className="text-xs opacity-80">Income (This Month)</p>
              <p className="text-lg font-semibold">+{currency.symbol}{formatValue(totalIncome)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Expenses (This Month)</p>
              <p className="text-lg font-semibold">-{currency.symbol}{formatValue(totalExpense)}</p>
            </div>
          </div>
        </m.div>

        {/* Recent Transactions */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            {displayExpenses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/transactions")}
                className="text-primary"
              >
                See All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          <ExpenseList
            expenses={displayExpenses}
            categories={categories}
            onExpenseClick={handleExpenseClick}
            onDuplicate={handleDuplicate}
            onEdit={handleEdit}
            onDelete={(expense) => setExpenseToDelete(expense)}
            emptyMessage={"No transactions yet. Add your first one!"}
          />
        </m.div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LazyMotion>
  );
}
