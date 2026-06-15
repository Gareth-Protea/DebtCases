import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  PhoneCall,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";

type AgentFilter = "ALL" | "FRESH" | "REMINDER" | "ESCALATED" | "HIGH_VALUE";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface DebtCaseAgent {
  ID: number | string;
  AgentName: string;
  Email: string;
  Phone?: string | null;
  AccessLevel?: number | string | null;
  DisplayTitle?: string | null;
  ExperiencePoints?: number | string | null;
  Level?: number | string | null;
  ShopCoins?: number | string | null;
  CurrentStreakDays?: number | string | null;
  ObjectivesCompleted?: number | string | null;
}

interface DebtCaseRow {
  DebtCaseID: number | string;
  AccountNo: string;
  ComplexID?: string | null;
  ComplexName?: string | null;
  DebtorName: string;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  TotalOutstanding?: number | string | null;
  CurrentStatusID?: number | string | null;
  CurrentStatusName?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Priority?: "Low" | "Medium" | "High" | "Critical" | string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  DebtorQualifiedDate?: string | null;
  DaysSinceTermination?: number | string | null;
  InternalNotes?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return false;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function resolveCurrentAgent(
  user: Record<string, unknown> | null | undefined,
  agents: DebtCaseAgent[],
): DebtCaseAgent | null {
  if (!user) return null;

  const userId = asNumber(user.id, NaN);
  if (Number.isFinite(userId)) {
    const byId = agents.find((agent) => asNumber(agent.ID, -1) === userId);
    if (byId) return byId;
  }

  const username = normalizeText(
    typeof user.username === "string" ? user.username : null,
  );
  const email = normalizeText(typeof user.email === "string" ? user.email : null);
  const name = normalizeText(typeof user.name === "string" ? user.name : null);

  return (
    agents.find((agent) => normalizeText(agent.Email) === email) ??
    agents.find((agent) => normalizeText(agent.AgentName) === username) ??
    agents.find((agent) => normalizeText(agent.AgentName) === name) ??
    null
  );
}

function mapPriority(priority?: string | null): "High" | "Medium" | "Low" {
  const normalized = normalizeText(priority);
  if (normalized === "critical" || normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
}

function isReminderCase(row: DebtCaseRow): boolean {
  const status = normalizeText(row.CurrentStatusName);
  return (
    status.includes("reminder") ||
    status.includes("final_demand") ||
    Boolean(parseDate(row.Reminder7DueAt)) ||
    Boolean(parseDate(row.Reminder14DueAt))
  );
}

function isEscalatedCase(row: DebtCaseRow): boolean {
  const status = normalizeText(row.CurrentStatusName);
  return (
    asBool(row.EscalatedToSuperior) ||
    status.includes("legal") ||
    status.includes("itc") ||
    status.includes("escalation")
  );
}

function isFreshCase(row: DebtCaseRow): boolean {
  const qualified = parseDate(row.DebtorQualifiedDate ?? row.CreatedAt);
  if (!qualified) return false;

  const now = new Date();
  const diffMs = now.getTime() - qualified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= 7;
}

function needsAttention(row: DebtCaseRow): boolean {
  const status = normalizeText(row.CurrentStatusName);

  return (
    isFreshCase(row) ||
    isReminderCase(row) ||
    status === "first_contact" ||
    status === "invoice_due"
  );
}

function getDisplayStatus(row: DebtCaseRow): string {
  if (asBool(row.PaymentReceived)) return "Paid";
  if (isEscalatedCase(row)) return "Escalated";
  if (isReminderCase(row)) return "Reminder stage";

  const status = normalizeText(row.CurrentStatusName);

  if (status === "first_contact" || status === "invoice_due") return "Needs contact";
  if (status === "arrangement") return "Arrangement";
  if (status === "resolution") return "Resolution";

  return row.CurrentStatusName ?? "Assigned";
}

function getFocusMessage(
  filter: AgentFilter,
  count: number,
  totalValue: number,
): string {
  switch (filter) {
    case "FRESH":
      return `${count} fresh cases recently entered your queue. Start here if you want to hit new debtors early.`;
    case "REMINDER":
      return `${count} reminder-stage cases need follow-up control. This is the queue to work when you want to prevent drift.`;
    case "ESCALATED":
      return `${count} escalated cases need visibility and closer management.`;
    case "HIGH_VALUE":
      return `${formatCurrency(totalValue)} sits in your high-value slice. Good focus area for bigger recovery wins.`;
    case "ALL":
    default:
      return `${count} active assigned debt cases in one clean working list.`;
  }
}

function getStatusBadgeClasses(status: string) {
  const normalized = normalizeText(status);

  if (
    normalized.includes("escalated") ||
    normalized.includes("legal") ||
    normalized.includes("itc")
  ) {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (normalized.includes("reminder")) {
    return "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]";
  }

  if (normalized.includes("paid")) {
    return "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]";
  }

  return "border-primary/20 bg-primary/5 text-primary";
}

function getPriorityBadgeClasses(priority: "High" | "Medium" | "Low") {
  if (priority === "High") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (priority === "Medium") {
    return "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]";
  }

  return "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]";
}

export default function AgentListPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [activeFilter, setActiveFilter] = useState<AgentFilter>("ALL");

  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  const agents = agentsQuery.data?.data ?? [];

  const currentAgent = useMemo(
    () =>
      resolveCurrentAgent(
        (user as Record<string, unknown> | null | undefined) ?? null,
        agents,
      ),
    [agents, user],
  );

  const currentAgentId = currentAgent ? asNumber(currentAgent.ID, NaN) : NaN;

  const agentCasesQuery = useQuery({
    queryKey: ["debt-manager", "agents", currentAgentId, "cases"],
    enabled: Number.isFinite(currentAgentId),
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseRow[]>>(
        `/api/debt-manager/agents/${currentAgentId}/cases`,
      ),
  });

  const assignedCases = agentCasesQuery.data?.data ?? [];

  const filteredCases = useMemo(() => {
    switch (activeFilter) {
      case "FRESH":
        return assignedCases.filter(isFreshCase);
      case "REMINDER":
        return assignedCases.filter(isReminderCase);
      case "ESCALATED":
        return assignedCases.filter(isEscalatedCase);
      case "HIGH_VALUE":
        return assignedCases.filter(
          (item) => asNumber(item.TotalOutstanding) >= 50000,
        );
      case "ALL":
      default:
        return assignedCases;
    }
  }, [activeFilter, assignedCases]);

  const agentName =
    currentAgent?.AgentName ??
    ((user as { username?: string | null } | null)?.username ?? "Current agent");

  const stats = useMemo(() => {
    const totalValue = assignedCases.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const contactDue = assignedCases.filter(needsAttention).length;
    const reminderCount = assignedCases.filter(isReminderCase).length;
    const freshCount = assignedCases.filter(isFreshCase).length;
    const escalatedCount = assignedCases.filter(isEscalatedCase).length;
    const highValueCount = assignedCases.filter(
      (item) => asNumber(item.TotalOutstanding) >= 50000,
    ).length;

    return {
      totalValue,
      contactDue,
      reminderCount,
      freshCount,
      escalatedCount,
      highValueCount,
    };
  }, [assignedCases]);

  const filterButtons: Array<{
    key: AgentFilter;
    label: string;
    count: number;
  }> = [
    { key: "ALL", label: "All cases", count: assignedCases.length },
    { key: "FRESH", label: "Fresh", count: stats.freshCount },
    { key: "REMINDER", label: "Reminder", count: stats.reminderCount },
    { key: "ESCALATED", label: "Escalated", count: stats.escalatedCount },
    { key: "HIGH_VALUE", label: "High value", count: stats.highValueCount },
  ];

  const filterValue = filteredCases.reduce(
    (sum, item) => sum + asNumber(item.TotalOutstanding),
    0,
  );

  const tableDescriptionMap: Record<AgentFilter, string> = {
    ALL: "A focused working list for the logged-in collector. This keeps the full book of work visible without making the page feel too heavy.",
    FRESH: "Newest debt cases in your workload that have recently entered debt collection.",
    REMINDER: "Cases in reminder or follow-up stages that need active control.",
    ESCALATED: "Cases that have moved into ITC, legal, or escalation-type workflows.",
    HIGH_VALUE: "Higher-value accounts so the agent can focus on larger recovery opportunities.",
  };

  const isLoading =
    authLoading ||
    agentsQuery.isLoading ||
    (Number.isFinite(currentAgentId) && agentCasesQuery.isLoading);

  const hasError = agentsQuery.isError || agentCasesQuery.isError;

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Agent list"
        title={`Assigned to ${agentName}`}
        description="This page is the collector's full working book. It keeps all active debt cases in one place, with cleaner filtering so the workload feels more manageable."
      />

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading agent workload...</p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">
            Could not load the agent case list.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the backend debt case endpoint and refresh the page.
          </p>
        </section>
      ) : !currentAgent ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="font-medium text-foreground">
            Could not match the signed-in user to a debt case agent.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure the authenticated user matches a row in DebtCaseAgents.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Assigned accounts"
              value={String(assignedCases.length)}
              helper="Current debtor workload"
              icon={ClipboardList}
              tone="primary"
            />
            <StatCard
              label="Needs attention"
              value={String(stats.contactDue)}
              helper="Fresh, contact, or reminder-stage cases"
              icon={PhoneCall}
              tone="accent"
            />
            <StatCard
              label="Reminder stage"
              value={String(stats.reminderCount)}
              helper="Follow-up control required"
              icon={Target}
              tone="secondary"
            />
            <StatCard
              label="Book value"
              value={formatCurrency(stats.totalValue)}
              helper="Total outstanding under this agent"
              icon={TrendingUp}
              tone="primary"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-secondary" />
                Workload view
              </div>

              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Keep the book manageable
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use focused views instead of trying to process the entire workload at
                once. This helps the collector move between new cases, reminders, and
                escalations without the page feeling too heavy.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {filterButtons.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveFilter(item.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      activeFilter === item.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Today's focus
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-muted/35 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <BellRing className="h-3.5 w-3.5 text-primary" />
                    Active filter
                  </div>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {filterButtons.find((item) => item.key === activeFilter)?.label}
                  </p>
                </div>

                <div className="rounded-2xl bg-muted/35 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 text-primary" />
                    Focus note
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {getFocusMessage(activeFilter, filteredCases.length, filterValue)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Filter count
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {filteredCases.length}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      Active owner
                    </div>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {agentName}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      High value
                    </div>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {stats.highValueCount}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Filter value
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatCurrency(filterValue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-5 py-5">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                My assigned debtors
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {tableDescriptionMap[activeFilter]}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/35">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-medium text-muted-foreground">Debtor</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Account</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Area</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Days</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Balance</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Priority</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Qualified</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No debt cases match this view right now.
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((item) => {
                      const priority = mapPriority(item.Priority);
                      const displayStatus = getDisplayStatus(item);

                      return (
                        <tr
                          key={String(item.DebtCaseID)}
                          className="border-t border-border/70 transition hover:bg-muted/20"
                        >
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-medium text-foreground">
                                {item.DebtorName}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.ContactPhone ?? "No phone loaded"}
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-foreground">{item.AccountNo}</td>

                          <td className="px-5 py-4 text-muted-foreground">
                            {item.ComplexName ?? "Unknown area"}
                          </td>

                          <td className="px-5 py-4 text-foreground">
                            {asNumber(item.DaysSinceTermination)}
                          </td>

                          <td className="px-5 py-4 font-medium text-foreground">
                            {formatCurrency(asNumber(item.TotalOutstanding))}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityBadgeClasses(
                                priority,
                              )}`}
                            >
                              {priority}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClasses(
                                displayStatus,
                              )}`}
                            >
                              {displayStatus}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-muted-foreground">
                            {formatShortDate(item.DebtorQualifiedDate ?? item.CreatedAt)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                setLocation(
                                  `/debt-manager/debtors/${String(item.DebtCaseID)}`,
                                )
                              }
                              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Open debt flow
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DebtAppShell>
  );
}