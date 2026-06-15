import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "accent";
}

const toneMap = {
  primary: {
    iconWrap: "bg-primary/10 text-primary",
    line: "bg-primary",
  },
  secondary: {
    iconWrap: "bg-secondary/10 text-secondary",
    line: "bg-secondary",
  },
  accent: {
    iconWrap: "bg-accent/15 text-[hsl(341,72%,54%)]",
    line: "bg-accent",
  },
};

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "primary",
}: StatCardProps) {
  const styles = toneMap[tone];

  return (
    <Card className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1.5 w-full ${styles.line}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="text-sm text-muted-foreground">{helper}</p>
          </div>

          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.iconWrap}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}