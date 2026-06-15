import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DebtorLead } from "@/pages/debt-manager/types";

interface NewDebtorsPanelProps {
  debtors: DebtorLead[];
  onAssignToMe?: (debtorId: string) => void;
  onOpenDebtor?: (debtorId: string) => void;
}

const priorityStyles = {
  High: "border-destructive/20 bg-destructive/10 text-destructive",
  Medium: "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]",
  Low: "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,30%)]",
};

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function getActionScore(debtor: DebtorLead) {
  const priorityBase =
    debtor.priority === "High" ? 52 : debtor.priority === "Medium" ? 34 : 18;

  const ageBoost = Math.min(24, Math.max(0, debtor.daysSinceTermination - 30));
  const valueBoost =
    debtor.outstandingBalance >= 50000
      ? 24
      : debtor.outstandingBalance >= 25000
        ? 14
        : 8;

  return Math.min(100, priorityBase + ageBoost + valueBoost);
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Immediate action";
  if (score >= 65) return "Strong candidate";
  if (score >= 45) return "Ready today";
  return "Review soon";
}

function getSuggestedMove(score: number) {
  if (score >= 80) return "Assign now and start first contact immediately.";
  if (score >= 55) return "Assign today and prepare outreach.";
  return "Review the account before assigning.";
}

export function NewDebtorsPanel({
  debtors,
  onAssignToMe,
  onOpenDebtor,
}: NewDebtorsPanelProps) {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(
    debtors[0]?.id ?? null,
  );

  useEffect(() => {
    if (!debtors.length) {
      setSelectedDebtorId(null);
      return;
    }

    const selectedStillExists = debtors.some(
      (debtor) => debtor.id === selectedDebtorId,
    );

    if (!selectedStillExists) {
      setSelectedDebtorId(debtors[0].id);
    }
  }, [debtors, selectedDebtorId]);

  const selectedDebtor =
    debtors.find((debtor) => debtor.id === selectedDebtorId) ?? debtors[0] ?? null;

  const summary = useMemo(() => {
    const totalValue = debtors.reduce(
      (sum, debtor) => sum + debtor.outstandingBalance,
      0,
    );

    const highPriorityCount = debtors.filter(
      (debtor) => debtor.priority === "High",
    ).length;

    const urgentCount = debtors.filter((debtor) => getActionScore(debtor) >= 80)
      .length;

    return {
      totalValue,
      highPriorityCount,
      urgentCount,
    };
  }, [debtors]);

  if (!debtors.length) {
    return (
      <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
        <CardHeader className="p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <ShieldAlert className="h-3.5 w-3.5" />
            Newly qualified debtors
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Action queue
          </CardTitle>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="rounded-[24px] border border-dashed border-border bg-muted/25 p-8 text-center">
            <p className="text-base font-medium text-foreground">
              No new debtor accounts in the queue right now.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              When new debtors qualify, they will appear here ready for assignment.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedScore = selectedDebtor ? getActionScore(selectedDebtor) : 0;
  const selectedScoreLabel = getScoreLabel(selectedScore);

  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-6">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <ShieldAlert className="h-3.5 w-3.5" />
              Newly qualified debtors
            </div>

            <CardTitle className="text-2xl font-semibold tracking-tight">
              Action queue
            </CardTitle>

            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep the queue tight. Select the next debtor to preview the account,
              then claim it and move straight into first contact.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Queue size
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {debtors.length}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Hot accounts
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {summary.urgentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Queue value
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {currency.format(summary.totalValue)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
              {summary.highPriorityCount} high priority
            </span>
            <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-[hsl(142,100%,28%)]">
              Assignment-ready
            </span>
            <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              Select next account
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            {debtors.map((debtor) => {
              const score = getActionScore(debtor);
              const isSelected = debtor.id === selectedDebtorId;

              return (
                <button
                  key={debtor.id}
                  type="button"
                  onClick={() => setSelectedDebtorId(debtor.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-primary/20 bg-primary/[0.04] shadow-sm"
                      : "border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-foreground">
                          {debtor.name}
                        </p>

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityStyles[debtor.priority]}`}
                        >
                          {debtor.priority}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          {debtor.accountNumber}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          {debtor.daysSinceTermination} days
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          {debtor.area}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {currency.format(debtor.outstandingBalance)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{score}% score</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-muted-foreground">
                        {debtor.contactName} • {debtor.phone}
                      </p>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        score >= 80
                          ? "bg-destructive/10 text-destructive"
                          : score >= 55
                            ? "bg-accent/15 text-[hsl(341,72%,42%)]"
                            : "bg-secondary/10 text-[hsl(142,100%,28%)]"
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      {getScoreLabel(score)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDebtor ? (
            <div className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Selected debtor
                  </div>

                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    {selectedDebtor.name}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[selectedDebtor.priority]}`}
                    >
                      {selectedDebtor.priority}
                    </span>

                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {selectedDebtor.accountNumber}
                    </span>

                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-[hsl(142,100%,26%)]">
                      Assignment-ready
                    </span>
                  </div>
                </div>

                <div className="rounded-[22px] border border-border bg-background px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Outstanding balance
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {currency.format(selectedDebtor.outstandingBalance)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
                <div className="space-y-4">
                  <div className="rounded-[22px] bg-muted/35 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      <p className="text-sm font-medium text-foreground">
                        Assignment priority
                      </p>
                    </div>

                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {selectedScoreLabel}
                      </span>
                      <span className="font-medium text-foreground">
                        {selectedScore}%
                      </span>
                    </div>

                    <div className="h-2.5 rounded-full bg-border/70">
                      <div
                        className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(220,100%,15%)_0%,hsl(341,72%,74%)_55%,hsl(142,100%,44%)_100%)]"
                        style={{ width: `${selectedScore}%` }}
                      />
                    </div>

                    <div className="mt-4 rounded-2xl bg-white px-3 py-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-3.5 w-3.5 text-secondary" />
                        Suggested next move
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {getSuggestedMove(selectedScore)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Quick facts
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {selectedDebtor.daysSinceTermination} days since termination
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {selectedDebtor.area}
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Meter: {selectedDebtor.meterReference}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[22px] border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Debtor overview
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {selectedDebtor.note}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-border bg-background p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <Phone className="h-4 w-4 text-primary" />
                        Contact
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {selectedDebtor.contactName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedDebtor.phone}
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-border bg-background p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <Mail className="h-4 w-4 text-primary" />
                        Email
                      </div>
                      <p className="mt-3 break-all text-sm text-foreground">
                        {selectedDebtor.email}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-primary/10 bg-primary/[0.03] p-4">
                    <p className="text-xs uppercase tracking-wide text-primary">
                      Recommended action
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                      This debtor is ready to be claimed into your queue. Once assigned,
                      the next expected step is first contact and invoice delivery.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => onAssignToMe?.(selectedDebtor.id)}
                      className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Assign to me
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => onOpenDebtor?.(selectedDebtor.id)}
                      className="flex-1 rounded-xl"
                    >
                      Review account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}