import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { adminApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import mainLogo from "@assets/White Logo.png";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileWarning, Landmark, LogOut } from "lucide-react";

export default function DashboardPage() {
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-[hsl(220,100%,15%)] text-white px-6 py-4 flex items-center justify-between">
        <img src={mainLogo} alt="Protea Metering" className="h-9 w-auto" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/80">{user?.username}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/70 hover:text-white hover:bg-white/10">
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, {user?.username}. Choose a module to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Arrears Manager Card */}
          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg border-2 hover:border-secondary"
            onClick={() => setLocation("/arrears-manager")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="rounded-lg bg-secondary/10 p-3">
                <FileWarning className="h-8 w-8 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-xl">Arrears Manager</CardTitle>
                <CardDescription>
                  Manage and track outstanding arrears accounts
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View arrears reports, track overdue accounts, and manage
                follow-up actions.
              </p>
            </CardContent>
          </Card>

          {/* Debt Manager Card */}
          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg border-2 hover:border-accent"
            onClick={() => setLocation("/debt-manager")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="rounded-lg bg-accent/10 p-3">
                <Landmark className="h-8 w-8 text-accent" />
              </div>
              <div>
                <CardTitle className="text-xl">Debt Manager</CardTitle>
                <CardDescription>
                  Manage debt collection and recovery processes
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track debt records, manage collection workflows, and monitor
                recovery status.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
