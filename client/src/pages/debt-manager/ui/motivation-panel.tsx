import { Flame, Sparkles, Target, Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Achievement } from "../types";

interface MotivationPanelProps {
  currentAmount: number;
  monthlyTarget: number;
  nextGoalAmount: number;
  achievementItems: Achievement[];
}

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function MotivationPanel({
  currentAmount,
  monthlyTarget,
  nextGoalAmount,
  achievementItems,
}: MotivationPanelProps) {
  const progress = Math.min((currentAmount / monthlyTarget) * 100, 100);
  const amountLeftToTarget = Math.max(monthlyTarget - currentAmount, 0);
  const amountLeftToMilestone = Math.max(nextGoalAmount - currentAmount, 0);

  const iconMap = {
    flame: Flame,
    target: Target,
    sparkles: Sparkles,
  };

  return (
    <Card className="overflow-hidden rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_100%)] text-white shadow-[0_24px_60px_-30px_rgba(8,38,84,0.6)]">
      <CardHeader className="space-y-4 p-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
          <Trophy className="h-3.5 w-3.5 text-secondary" />
          Motivation & momentum
        </div>

        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight text-white">
            You are building momentum
          </CardTitle>
          <p className="text-sm leading-6 text-white/75">
            Keep the team focused on meaningful action, not just movement. This panel keeps the target visible and the next win within reach.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Collected this month</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {currency.format(currentAmount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/70">Monthly target</p>
              <p className="mt-2 text-lg font-medium">
                {currency.format(monthlyTarget)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-white/70">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10">
              <div
                className="h-3 rounded-full bg-secondary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">
                Next milestone
              </p>
              <p className="mt-2 text-lg font-semibold">
                {amountLeftToMilestone === 0
                  ? "Milestone reached"
                  : `${currency.format(amountLeftToMilestone)} to go`}
              </p>
              <p className="mt-1 text-sm text-white/70">
                Push to {currency.format(nextGoalAmount)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">
                End-of-month gap
              </p>
              <p className="mt-2 text-lg font-semibold">
                {currency.format(amountLeftToTarget)}
              </p>
              <p className="mt-1 text-sm text-white/70">
                Small, consistent action closes this faster than you think
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-white/85">Achievement focus</p>

          {achievementItems.map((item) => {
            const Icon = iconMap[item.icon];

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 p-4"
              >
                
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-4.5 w-4.5 text-secondary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm leading-6 text-white/70">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-[24px] border border-secondary/20 bg-secondary/10 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-secondary" />
            <p className="text-sm leading-6 text-white/85">
              Best use of this page: assign the right debtors fast, contact the high-value queue early, and let the smaller wins keep the team moving.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}