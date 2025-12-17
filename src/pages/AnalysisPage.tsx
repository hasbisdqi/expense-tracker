import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, TrendingUp, Wallet, Receipt, Award, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { useAnalysisSummary, useCategories, getDateRangeForPeriod } from '@/hooks/useExpenseData';
import { exportAllData } from '@/lib/db';
import { TimePeriod, ExpenseFilters, DateRange } from '@/types/expense';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AnalysisPage() {
  const { toast } = useToast();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [excludeAdhoc, setExcludeAdhoc] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const categories = useCategories();

  const dateRange = useMemo(() => {
    if (timePeriod === 'custom' && customRange) {
      return customRange;
    }
    if (timePeriod === 'custom') {
      return getDateRangeForPeriod('month');
    }
    return getDateRangeForPeriod(timePeriod);
  }, [timePeriod, customRange]);

  const filters: ExpenseFilters = {
    dateRange,
    includeAdhoc: !excludeAdhoc,
  };

  const summary = useAnalysisSummary(filters);

  const handleExportCSV = async () => {
    try {
      const data = await exportAllData();
      
      const csvRows = [
        ['Date', 'Time', 'Category', 'Description', 'Value', 'Tags', 'IsAdhoc'].join(','),
        ...data.expenses.map((e) => {
          const category = categories.find((c) => c.id === e.category);
          return [
            e.date,
            e.time,
            `"${category?.name || 'Unknown'}"`,
            `"${e.description || ''}"`,
            e.value,
            `"${e.tags.join(', ')}"`,
            e.isAdhoc,
          ].join(',');
        }),
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Exported successfully' });
      setShowExportDialog(false);
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const handleExportJSON = async () => {
    try {
      const data = await exportAllData();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        ...data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Exported successfully' });
      setShowExportDialog(false);
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const pieData = summary.categoryBreakdown.map((cat) => ({
    name: cat.categoryName,
    value: cat.total,
    color: cat.categoryColor,
  }));

  const barData = summary.dailyTrend.map((day) => ({
    date: format(new Date(day.date), 'MMM d'),
    amount: day.total,
  }));

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-xl font-semibold">Analysis</h1>
        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4 p-4 bg-card rounded-xl border border-border/50"
      >
        <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <TabsList className="w-full">
            <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
            <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
            <TabsTrigger value="year" className="flex-1">Year</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
          </TabsList>
        </Tabs>

        {timePeriod === 'custom' && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customRange?.start ? format(customRange.start, 'PP') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customRange?.start}
                  onSelect={(date) => date && setCustomRange((prev) => ({ start: date, end: prev?.end || date }))}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customRange?.end ? format(customRange.end, 'PP') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customRange?.end}
                  onSelect={(date) => date && setCustomRange((prev) => ({ start: prev?.start || date, end: date }))}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="exclude-adhoc" className="cursor-pointer">
            Exclude Adhoc Expenses
          </Label>
          <Switch
            id="exclude-adhoc"
            checked={excludeAdhoc}
            onCheckedChange={setExcludeAdhoc}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-muted rounded-full">
            {format(dateRange.start, 'd MMM')} - {format(dateRange.end, 'd MMM yyyy')}
          </span>
          {excludeAdhoc && (
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
              Excluding Adhoc
            </span>
          )}
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="p-4 bg-card rounded-xl border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            <span className="text-xs">Total</span>
          </div>
          <p className="text-xl font-bold">₹{summary.totalExpenses.toLocaleString('en-IN')}</p>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Receipt className="h-4 w-4" />
            <span className="text-xs">Transactions</span>
          </div>
          <p className="text-xl font-bold">{summary.totalTransactions}</p>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Average</span>
          </div>
          <p className="text-xl font-bold">₹{Math.round(summary.averageExpense).toLocaleString('en-IN')}</p>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Award className="h-4 w-4" />
            <span className="text-xs">Top Category</span>
          </div>
          {summary.topCategory ? (
            <div className="flex items-center gap-2">
              <CategoryIcon
                icon={summary.topCategory.categoryIcon}
                color={summary.topCategory.categoryColor}
                size="sm"
              />
              <span className="font-medium text-sm truncate">{summary.topCategory.categoryName}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </div>
      </motion.div>

      {/* Charts */}
      {summary.totalTransactions > 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 bg-card rounded-xl border border-border/50"
          >
            <h3 className="text-sm font-medium mb-4">Category Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="mt-4 space-y-2">
              {summary.categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.categoryColor }}
                    />
                    <span className="truncate">{cat.categoryName}</span>
                  </div>
                  <span className="text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-card rounded-xl border border-border/50"
          >
            <h3 className="text-sm font-medium mb-4">Spending Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
        >
          <p>No expense data for this period</p>
        </motion.div>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleExportCSV}
            >
              <div className="text-left">
                <p className="font-medium">Export as CSV</p>
                <p className="text-xs text-muted-foreground">
                  Compatible with Excel, Google Sheets
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleExportJSON}
            >
              <div className="text-left">
                <p className="font-medium">Export as JSON</p>
                <p className="text-xs text-muted-foreground">
                  Full data backup with all fields
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
