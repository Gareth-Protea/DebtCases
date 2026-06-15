import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Gavel,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  UserCircle2,
} from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Extend the workflow status type to include the intermediate follow‑up stage.
export type WorkflowStatus =
  | "UNASSIGNED"
  | "FIRST_CONTACT"
  | "REMINDER_7D"
  | "FOLLOW_UP_7D"
  | "REMINDER_14D"
  | "RESOLUTION"
  | "ITC"
  | "LEGAL"
  | "ARRANGEMENT"
  | "PAID";

export interface MasterDebtorRow {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  email: string;
  area: string;
  daysSinceTermination: number;
  outstandingBalance: number;
  assignedTo?: string | null;
  workflowStatus: WorkflowStatus;
  priority: "High" | "Medium" | "Low";
  nextActionDue: string;
  lastActionLabel: string;
  recommendedPath?: "ITC" | "LEGAL" | null;
}

interface MasterWorkflowBoardProps {
  debtors: MasterDebtorRow[];
  activeFilter?: "ALL" | WorkflowStatus;
  onClearFilter?: () => void;
}

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const priorityStyles = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
  Low: "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
};

const statusStyles: Record<WorkflowStatus, string> = {
  UNASSIGNED: "bg-muted text-muted-foreground border-border",
  FIRST_CONTACT: "bg-primary/8 text-primary border-primary/15",
  REMINDER_7D: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
  FOLLOW_UP_7D:
    "bg-[hsl(265,72%,58%)]/12 text-[hsl(265,70%,38%)] border-[hsl(265,72%,58%)]/20",
  REMINDER_14D:
    "bg-[hsl(24,92%,56%)]/12 text-[hsl(24,82%,42%)] border-[hsl(24,92%,56%)]/20",
  RESOLUTION: "bg-primary/10 text-primary border-primary/20",
  ITC: "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
  LEGAL: "bg-destructive/10 text-destructive border-destructive/20",
  ARRANGEMENT:
    "bg-[hsl(45,96%,58%)]/18 text-[hsl(40,90%,32%)] border-[hsl(45,96%,58%)]/30",
  PAID: "bg-secondary/10 text-[hsl(142,100%,25%)] border-secondary/20",
};

const priorityRank = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function getStatusLabel(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "Unassigned";
    case "FIRST_CONTACT":
      return "First contact";
    case "REMINDER_7D":
      return "Reminder 7D";
    case "FOLLOW_UP_7D":
      return "Follow up 7D";
    case "REMINDER_14D":
      return "Reminder 14D";
    case "RESOLUTION":
      return "Resolution";
    case "ITC":
      return "ITC";
    case "LEGAL":
      return "Legal";
    case "ARRANGEMENT":
      return "Arrangement";
    case "PAID":
      return "Paid";
    default:
      return status;
  }
}

function getStageSummary(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "Awaiting collector ownership";
    case "FIRST_CONTACT":
      return "Make contact and send invoice";
    case "REMINDER_7D":
      return "7-day reminder cycle running";
    case "FOLLOW_UP_7D":
      return "Post follow-up reminder period";
    case "REMINDER_14D":
      return "Final reminder cycle before decision";
    case "RESOLUTION":
      return "Choose the final debtor route";
    case "ITC":
      return "Proceeding down ITC route";
    case "LEGAL":
      return "Handed over for legal action";
    case "ARRANGEMENT":
      return "Payment arrangement in place";
    case "PAID":
      return "Recovered and closed";
    default:
      return "";
  }
}

function getFlowIndex(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return 0;
    case "FIRST_CONTACT":
      return 1;
    case "REMINDER_7D":
      return 2;
    case "FOLLOW_UP_7D":
      return 3;
    case "REMINDER_14D":
      return 4;
    case "RESOLUTION":
      return 5;
    case "ITC":
    case "LEGAL":
    case "ARRANGEMENT":
    case "PAID":
      return 6;
    default:
      return 0;
  }
}

function getFlowPercent(status: WorkflowStatus) {
  // There are now seven discrete steps (0‑6), so divide by 6 to compute completion percentage.
  return (getFlowIndex(status) / 6) * 100;
}

function getProgressGradient(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "linear-gradient(90deg, hsl(220, 8%, 62%) 0%, hsl(220, 8%, 52%) 100%)";
    case "FIRST_CONTACT":
      return "linear-gradient(90deg, hsl(220,100%,15%) 0%, hsl(220,100%,28%) 100%)";
    case "REMINDER_7D":
      return "linear-gradient(90deg, hsl(341,72%,74%) 0%, hsl(341,72%,62%) 100%)";
    case "FOLLOW_UP_7D":
      return "linear-gradient(90deg, hsl(265,72%,70%) 0%, hsl(265,72%,60%) 100%)";
    case "REMINDER_14D":
      return "linear-gradient(90deg, hsl(24,92%,56%) 0%, hsl(32,92%,60%) 100%)";
    case "RESOLUTION":
      return "linear-gradient(90deg, hsl(220,100%,15%) 0%, hsl(142,100%,44%) 100%)";
    case "ITC":
      return "linear-gradient(90deg, hsl(142,100%,44%) 0%, hsl(142,100%,34%) 100%)";
    case "LEGAL":
      return "linear-gradient(90deg, hsl(0,84%,60%) 0%, hsl(0,74%,52%) 100%)";
    case "ARRANGEMENT":
      return "linear-gradient(90deg, hsl(45,96%,58%) 0%, hsl(39,90%,52%) 100%)";
    case "PAID":
      return "linear-gradient(90deg, hsl(142,100%,44%) 0%, hsl(142,100%,30%) 100%)";
    default:
      return "linear-gradient(90deg, hsl(220, 8%, 62%) 0%, hsl(220, 8%, 52%) 100%)";
  }
}

