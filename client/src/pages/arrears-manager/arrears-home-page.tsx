import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import mainLogo from "@assets/White Logo.png";

export default function ArrearsHomePage() {
  const [, setLocation] = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

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
      <header className="border-b bg-[hsl(220,100%,15%)] text-white px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} className="text-white/70 hover:text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <img src={mainLogo} alt="Protea Metering" className="h-9 w-auto" />
        <span className="text-white/60 text-sm">Arrears Manager</span>
      </header>

      <main className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-primary">Arrears Manager</h2>
        <p className="text-muted-foreground">
          Arrears management features will be built here.
        </p>
      </main>
    </div>
  );
}
