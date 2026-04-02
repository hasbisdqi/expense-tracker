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

import { useHotkeys } from "@/hooks/use-hotkeys";

const categorySchema = z.object({
  name: z.string().min(1, "Name required").max(30, "Max 30 characters"),
  icon: z.string().min(1, "Icon required"),
  color: z.string().min(1, "Color required"),
});

interface CategoryFormProps {
  category?: { id: string; name: string; icon: string; color: string };
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: CategoryFormProps) {
  const defaultValues: CategoryFormData = category
    ? {
      name: category.name,
      icon: category.icon,
      color: category.color,
    }
    : {
      name: "",
      icon: "Tag",
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
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

      const cleanData: CategoryFormData = {
        ...data,
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

  // ⌘ + Enter or Ctrl + Enter to submit
  useHotkeys("enter", () => handleSubmit(onSubmit)(), {
    meta: true,
    enableOnInputs: true,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Category name" {...register("name")} autoFocus />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
