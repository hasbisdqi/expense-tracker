import { LazyMotion, domAnimation, m } from "framer-motion";
import { Sun, Moon, Monitor, ChevronRight, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { useTheme } from "@/contexts/ThemeContext";
import CurrencyDropdown from "@/components/more/CurrencyDropdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Cloud, CloudOff, LogOut } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light" as const, icon: Sun },
    { value: "dark" as const, icon: Moon },
    { value: "system" as const, icon: Monitor },
  ];

  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4 overflow-x-hidden">
        <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </h1>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-1"
        >
          {/* Theme Row */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50">
            <span className="text-sm font-medium">Theme</span>
            <div className="flex gap-1">
              {themes.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground",
                  )}
                  aria-label={value}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Currency Row */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50">
            <span className="text-sm font-medium">Currency</span>
            <CurrencyDropdown compact />
          </div>

          {/* Data Management Row */}
          <button
            onClick={() => navigate("/settings/data")}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50 hover:bg-accent/50 transition-colors"
          >
            <span className="text-sm font-medium">Data Management</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* About App Row */}
          <button
            onClick={() => navigate("/settings/about")}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50 hover:bg-accent/50 transition-colors"
          >
            <span className="text-sm font-medium">About App</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Sync Status Row */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50 mt-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium flex items-center gap-2">
                Sync Status
                {isOnline ? <Cloud className="h-4 w-4 text-primary" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {user ? `Logged in as ${user.email}` : "Not logged in"}
              </span>
            </div>
            <span className="text-xs font-medium">
              {isOnline ? "Active" : "Offline"}
            </span>
          </div>

          {/* Logout Button */}
          {user && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors mt-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Log Out</span>
            </button>
          )}
        </m.div>
      </div>
    </LazyMotion>
  );
}
