import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { Plus, Trash2, Edit, FolderOpen, Tag } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CategoryForm } from "@/components/categories/CategoryForm";
import { TagTab } from "@/components/categories/TagTab";
import { useCategories, useCategoryExpenseCounts, useCategoryBudgets } from "@/hooks/useExpenseData";
import { deleteCategory } from "@/db/expenseTrackerDb";
import { Category } from "@/types/expense";
import { cn } from "@/lib/utils";

export default function CategoriesPage() {
  const navigate = useNavigate();
  const categories = useCategories();
  const expenseCounts = useCategoryExpenseCounts();
  const categoryBudgets = useCategoryBudgets();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteData, setDeleteData] = useState<{
    category: Category;
    expenseCount: number;
  } | null>(null);
  const [deleteAction, setDeleteAction] = useState<"move" | "cascade">("move");
  const [moveToCategory, setMoveToCategory] = useState<string>("");

  const handleDelete = async () => {
    if (!deleteData) return;

    try {
      if (deleteAction === "move") {
        await deleteCategory(deleteData.category.id, moveToCategory);
      } else {
        await deleteCategory(deleteData.category.id);
      }
      toast.success("Category deleted");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    }
    setDeleteData(null);
  };

  const handleDeleteClick = async (category: Category) => {
    // Check if it's the "Others" category
    if (category.name === "Others" && category.isDefault) {
      toast.error('The "Others" category cannot be deleted');
      return;
    }

    const count = expenseCounts[category.id] || 0;
    const othersCategory = categories.find((c) => c.name === "Others");
    setMoveToCategory(othersCategory?.id || "");
    setDeleteData({ category, expenseCount: count });
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-xl font-semibold">Categories</h1>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Category
          </Button>
        </m.div>

        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="categories" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Categories
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((category, index) => (
                  <m.div
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate('/transactions', { state: { categoryId: category.id } })}
                    className={cn(
                      "p-4 rounded-xl bg-card border border-border/50",
                      "flex items-center gap-3",
                      "hover:border-primary/50 transition-colors cursor-pointer",
                    )}
                  >
                    <CategoryIcon icon={category.icon} color={category.color} size="lg" />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {expenseCounts[category.id] || 0} transactions
                      </p>
                      
                      {categoryBudgets[category.id] && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className={cn(
                              categoryBudgets[category.id].isOverBudget ? "text-destructive" : 
                              categoryBudgets[category.id].isWarning ? "text-orange-500" : "text-muted-foreground"
                            )}>
                              ${categoryBudgets[category.id].spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${categoryBudgets[category.id].totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-muted-foreground ml-2">
                               {categoryBudgets[category.id].isOverBudget 
                                 ? `Over by $${Math.abs(categoryBudgets[category.id].remaining).toLocaleString()}` 
                                 : `${Math.min(100, categoryBudgets[category.id].percentageUsed).toFixed(0)}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                categoryBudgets[category.id].isOverBudget ? "bg-destructive" :
                                categoryBudgets[category.id].isWarning ? "bg-orange-500" : "bg-primary"
                              )} 
                              style={{ width: `${Math.min(100, Math.max(0, categoryBudgets[category.id].percentageUsed))}%`, backgroundColor: (!categoryBudgets[category.id].isOverBudget && !categoryBudgets[category.id].isWarning) ? category.color : undefined }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setEditCategory(category); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(category); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </m.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tags">
              <TagTab />
            </TabsContent>
          </Tabs>
        </m.div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
            </DialogHeader>
            <CategoryForm
              onSuccess={() => setShowCreateDialog(false)}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            {editCategory && (
              <CategoryForm
                category={editCategory}
                onSuccess={() => setEditCategory(null)}
                onCancel={() => setEditCategory(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteData} onOpenChange={() => setDeleteData(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteData?.category.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteData?.expenseCount ? (
                  <>
                    This category has {deleteData.expenseCount} transactions. What would you like to do?
                  </>
                ) : (
                  "This action cannot be undone."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteData && deleteData.expenseCount > 0 && (
              <div className="space-y-4 py-4">
                <RadioGroup
                  value={deleteAction}
                  onValueChange={(v) => setDeleteAction(v as "move" | "cascade")}
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="move" id="move" />
                    <div className="space-y-1">
                      <Label htmlFor="move">Move transactions to another category</Label>
                      {deleteAction === "move" && (
                        <Select value={moveToCategory} onValueChange={setMoveToCategory}>
                          <SelectTrigger className="w-full mt-2">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories
                              .filter((c) => c.id !== deleteData.category.id)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  <div className="flex items-center gap-2">
                                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                                    {c.name}
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
                        Delete all {deleteData.expenseCount} transactions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        This will permanently delete all transactions in this category
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
                disabled={
                  deleteAction === "move" &&
                  deleteData &&
                  deleteData.expenseCount > 0 &&
                  !moveToCategory
                }
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
