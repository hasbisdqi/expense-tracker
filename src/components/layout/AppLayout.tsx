import { BottomNav, SidebarNav } from "./Navigation";
import { Analytics } from "@vercel/analytics/next"

import { useIsMobile } from "@/hooks/use-mobile";
import { CommandMenu } from "../CommandMenu";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useNavigate } from "react-router";
import { Command } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Global Shortcuts (non-modifier required version)
  useHotkeys("n", () => navigate("/add"));
  useHotkeys("h", () => navigate("/"));
  useHotkeys("t", () => navigate("/transactions"));
  useHotkeys("w", () => navigate("/accounts"));
  useHotkeys("c", () => navigate("/categories"));
  useHotkeys("a", () => navigate("/analysis"));
  useHotkeys("s", () => navigate("/settings"));

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      <CommandMenu />
      <SidebarNav />

      {/* <Analytics /> */}

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border/50 lg:hidden text-foreground">
          <Logo size={24} />
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-30 items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors border border-border/50">
              <Command className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">Quick Find...</span>
              <span className="ml-4 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-background border border-border/50">⌘K</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Header actions can go here if needed */}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 pb-20 lg:pb-6">{children}</main>

        {/* Bottom navigation - mobile only */}
        {isMobile && <BottomNav />}
      </div>
    </div>
  );
}
