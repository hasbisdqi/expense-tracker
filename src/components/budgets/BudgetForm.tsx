import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BudgetFormData, Budget } from "@/types/expense";
import { addBudget, updateBudget, CATEGORY_COLORS } from "@/db/expenseTrackerDb";
import { IconPicker } from "@/components/categories/CategoryIcon";
import { ColorPicker } from "@/components/categories/ColorPicker";
import { toast } from "sonner";
import CurrencyInput from "../ui/currency-input";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useCategories } from "@/hooks/useExpenseData";
import { Checkbox } from "@/components/ui/checkbox";

const budgetSchema = z.object({
  name: z.string().min(1, "Name required").max(40, "Max 40 characters"),
  icon: z.string().min(1, "Icon required"),
  color: z.string().min(1, "Color required"),
  categoryIds: z.array(z.string()),
  dailyAmount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return Number(val);
  }, z.number().min(0, "Must be positive").nullable().optional()),
  weeklyAmount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return Number(val);
  }, z.number().min(0, "Must be positive").nullable().optional()),
  monthlyAmount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return Number(val);
  }, z.number().min(0, "Must be positive").nullable().optional()),
  yearlyAmount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return Number(val);
  }, z.number().min(0, "Must be positive").nullable().optional()),
}).refine(data => {
  return data.dailyAmount || data.weeklyAmount || data.monthlyAmount || data.yearlyAmount;
}, {
  message: "At least one limit must be provided",
  path: ["monthlyAmount"], // attaching the error to the easiest general field
});

interface BudgetFormProps {
  budget?: Budget;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function BudgetForm({ budget, onSuccess, onCancel }: BudgetFormProps) {
  const categories = useCategories();

  const defaultValues: BudgetFormData = budget
    ? {
      name: budget.name,
      icon: budget.icon,
      color: budget.color,
      categoryIds: budget.categoryIds || [],
      dailyAmount: budget.dailyAmount || null,
      weeklyAmount: budget.weeklyAmount || null,
      monthlyAmount: budget.monthlyAmount || null,
      yearlyAmount: budget.yearlyAmount || null,
    }
    : {
      name: "",
      icon: "Wallet",
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      categoryIds: [],
      dailyAmount: null,
      weeklyAmount: null,
      monthlyAmount: null,
      yearlyAmount: null,
    };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema) as any,
    defaultValues,
  });

  const selectedIcon = watch("icon");
  const selectedColor = watch("color");
  const { currency } = useCurrency();

  const onSubmit = async (data: BudgetFormData) => {
    try {
      const cleanData: BudgetFormData = {
        ...data,
      };

      let id: string;
      if (budget) {
        await updateBudget(budget.id, cleanData);
        id = budget.id;
        toast.success("Budget updated");
      } else {
        id = await addBudget(cleanData);
        toast.success("Budget created");
      }
      onSuccess?.(id);
    } catch {
      toast.error("Failed to save budget");
    }
  };

  useHotkeys("enter", () => handleSubmit(onSubmit)(), {
    meta: true,
    enableOnInputs: true,
  });

  // Custom setter for category array
  const toggleCategory = (categoryId: string) => {
    const current = watch("categoryIds") || [];
    if (current.includes(categoryId)) {
      setValue("categoryIds", current.filter(id => id !== categoryId));
    } else {
      setValue("categoryIds", [...current, categoryId]);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Budget Name</Label>
        <Input id="name" placeholder="E.g., Groceries & Utilities" {...register("name")} autoFocus />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-3">
        <Label>Categories to Track</Label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-md bg-muted/20">
          {categories.map(cat => {
            const isChecked = watch("categoryIds")?.includes(cat.id) || false;
            return (
              <div key={cat.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${cat.id}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <label
                  htmlFor={`category-${cat.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {cat.name}
                </label>
              </div>
            )
          })}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 p-2 text-center">
              You need to create categories first.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Limits (Enter at least one)</Label>
        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Daily Limit"
            name="dailyAmount"
            setValue={setValue}
            currency={currency}
            value={watch("dailyAmount")}
            error={errors.dailyAmount?.message}
          />
          <CurrencyInput
            label="Weekly Limit"
            name="weeklyAmount"
            setValue={setValue}
            currency={currency}
            value={watch("weeklyAmount")}
            error={errors.weeklyAmount?.message}
          />
          <CurrencyInput
            label="Monthly Limit"
            name="monthlyAmount"
            setValue={setValue}
            currency={currency}
            value={watch("monthlyAmount")}
            error={errors.monthlyAmount?.message}
          />
          <CurrencyInput
            label="Yearly Limit"
            name="yearlyAmount"
            setValue={setValue}
            currency={currency}
            value={watch("yearlyAmount")}
            error={errors.yearlyAmount?.message}
          />
        </div>
        {/* General error message for missing limit */}
        {/* We attached the general validation error to monthlyAmount */}
        {errors.monthlyAmount?.message === "At least one limit must be provided" && (
          <p className="text-sm text-destructive">{errors.monthlyAmount.message}</p>
        )}
      </div>

      {/* Style Section */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Label>Icon</Label>
          <IconPicker
            value={selectedIcon}
            onChange={(icon) => setValue("icon", icon)}
            color={selectedColor}
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <ColorPicker value={selectedColor} onChange={(color) => setValue("color", color)} />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : budget ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
