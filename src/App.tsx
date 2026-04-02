import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReloadPrompt } from "@/components/ReloadPrompt";
import { BackupReminderPrompt } from "@/components/BackupReminderPrompt";
import { lazy, useEffect } from "react";
import { initializeDatabase, linkDataToUser } from "@/db/expenseTrackerDb";
import { startDownstreamSync, processSyncQueue } from "@/db/sync";

import HomePage from "./pages/HomePage";

import TransactionsPage from "./pages/TransactionsPage";
import SettingsPage from "./pages/SettingsPage";
import DataManagementPage from "./pages/DataManagementPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "@/pages/AuthPage";
import { Loader2 } from "lucide-react";
import Loading from "./components/ui/loading";

const AddExpensePage = lazy(() => import("@/pages/AddExpensePage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
const AnalysisPage = lazy(() => import("@/pages/AnalysisPage"));
const EditExpensePage = lazy(() => import("@/pages/EditExpensePage"));

const queryClient = new QueryClient();

function AppContent() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      const init = async () => {
        try {
          // 1. Push any pending changes to cloud first, so the cloud has our latest offline actions.
          await processSyncQueue();
          // 2. Pull down the authoritative remote state and mirror exactly.
          await startDownstreamSync();
          // 3. Initialize default categories/accounts ONLY if nothing was downloaded
          await initializeDatabase();
          // 4. Link records to user
          await linkDataToUser(user.id);
        } catch (e) {
          console.error("Initialization error", e);
        }
      };
      init();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loading />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddExpensePage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/expense/:id" element={<EditExpensePage />} />
        <Route path="/expense/:id/edit" element={<EditExpensePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/data" element={<DataManagementPage />} />
        <Route path="/settings/about" element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BackupReminderPrompt />
    </AppLayout>
  );
}

function RootRoutes() {
  return (
    <Routes>
      <Route path="/oauth/callback" element={<GoogleCallbackPage />} />
      <Route path="/*" element={<AppContent />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CurrencyProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Sonner position="top-right" duration={3000} />
            <BrowserRouter>
              <RootRoutes />
            </BrowserRouter>
            <ReloadPrompt />
          </TooltipProvider>
        </ThemeProvider>
      </CurrencyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
