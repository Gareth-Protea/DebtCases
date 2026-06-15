import { ArrowUpRight, Clock3, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/pages/debt-manager/types";

interface RecentWinsPanelProps {
  activity: ActivityItem[];
}

export function RecentWinsPanel({ activity }: RecentWinsPanelProps) {
  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-[hsl(341,72%,42%)]">
          <Sparkles className="h-3.5 w-3.5" />
          Recent wins
        </div>

        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Team momentum
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            A little positive feedback matters. This section shows progress, movement, and small wins so the space feels alive.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-6">
        {activity.map((item) => (
          <div
            key={item.id}
            className="rounded-[22px] border border-border/80 bg-muted/35 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                    {item.tag}
                  </span>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {item.timeLabel}
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-[24px] border border-primary/10 bg-primary/[0.03] p-4">
          <div className="flex items-start gap-3">
            <ArrowUpRight className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">
              This panel can later be connected to real collector activity, recent allocations, promise-to-pay events, and account status changes.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}