function getRouteLabel(status: WorkflowStatus, recommendedPath?: "ITC" | "LEGAL" | null) {
  if (status === "LEGAL") return "Legal route";
  if (status === "ITC") return "ITC route";
  if (status === "ARRANGEMENT") return "Arrangement";
  if (status === "PAID") return "Recovered";
  return recommendedPath === "LEGAL" ? "Likely legal" : "Likely ITC";
}

export function MasterWorkflowBoard({
  debtors,
  activeFilter = "ALL",
  onClearFilter,
}: MasterWorkflowBoardProps) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...debtors]
      .filter((debtor) => {
        if (activeFilter !== "ALL" && debtor.workflowStatus !== activeFilter) {
          return false;
        }

        if (!term) return true;

        return [
          debtor.name,
          debtor.accountNumber,
          debtor.contactName,
          debtor.phone,
          debtor.email,
          debtor.area,
          debtor.assignedTo ?? "",
          debtor.nextActionDue,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.outstandingBalance - a.outstandingBalance;
      });
  }, [activeFilter, debtors, search]);

  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Debtor operations table
            </CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              A cleaner, case-first view of your debtor register. Filter by workflow
              stage, search quickly, and open a full case workspace when action is needed.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search debtors, accounts, contacts..."
                className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary/30"
              />
            </div>

            {activeFilter !== "ALL" ? (
              <Button variant="outline" className="rounded-2xl" onClick={onClearFilter}>
                Clear filter
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            {filteredRows.length} visible rows
          </span>

          {activeFilter !== "ALL" ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Filtered by {getStatusLabel(activeFilter)}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        <div className="hidden xl:grid xl:grid-cols-[1.6fr_0.95fr_1.1fr_1.05fr_0.95fr_0.85fr] xl:gap-4 xl:px-4 xl:pb-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Debtor
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workflow
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next action
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Owner
          </div>
          <div className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Balance
          </div>
        </div>

        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-10 text-center">
              <p className="text-lg font-medium text-foreground">No debtors found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try clearing the filter or using a different search term.
              </p>
            </div>
          ) : (
            filteredRows.map((debtor) => {
              const flowPercent = getFlowPercent(debtor.workflowStatus);
              const gradient = getProgressGradient(debtor.workflowStatus);
              const routeLabel = getRouteLabel(
                debtor.workflowStatus,
                debtor.recommendedPath,
              );

              return (
                <div
                  key={debtor.id}
                  className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
                >
                  <div className="grid gap-4 xl:grid-cols-[1.6fr_0.95fr_1.1fr_1.05fr_0.95fr_0.85fr] xl:items-center">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">
                          {debtor.name}
                        </p>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[debtor.priority]}`}
                        >
                          {debtor.priority}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4 text-primary" />
                          {debtor.contactName}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          {debtor.phone}
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-primary" />
                          {debtor.accountNumber}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {debtor.area}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[debtor.workflowStatus]}`}
                      >
                        {getStatusLabel(debtor.workflowStatus)}
                      </span>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {debtor.daysSinceTermination} days since termination
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        {debtor.workflowStatus === "LEGAL" ? (
                          <Gavel className="h-3.5 w-3.5" />
                        ) : (
                          <Landmark className="h-3.5 w-3.5" />
                        )}
                        {routeLabel}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Flow progress</span>
                          <span className="font-medium text-foreground">
                            {Math.round(flowPercent)}%
                          </span>
                        </div>

                        <div className="h-2.5 rounded-full bg-muted">
                          <div
                            className="h-2.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${flowPercent}%`,
                              background: gradient,
                            }}
                          />
                        </div>
                      </div>

                      <p className="text-sm leading-6 text-muted-foreground">
                        {getStageSummary(debtor.workflowStatus)}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4 text-primary" />
                        Next action
                      </div>
                      <p className="text-sm font-medium leading-6 text-foreground">
                        {debtor.nextActionDue}
                      </p>

                      <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary w-fit">
                        {debtor.lastActionLabel}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        Owner
                      </div>

                      <p className="text-sm font-medium text-foreground">
                        {debtor.assignedTo ?? "Unassigned"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {debtor.assignedTo
                          ? "Collector already owns this case"
                          : "Needs collector allocation"}
                      </p> 
                    </div>

                    <div className="flex flex-col items-start gap-3 xl:items-end">
                      <div className="space-y-1 xl:text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Balance
                        </p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground">
                          {currency.format(debtor.outstandingBalance)}
                        </p>
                      </div>

                      <Button
                        className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setLocation(`/debt-manager/debtors/${debtor.id}`)}
                      >
                        Open case
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}