import { icons, LucideIcon, MoreHorizontal } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/contexts/CurrencyContext";
import { BudgetCalculations } from "@/hooks/useExpenseData";
import { useCategories } from "@/hooks/useExpenseData";

interface BudgetCardProps {
  budget: BudgetCalculations;
  onClick?: () => void;
}

export function BudgetCard({ budget, onClick }: BudgetCardProps) {
  const { currency, formatValue } = useCurrency();
  const categoriesDb = useCategories();
  
  const watchedCategories = categoriesDb.filter(c => budget.categoryIds.includes(c.id));
  const IconComponent = (icons as any)[budget.icon] as LucideIcon || MoreHorizontal;

  const formatCurrency = (val: number) => {
    return currency.symbol + formatValue(val);
  };

  return (
    <div 
      className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: budget.color }}
        >
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg truncate">{budget.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {watchedCategories.length > 0 
              ? watchedCategories.map(c => c.name).join(", ") 
              : "No categories assigned"}
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        {budget.progress.map((p, idx) => (
           <div key={idx} className="space-y-1.5">
             <div className="flex justify-between items-end">
               <span className="text-sm font-medium capitalize">{p.period}</span>
               <div className="text-right">
                 <span className={`text-sm font-semibold pl-2 ${p.isOverBudget ? "text-destructive" : ""}`}>
                   {formatCurrency(p.spent)}
                 </span>
                 <span className="text-xs text-muted-foreground ml-1">
                   / {formatCurrency(p.limit)}
                 </span>
               </div>
             </div>
             <Progress 
               value={Math.min(p.percentageUsed, 100)} 
               className="h-2"
               indicatorClassName={
                 p.isOverBudget 
                   ? "bg-destructive" 
                   : p.isWarning 
                     ? "bg-orange-500" 
                     : ""
               }
               indicatorStyle={
                 p.isOverBudget || p.isWarning ? {} : { backgroundColor: budget.color }
               }
             />
             <p className="text-[11px] text-muted-foreground text-right leading-none">
               {p.isOverBudget ? "Over limit by " : "Remaining "}
               <span className={p.isOverBudget ? "text-destructive font-medium" : "font-medium"}>
                 {formatCurrency(Math.abs(p.remaining))}
               </span>
             </p>
           </div>
        ))}
        {budget.progress.length === 0 && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 text-center">
            No limits set
          </p>
        )}
      </div>
    </div>
  );
}
