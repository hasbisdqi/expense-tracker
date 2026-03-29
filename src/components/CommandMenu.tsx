import * as React from "react";
import { useNavigate } from "react-router";
import {
  Home,
  Plus,
  List,
  Wallet,
  LayoutGrid,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Laptop,
  ArrowRight,
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Search,
  Zap,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useExpenseData";
import { addExpense } from "@/db/expenseTrackerDb";
import { format } from "date-fns";
import { getCurrentTime24 } from "@/lib/time";
import { toast } from "sonner";
import { CategoryIcon } from "./categories/CategoryIcon";
import { TransactionType } from "@/types/expense";

type Step = "initial" | "amount" | "type" | "account" | "toAccount" | "category";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [step, setStep] = React.useState<Step>("initial");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Temporary data
  const [amount, setAmount] = React.useState<number | null>(null);
  const [type, setType] = React.useState<TransactionType>("expense");
  const [selectedAccount, setSelectedAccount] = React.useState<any>(null);

  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { currency, formatValue } = useCurrency();
  const accounts = useAccounts() || [];
  const categories = useCategories() || [];
  const { balances } = useAccountBalances();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      // Handle backspace to go back a step
      if (e.key === "Backspace" && searchValue === "" && step !== "initial") {
        e.preventDefault();
        if (step === "amount") {
          setStep("initial");
        } else if (step === "type" && amount !== null) {
          // If we came from initial with amount, go all the way back
          setStep("initial");
          setAmount(null);
        } else if (step === "type") {
          // If we came from a suggestion, might have been direct to type? 
          // Actually suggestions go to type if amount is 0, or amount step if null
          setStep("initial");
        } else if (step === "account") {
          setStep(amount === 0 || amount === null ? "amount" : "type");
        } else if (step === "toAccount" || step === "category") {
          setStep("account");
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [searchValue, step, amount]);

  const reset = React.useCallback(() => {
    setStep("initial");
    setAmount(null);
    setSelectedAccount(null);
    setSearchValue("");
    setIsSubmitting(false);
  }, []);

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(reset, 200);
      return () => clearTimeout(timer);
    }
  }, [open, reset]);

  const handleSelectAmount = (val: number) => {
    setAmount(val);
    setStep("type");
    setSearchValue("");
  };

  const handleSelectType = (t: TransactionType) => {
    setType(t);
    // If no amount was set (started from suggestion), go to amount step
    if (amount === null || amount === 0) {
      setStep("amount");
    } else {
      setStep("account");
    }
    setSearchValue("");
  };

  const handleSelectAccount = (account: any) => {
    setSelectedAccount(account);
    if (type === "transfer") {
      setStep("toAccount");
    } else {
      setStep("category");
    }
    setSearchValue("");
  };

  const handleFinish = async (target: any) => {
    if (!amount || !selectedAccount || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const now = new Date();
      await addExpense({
        type,
        accountId: selectedAccount.id,
        toAccountId: type === "transfer" ? target.id : undefined,
        value: amount,
        category: type === "transfer" ? "" : target.id,
        description: `Quick Add via ⌘K`,
        tags: ["quick-add"],
        date: format(now, "yyyy-MM-dd"),
        time: getCurrentTime24(),
        isAdhoc: false,
      });

      const message = type === "transfer"
        ? `Transferred ${currency.symbol}${formatValue(amount)} to ${target.name}`
        : `Added ${currency.symbol}${formatValue(amount)} to ${target.name}`;

      toast.success(message);
      setOpen(false);
    } catch (e) {
      toast.error("Failed to add transaction");
      setIsSubmitting(false);
    }
  };

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Heuristic: check if input is a valid number
  const numericValue = parseFloat(searchValue.replace(/[^\d.-]/g, ""));
  const isEnteringAmount = (step === "initial" || step === "amount") && !isNaN(numericValue) && numericValue > 0 && !searchValue.includes(" ");

  const placeholder = React.useMemo(() => {
    const prefix = (amount !== null && amount > 0) ? `${currency.symbol}${formatValue(amount)}` : "";
    if (step === "amount") return `Enter amount for ${type}...`;
    if (step === "type") return `Choose type for ${prefix}...`;
    if (step === "account") return type === "transfer" ? `Transfer ${prefix} from...` : `Account for ${prefix}...`;
    if (step === "toAccount") return `Transfer ${prefix} to...`;
    if (step === "category") return `Category for ${prefix}...`;
    return "Search commands or enter amount...";
  }, [step, amount, type, currency, formatValue]);

  // Unified item renderer for consistency
  const StyledItem = ({ children, onSelect, icon: Icon, color, subtext, shortcut, value, disabled }: any) => {
    const itemValue = value || (typeof children === "string" ? children : undefined);
    
    return (
      <CommandItem 
        onSelect={disabled ? undefined : onSelect} 
        value={itemValue} 
        disabled={disabled} 
        className="flex items-center gap-3 py-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
          {typeof Icon === "string" ? (
            <CategoryIcon icon={Icon} color={color} size="sm" />
          ) : Icon ? (
            <Icon className="h-4 w-4" style={{ color }} />
          ) : color ? (
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          ) : (
            <Zap className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-medium truncate">{children}</span>
          {subtext && <span className="text-xs text-muted-foreground truncate">{subtext}</span>}
        </div>
        {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
      </CommandItem>
    );
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={placeholder}
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList className="min-h-[350px]">
          <CommandEmpty>No results found.</CommandEmpty>

          {step === "initial" && (
            <>
              {isEnteringAmount && (
                <CommandGroup heading="Quick Add">
                  <StyledItem
                    icon={Plus}
                    onSelect={() => handleSelectAmount(numericValue)}
                    subtext="Press Enter to start recording"
                    value={searchValue}
                  >
                    Quick Add {currency.symbol}{formatValue(numericValue)}
                  </StyledItem>
                </CommandGroup>
              )}

              <CommandGroup heading="Suggestions">
                <StyledItem icon={ArrowDownLeft} onSelect={() => handleSelectType("expense")}>
                  New Expense
                </StyledItem>
                <StyledItem icon={ArrowUpRight} onSelect={() => handleSelectType("income")}>
                  New Income
                </StyledItem>
                <StyledItem icon={Repeat} onSelect={() => handleSelectType("transfer")}>
                  New Transfer
                </StyledItem>
              </CommandGroup>

              <CommandGroup heading="Navigation">
                <StyledItem icon={Home} onSelect={() => runCommand(() => navigate("/"))} shortcut="H">Dashboard</StyledItem>
                <StyledItem icon={List} onSelect={() => runCommand(() => navigate("/transactions"))} shortcut="T">Transactions</StyledItem>
                <StyledItem icon={Wallet} onSelect={() => runCommand(() => navigate("/accounts"))} shortcut="W">Accounts</StyledItem>
                <StyledItem icon={LayoutGrid} onSelect={() => runCommand(() => navigate("/categories"))} shortcut="C">Categories</StyledItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Theme">
                <StyledItem icon={Sun} onSelect={() => runCommand(() => setTheme("light"))}>Light Mode</StyledItem>
                <StyledItem icon={Moon} onSelect={() => runCommand(() => setTheme("dark"))}>Dark Mode</StyledItem>
              </CommandGroup>
            </>
          )}

          {step === "amount" && (
            <CommandGroup heading={`Enter ${type} Amount`}>
              {isEnteringAmount ? (
                <StyledItem
                  icon={Plus}
                  onSelect={() => {
                    setAmount(numericValue);
                    setStep("account");
                    setSearchValue("");
                  }}
                  value={searchValue}
                  subtext={`Record as ${type}`}
                >
                  Confirm {currency.symbol}{formatValue(numericValue)}
                </StyledItem>
              ) : (
                <StyledItem
                  icon={Search}
                  disabled
                  subtext="Type a number to continue..."
                >
                  Enter amount for {type}...
                </StyledItem>
              )}
            </CommandGroup>
          )}

          {step === "type" && (
            <CommandGroup heading="Transaction Type">
              <StyledItem icon={ArrowDownLeft} onSelect={() => handleSelectType("expense")} subtext="Money spent on something">Expense</StyledItem>
              <StyledItem icon={ArrowUpRight} onSelect={() => handleSelectType("income")} subtext="Earnings, gifts, etc.">Income</StyledItem>
              <StyledItem icon={Repeat} onSelect={() => handleSelectType("transfer")} subtext="Move money between accounts">Transfer</StyledItem>
            </CommandGroup>
          )}

          {(step === "account" || step === "toAccount") && (
            <CommandGroup heading={step === "toAccount" ? "To Account" : "From Account"}>
              {accounts
                .filter(a => step !== "toAccount" || a.id !== selectedAccount?.id)
                .map((account) => (
                  <StyledItem
                    key={account.id}
                    onSelect={() => step === "toAccount" ? handleFinish(account) : handleSelectAccount(account)}
                    icon={account.icon}
                    color={account.color}
                    subtext={`${currency.symbol}${formatValue(balances[account.id] || 0)}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && step === "toAccount" ? "Saving..." : account.name}
                  </StyledItem>
                ))}
            </CommandGroup>
          )}

          {step === "category" && (
            <CommandGroup heading="Select Category">
              {categories.map((category) => (
                <StyledItem
                  key={category.id}
                  onSelect={() => handleFinish(category)}
                  icon={category.icon}
                  color={category.color}
                  subtext="Select category to finish"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : category.name}
                </StyledItem>
              ))}
            </CommandGroup>
          )}

        </CommandList>
      </CommandDialog>
    </>
  );
}
