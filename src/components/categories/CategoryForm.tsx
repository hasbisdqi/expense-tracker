import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryFormData } from "@/types/expense";
import { addCategory, updateCategory, getCategoryByName } from "@/db/expenseTrackerDb";
import { IconPicker } from "@/components/categories/CategoryIcon";
import { ColorPicker } from "@/components/categories/ColorPicker";
import { CATEGORY_COLORS } from "@/db/expenseTrackerDb";
import { toast } from "sonner";
import CurrencyInput from "../ui/currency-input";
import { useCurrency } from "@/contexts/CurrencyContext";

const categorySchema = z.object({
  name: z.string().min(1, "Name required").max(30, "Max 30 characters"),
  icon: z.string().min(1, "Icon required"),
  color: z.string().min(1, "Color required"),
  budget: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return Number(val);
  }, z.number().min(0, "Must be positive").nullable().optional()),
  budgetPeriod: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable().optional(),
});

interface CategoryFormProps {
  category?: { id: string; name: string; icon: string; color: string; budget?: number; budgetPeriod?: "daily" | "weekly" | "monthly" | "yearly" };
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: CategoryFormProps) {
  const defaultValues: CategoryFormData = category
    ? {
      name: category.name,
      icon: category.icon,
      color: category.color,
      budget: category.budget || null,
      budgetPeriod: category.budgetPeriod || "monthly",
    }
    : {
      name: "",
      icon: "Tag",
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      budget: null,
      budgetPeriod: "monthly",
    };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues,
  });

  const selectedIcon = watch("icon");
  const selectedColor = watch("color");
  const { currency } = useCurrency();

  const onSubmit = async (data: CategoryFormData) => {
    try {
      // Check for duplicate name (only for new categories or name changes)
      if (!category || category.name !== data.name) {
        const existing = await getCategoryByName(data.name);
        if (existing) {
          toast.error("A category with this name already exists");
          return;
        }
      }

      // Convert empty budget strings to null to avoid type issues
      const cleanData: CategoryFormData = {
        ...data,
        budget: data.budget || null,
        budgetPeriod: data.budgetPeriod || "monthly",
      };

      let id: string;
      if (category) {
        await updateCategory(category.id, cleanData);
        id = category.id;
        toast.success("Category updated");
      } else {
        id = await addCategory(cleanData);
        toast.success("Category created");
      }
      onSuccess?.(id);
    } catch {
      toast.error("Failed to save category");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Category name" {...register("name")} autoFocus />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      {/* Budget */}
      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Budget Limit (Optional)"
          name="budget"
          setValue={setValue}
          currency={currency}
          value={watch("budget")}
          error={errors.budget?.message}
        />

        <div className="space-y-2">
          <Label>Budget Period</Label>
          <Select
            value={watch("budgetPeriod") || "monthly"}
            onValueChange={(val: any) => setValue("budgetPeriod", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Icon Picker */}
      <div className="space-y-2">
        <Label>Icon</Label>
        <IconPicker
          value={selectedIcon}
          onChange={(icon) => setValue("icon", icon)}
          color={selectedColor}
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <ColorPicker value={selectedColor} onChange={(color) => setValue("color", color)} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : category ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
