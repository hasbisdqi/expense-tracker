import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { useBudgetCalculations, useBudgets } from "@/hooks/useExpenseData";
import { deleteBudget } from "@/db/expenseTrackerDb";
import { toast } from "sonner";

export default function BudgetsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const budgetCalculations = useBudgetCalculations();
  const rawBudgets = useBudgets();

  const handleEdit = (id: string) => {
    setEditingBudgetId(id);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      toast.success("Budget deleted");
      if (editingBudgetId === id) {
        setIsAddOpen(false);
        setEditingBudgetId(null);
      }
    } catch {
      toast.error("Failed to delete budget");
    }
  };

  const editingBudget = useMemo(() => {
    if (!editingBudgetId) return undefined;
    return rawBudgets.find(b => b.id === editingBudgetId);
  }, [editingBudgetId, rawBudgets]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">Envelope budgeting across custom categories</p>
        </div>
        <Button
          onClick={() => {
            setEditingBudgetId(null);
            setIsAddOpen(true);
          }}
          size="sm"
          className="rounded-full shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Budget
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 pb-20">
        <div className="max-w-2xl mx-auto py-4 space-y-4">
          {budgetCalculations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Budgets Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create custom budgets to group categories together and enforce multiple limits at once.
              </p>
              <Button onClick={() => setIsAddOpen(true)} className="rounded-full px-6">Create First Budget</Button>
            </div>
          ) : (
            budgetCalculations.map(budget => (
              <div key={budget.budgetId}>
                <BudgetCard budget={budget} onClick={() => handleEdit(budget.budgetId)} />
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBudgetId ? "Edit Budget" : "New Budget"}</DialogTitle>
          </DialogHeader>
          <BudgetForm
            budget={editingBudget}
            onSuccess={(id) => {
              setIsAddOpen(false);
              setEditingBudgetId(null);
            }}
            onCancel={() => {
              setIsAddOpen(false);
              setEditingBudgetId(null);
            }}
          />
          {editingBudgetId && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button variant="destructive" onClick={() => handleDelete(editingBudgetId)}>
                Delete Budget
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
