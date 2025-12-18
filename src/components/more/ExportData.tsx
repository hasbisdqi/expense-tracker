import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportAllData, getAllCategories } from "@/lib/db";
import { Expense, Category } from "@/types/expense";
import { toast } from "sonner";

export function ExportData() {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportAllData();

      // Filter by date range if provided
      let expenses = data.expenses;
      if (fromDate && toDate) {
        expenses = expenses.filter(
          (e) => e.date >= fromDate && e.date <= toDate
        );
      }

      if (format === "csv") {
        const csv = generateCSV(expenses, data.categories);
        downloadFile(csv, `expenses-${Date.now()}.csv`, "text/csv");
      } else {
        const json = JSON.stringify(
          {
            exportDate: new Date().toISOString(),
            version: "1.0",
            expenses,
            categories: data.categories,
          },
          null,
          2
        );
        downloadFile(json, `expenses-${Date.now()}.json`, "application/json");
      }

      toast.success(`Exported ${expenses.length} expenses`);
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Date Range (Optional)</Label>
        <div className="flex gap-2">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex-1"
            placeholder="From"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex-1"
            placeholder="To"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Format</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setFormat("csv")}
            className={`flex-1 py-2 rounded-lg transition-all ${
              format === "csv"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            CSV
          </button>
          <button
            onClick={() => setFormat("json")}
            className={`flex-1 py-2 rounded-lg transition-all ${
              format === "json"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <Button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full"
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? "Exporting..." : "Export Data"}
      </Button>
    </div>
  );
}

function generateCSV(expenses: Expense[], categories: Category[]): string {
  const headers = [
    "Date",
    "Time",
    "Category",
    "Description",
    "Value",
    "Tags",
    "IsAdhoc",
    "Attachment",
  ];

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const rows = expenses.map((e) => [
    e.date,
    e.time,
    categoryMap.get(e.category) || "Unknown",
    `"${(e.description || "").replace(/"/g, '""')}"`,
    e.value,
    `"${e.tags.join(";")}"`,
    e.isAdhoc,
    e.attachment ? "[base64]" : "",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
