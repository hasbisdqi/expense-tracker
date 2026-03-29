import { useState } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router";
import { Home, FolderOpen, BarChart3, Settings, Plus, Wallet, LayoutGrid, List, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItemsLeft = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/analysis", icon: BarChart3, label: "Analysis" },
];

const navItemsRight = [
  { path: "/accounts", icon: Wallet, label: "Accounts" },
];

const sidebarNavItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/accounts", icon: Wallet, label: "Accounts" },
  { path: "/categories", icon: LayoutGrid, label: "Categories" },
  { path: "/analysis", icon: BarChart3, label: "Analysis", key: "A" },
  { path: "/transactions", icon: List, label: "Transactions", key: "T" },
  { path: "/settings", icon: Settings, label: "Settings", key: "S" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const renderNavItem = (item: any) => {
    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
    const Icon = item.icon;

    return (
      <RouterNavLink
        key={item.path}
        to={item.path}
        className={cn("bottom-nav-item relative flex flex-col items-center justify-center", isActive && "active")}
      >
        {isActive && (
          <m.div
            layoutId="nav-indicator"
            className="absolute inset-0 bg-accent rounded-xl"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <Icon className={cn("h-5 w-5 relative z-10", isActive && "text-primary-foreground")} />
        <span
          className={cn(
            "text-[10px] mt-1 font-medium relative z-10",
            isActive && "text-primary-foreground",
          )}
        >
          {item.label}
        </span>
      </RouterNavLink>
    );
  };

  const MoreLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <button
      onClick={() => {
        setMoreOpen(false);
        navigate(to);
      }}
      className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-accent/50 transition-colors"
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-center">{label}</span>
    </button>
  );

  return (
    <LazyMotion features={domAnimation}>
      <nav className="fixed bottom-0 left-0 right-0 h-18 py-2 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-evenly px-2 pb-safe lg:hidden z-40">

        <div className="flex flex-1 justify-evenly h-full">
          {navItemsLeft.map(renderNavItem)}
        </div>

        {/* Center Add Button */}
        <div className="relative flex justify-center w-16 -mt-8 z-50">
          <button
            onClick={() => navigate("/add")}
            className="flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-transform active:scale-95 scale-120"
            aria-label="Add transaction"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-1 justify-evenly h-full">
          {navItemsRight.map(renderNavItem)}

          {/* More Menu */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="bottom-nav-item relative flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="h-5 w-5 relative z-10" />
                <span className="text-[10px] mt-1 font-medium relative z-10">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl border-border/50 bg-background/95 backdrop-blur-xl px-4 py-6 text-foreground">
              <SheetHeader className="mb-6 text-left">
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-4 gap-4 pb-4">
                <MoreLink to="/categories" icon={LayoutGrid} label="Categories" />
                <MoreLink to="/transactions" icon={List} label="Transactions" />
                <MoreLink to="/settings" icon={Settings} label="Settings" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </LazyMotion>
  );
}

export function SidebarNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card/50 p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold gradient-text">Mamoni</h1>
        <p className="text-xs text-muted-foreground mt-1">Track your spending</p>
      </div>

      {/* Add Transaction Button */}
      <button
        onClick={() => navigate("/add")}
        className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
      >
        <Plus className="h-5 w-5" />
        Add Transaction
        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary-foreground/20 border border-primary-foreground/20">
           N
        </span>
      </button>

      <nav className="flex flex-col gap-1">
        {sidebarNavItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <RouterNavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl",
                "transition-all duration-200",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-background/50 border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                 {item.path === "/" ? "H" : item.label.charAt(0)}
              </span>
            </RouterNavLink>
          );
        })}
      </nav>
    </aside>
  );
}
