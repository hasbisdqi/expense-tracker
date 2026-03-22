import { useState } from "react";
import { toast } from "sonner";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { AccountForm } from "@/components/accounts/AccountForm";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { deleteAccount } from "@/db/expenseTrackerDb";
import { Account } from "@/types/expense";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function AccountsPage() {
  const accounts = useAccounts() || [];
  const { balances, totalBalance } = useAccountBalances();
  const { currency, formatValue } = useCurrency();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteData, setDeleteData] = useState<Account | null>(null);
  const [deleteAction, setDeleteAction] = useState<"move" | "cascade">("move");
  const [moveToAccountId, setMoveToAccountId] = useState<string>("");

  const handleDelete = async () => {
    if (!deleteData) return;

    try {
      if (deleteAction === "move") {
        await deleteAccount(deleteData.id, moveToAccountId);
      } else {
        await deleteAccount(deleteData.id);
      }
      toast.success("Account deleted");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
    }
    setDeleteData(null);
  };

  const handleDeleteClick = (account: Account) => {
    if (accounts.length <= 1) {
      toast.error("You must have at least one account");
      return;
    }

    const defaultMoveTo = accounts.find((a) => a.id !== account.id)?.id || "";
    setMoveToAccountId(defaultMoveTo);
    setDeleteData(account);
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-semibold">Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Total Balance: {totalBalance < 0 ? "-" : ""}{currency.symbol}{formatValue(Math.abs(totalBalance))}
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Account
          </Button>
        </m.div>

        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts.map((account, index) => (
              <m.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-4 rounded-xl bg-card border border-border/50",
                  "flex items-center gap-3",
                  "hover:border-primary/20 transition-colors",
                )}
              >
                <CategoryIcon icon={account.icon} color={account.color} size="lg" />

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{account.name}</p>
                  <p className={cn("text-sm", balances[account.id] < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {balances[account.id] < 0 ? "-" : ""}{currency.symbol}{formatValue(Math.abs(balances[account.id] || 0))}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8"
                     onClick={() => setEditAccount(account)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(account)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </m.div>
            ))}
          </div>
        </m.div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
            </DialogHeader>
            <AccountForm
              onSuccess={() => setShowCreateDialog(false)}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={!!editAccount} onOpenChange={() => setEditAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            {editAccount && (
              <AccountForm
                account={editAccount}
                onSuccess={() => setEditAccount(null)}
                onCancel={() => setEditAccount(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteData} onOpenChange={() => setDeleteData(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteData?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This account has transactions associated with it. What would you like to do?
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteData && (
              <div className="space-y-4 py-4">
                <RadioGroup
                  value={deleteAction}
                  onValueChange={(v) => setDeleteAction(v as "move" | "cascade")}
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="move" id="move" />
                    <div className="space-y-1">
                      <Label htmlFor="move">Move transactions to another account</Label>
                      {deleteAction === "move" && (
                        <Select value={moveToAccountId} onValueChange={setMoveToAccountId}>
                          <SelectTrigger className="w-full mt-2">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts
                              .filter((a) => a.id !== deleteData.id)
                              .map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  <div className="flex items-center gap-2">
                                    <CategoryIcon icon={a.icon} color={a.color} size="sm" />
                                    {a.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="cascade" id="cascade" />
                    <div className="space-y-1">
                      <Label htmlFor="cascade" className="text-destructive">
                        Delete all associated transactions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        This will permanently delete all transactions linked to this account
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteAction === "move" && !moveToAccountId}
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
