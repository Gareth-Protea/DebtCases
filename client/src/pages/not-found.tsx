import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 text-center">
        <CardContent className="pt-6 space-y-4">
          <h1 className="text-4xl font-bold text-primary">404</h1>
          <p className="text-muted-foreground">Page not found</p>
          <Button onClick={() => setLocation("/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
