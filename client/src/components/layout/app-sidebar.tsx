import { useLocation } from "wouter";
import { adminApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileWarning,
  Landmark,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Arrears Manager", href: "/arrears-manager", icon: FileWarning },
  { label: "Debt Manager", href: "/debt-manager", icon: Landmark },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    await adminApi.logout();
    queryClient.clear();
    setLocation("/");
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      {/* Header / Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--sidebar-primary))] flex items-center justify-center">
          <span className="text-sm font-bold text-[hsl(var(--sidebar-primary-foreground))]">
            P
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold">Protea Metering</p>
          <p className="text-xs text-[hsl(var(--sidebar-foreground))]/60">
            Arrears & Debt
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <button
              key={item.href}
              onClick={() => setLocation(item.href)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"
                  : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[hsl(var(--sidebar-foreground))]/70 hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
