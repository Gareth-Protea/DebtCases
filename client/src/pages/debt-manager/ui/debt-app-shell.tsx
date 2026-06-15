import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

import { useAuth } from "@/hooks/use-auth";
import { adminApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { DebtSidebar } from "./debt-sidebar";

interface DebtAppShellProps {
  children: ReactNode;
  layout?: "contained" | "full";
  mainClassName?: string;
  contentClassName?: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DebtAppShell({
  children,
  layout = "contained",
  mainClassName,
  contentClassName,
}: DebtAppShellProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const handleLogout = async () => {
    await adminApi.logout();
    queryClient.clear();
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isFullLayout = layout === "full";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(220,14%,98%)_0%,hsl(0,0%,100%)_40%,hsl(220,14%,99%)_100%)]">
      <div className="flex min-h-screen">
        <DebtSidebar
          username={user?.username ?? "User"}
          onLogout={handleLogout}
        />

        <main
          className={cx(
            "min-w-0 flex-1",
            isFullLayout
              ? "overflow-hidden"
              : "px-4 py-6 md:px-6 lg:px-8",
            mainClassName,
          )}
        >
          <div
            className={cx(
              isFullLayout
                ? "min-h-screen w-full"
                : "mx-auto max-w-7xl space-y-6",
              contentClassName,
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}