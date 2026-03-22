import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountFormData } from "@/types/expense";
import { addAccount, updateAccount, getAccountByName } from "@/db/expenseTrackerDb";
import { IconPicker } from "@/components/categories/CategoryIcon";
import { ColorPicker } from "@/components/categories/ColorPicker";
import { CATEGORY_COLORS } from "@/db/expenseTrackerDb";
import { toast } from "sonner";
import { Account } from "@/types/expense";

const accountSchema = z.object({
  name: z.string().min(1, "Name required").max(30, "Max 30 characters"),
  icon: z.string().min(1, "Icon required"),
  color: z.string().min(1, "Color required"),
});

interface AccountFormProps {
  account?: Account;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: account
      ? {
          name: account.name,
          icon: account.icon,
          color: account.color,
        }
      : {
          name: "",
          icon: "Wallet",
          color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
        },
  });

  const selectedIcon = watch("icon");
  const selectedColor = watch("color");

  const onSubmit = async (data: AccountFormData) => {
    try {
      if (!account || account.name !== data.name) {
        const existing = await getAccountByName(data.name);
        if (existing) {
          toast.error("An account with this name already exists");
          return;
        }
      }

      let id: string;
      if (account) {
        await updateAccount(account.id, data);
        id = account.id;
        toast.success("Account updated");
      } else {
        id = await addAccount(data);
        toast.success("Account created");
      }
      onSuccess?.(id);
    } catch {
      toast.error("Failed to save account");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Account name" {...register("name")} autoFocus />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

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

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : account ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
