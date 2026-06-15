import { useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  GitBranch,
  Landmark,
  Mail,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";

// Reuse the WorkflowStatus type from the master workflow board so status mappings remain consistent.
import type { WorkflowStatus } from "./ui/master-workflow-board";

import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// Stub out components that were used in the original master list page.  The
// redesigned page no longer relies on these imports, but the old
// component remains in this file for reference.  Providing simple
// placeholders avoids unused variable errors during compilation.
const Filter = () => null;
const StatusFilterCard: any = () => null;
const MasterWorkflowBoard: any = () => null;

type StatusFilter = "ALL" | WorkflowStatus;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface DebtCaseRow {
  DebtCaseID: number | string;
  AccountNo: string;
  ComplexID?: string | null;
  ComplexName?: string | null;
  DebtorName: string;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  ProteaAmount?: number | string | null;
  LandlordAmount?: number | string | null;
  TotalOutstanding?: number | string | null;
  TerminationDate?: string | null;
  DebtorQualifiedDate?: string | null;
  CurrentStatusID?: number | string | null;
  CurrentStatusName?: string | null;
  StatusStartedAt?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Priority?: "Low" | "Medium" | "High" | "Critical" | string | null;
  RecommendedPath?: "ITC" | "LEGAL" | "ARRANGEMENT" | "PAID" | string | null;
  InvoiceSent?: boolean | number | string | null;
  InvoiceSentAt?: string | null;
  FinalDemandSent?: boolean | number | string | null;
  FinalDemandSentAt?: string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  ResolutionType?: string | null;
  ArrangementActive?: boolean | number | string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
  DaysSinceTermination?: number | string | null;
  InternalNotes?: string | null;
}

// ── Additional Types for Master List ────────────────────────────────
// DebtCaseAgent represents a collector available for assignment.  The
// shape matches the API response from /api/debt-manager/agents.
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

// MasterDebtorRow is a transformed shape of a raw debt case row used
// purely for display purposes on the master list page.  It flattens
// several properties and computes derived fields like days since
// termination.
interface MasterDebtorRow {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  email: string;
  area: string;
  daysSinceTermination: number;
  outstandingBalance: number;
  assignedTo: string | null;
  priority: "High" | "Medium" | "Low";
  workflowStatus: WorkflowStatus;
  nextActionDue: string;
  lastActionLabel: string;
  recommendedPath: string | null;
}

// We'll use compact pill-style buttons rather than card-like filters, so remove the StatusFilterCard component.

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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function mapPriority(priority?: string | null): "High" | "Medium" | "Low" {
  const normalized = normalizeText(priority);
  if (normalized === "critical" || normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
}

function mapWorkflowStatus(row: DebtCaseRow): WorkflowStatus {
  const status = normalizeText(row.CurrentStatusName);
  const recommended = normalizeText(row.RecommendedPath);

  if (status === "unassigned") return "UNASSIGNED";
  if (status === "first_contact" || status === "invoice_due") return "FIRST_CONTACT";
  if (status === "reminder_7d") return "REMINDER_7D";
  if (status === "follow_up_7d" || status === "post_follow_up_7d") {
    return "FOLLOW_UP_7D";
  }
  if (status === "reminder_14d" || status === "final_demand") return "REMINDER_14D";
  if (status === "resolution" || status === "escalation_manager") return "RESOLUTION";
  if (status === "arrangement") return "ARRANGEMENT";
  if (status === "paid") return "PAID";
  if (status === "legal") return "LEGAL";

  if (status === "itc") return "ITC";
  if (status === "itc_legal") {
    return recommended === "legal" ? "LEGAL" : "ITC";
  }

  if (asBool(row.PaymentReceived)) return "PAID";
  return "UNASSIGNED";
}

function getNextActionDue(row: DebtCaseRow, workflowStatus: WorkflowStatus): string {
  switch (workflowStatus) {
    case "UNASSIGNED":
      return "Assign collector and start first contact";
    case "FIRST_CONTACT":
      return asBool(row.InvoiceSent)
        ? "Confirm receipt and monitor payment"
        : "Send invoice and make first contact";
    case "REMINDER_7D":
      return row.Reminder7DueAt
        ? `7-day follow-up due ${formatShortDate(row.Reminder7DueAt)}`
        : "7-day reminder cycle running";
    case "FOLLOW_UP_7D":
      return row.Reminder14DueAt
        ? `Final demand due ${formatShortDate(row.Reminder14DueAt)}`
        : "Follow-up sent; waiting 7 days";
    case "REMINDER_14D":
      return row.Reminder14DueAt
        ? `14-day decision due ${formatShortDate(row.Reminder14DueAt)}`
        : "Final demand cycle running";
    case "RESOLUTION":
      return "Choose ITC, legal, arrangement, or paid";
    case "ITC":
      return "Monitor ITC route progress";
    case "LEGAL":
      return "Monitor legal handover";
    case "ARRANGEMENT":
      return "Track arrangement compliance";
    case "PAID":
      return "Case recovered and ready to close";
    default:
      return "Review case";
  }
}

function getLastActionLabel(row: DebtCaseRow, workflowStatus: WorkflowStatus): string {
  if (asBool(row.PaymentReceived) && row.PaymentReceivedAt) {
    return `Payment received ${formatShortDate(row.PaymentReceivedAt)}`;
  }

  if (asBool(row.FinalDemandSent) && row.FinalDemandSentAt) {
    return `Final demand sent ${formatShortDate(row.FinalDemandSentAt)}`;
  }

  if (asBool(row.InvoiceSent) && row.InvoiceSentAt) {
    return `Invoice sent ${formatShortDate(row.InvoiceSentAt)}`;
  }

  switch (workflowStatus) {
    case "UNASSIGNED":
      return "Debtor qualified from arrears";
    case "FIRST_CONTACT":
      return "Ready for outreach";
    case "REMINDER_7D":
      return "Invoice and contact stage completed";
    case "FOLLOW_UP_7D":
      return "Follow‑up message sent";
    case "REMINDER_14D":
      return "7-day cycle completed";
    case "RESOLUTION":
      return "Waiting periods completed";
    case "ITC":
      return "Escalated to ITC";
    case "LEGAL":
      return "Escalated to legal";
    case "ARRANGEMENT":
      return "Arrangement activated";
    case "PAID":
      return "Recovered";
    default:
      return "Updated";
  }
}

function exportDebtorsCsv(rows: MasterDebtorRow[]) {
  const headers = [
    "Debtor",
    "Account Number",
    "Contact Name",
    "Phone",
    "Email",
    "Area",
    "Days Since Termination",
    "Outstanding Balance",
    "Assigned To",
    "Priority",
    "Workflow Status",
    "Next Action",
    "Last Action",
    "Recommended Path",
  ];

  const csvRows = rows.map((row) => [
    row.name,
    row.accountNumber,
    row.contactName,
    row.phone,
    row.email,
    row.area,
    String(row.daysSinceTermination),
    String(row.outstandingBalance),
    row.assignedTo ?? "",
    row.priority,
    row.workflowStatus,
    row.nextActionDue,
    row.lastActionLabel,
    row.recommendedPath ?? "",
  ]);

  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const csvContent = [headers, ...csvRows]
    .map((line) => line.map((cell) => escapeCell(cell)).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "debt-master-list.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function OldMasterListPage() {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");

  const casesQuery = useQuery({
    queryKey: ["debt-manager", "cases"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseRow[]>>("/api/debt-manager/cases"),
  });

  const rawCases = casesQuery.data?.data ?? [];

  const masterDebtors = useMemo<MasterDebtorRow[]>(() => {
    return rawCases.map((row) => {
      const workflowStatus = mapWorkflowStatus(row);

      return {
        id: String(row.DebtCaseID),
        name: row.DebtorName,
        accountNumber: row.AccountNo,
        contactName: row.DebtorName,
        phone: row.ContactPhone ?? "No phone loaded",
        email: row.ContactEmail ?? "No email loaded",
        area: row.ComplexName ?? "Unknown area",
        daysSinceTermination: asNumber(row.DaysSinceTermination),
        outstandingBalance: asNumber(row.TotalOutstanding),
        assignedTo: row.CurrentOwnerName ?? null,
        priority: mapPriority(row.Priority),
        workflowStatus,
        nextActionDue: getNextActionDue(row, workflowStatus),
        lastActionLabel: getLastActionLabel(row, workflowStatus),
        recommendedPath:
          normalizeText(row.RecommendedPath) === "legal" ? "LEGAL" : "ITC",
      };
    });
  }, [rawCases]);

  const totalDebtOutstanding = useMemo(
    () =>
      masterDebtors.reduce((sum, debtor) => sum + debtor.outstandingBalance, 0),
    [masterDebtors],
  );

  const assignedCount = masterDebtors.filter((item) => item.assignedTo).length;

  const activeFlowCount = masterDebtors.filter(
    (item) =>
      item.workflowStatus !== "UNASSIGNED" &&
      item.workflowStatus !== "PAID" &&
      item.workflowStatus !== "ARRANGEMENT",
  ).length;

  const highValueCount = masterDebtors.filter(
    (item) => item.outstandingBalance >= 50000,
  ).length;

  const statusCounts: Record<WorkflowStatus, number> = {
    UNASSIGNED: masterDebtors.filter((item) => item.workflowStatus === "UNASSIGNED").length,
    FIRST_CONTACT: masterDebtors.filter((item) => item.workflowStatus === "FIRST_CONTACT").length,
    REMINDER_7D: masterDebtors.filter((item) => item.workflowStatus === "REMINDER_7D").length,
    FOLLOW_UP_7D: masterDebtors.filter((item) => item.workflowStatus === "FOLLOW_UP_7D").length,
    REMINDER_14D: masterDebtors.filter((item) => item.workflowStatus === "REMINDER_14D").length,
    RESOLUTION: masterDebtors.filter((item) => item.workflowStatus === "RESOLUTION").length,
    ITC: masterDebtors.filter((item) => item.workflowStatus === "ITC").length,
    LEGAL: masterDebtors.filter((item) => item.workflowStatus === "LEGAL").length,
    ARRANGEMENT: masterDebtors.filter((item) => item.workflowStatus === "ARRANGEMENT").length,
    PAID: masterDebtors.filter((item) => item.workflowStatus === "PAID").length,
  };

  const filterCards = [
    {
      key: "ALL" as StatusFilter,
      label: "All",
      helper: "Show entire register",
      count: masterDebtors.length,
      accentClass: "bg-primary",
    },
    {
      key: "UNASSIGNED" as StatusFilter,
      label: "Unassigned",
      helper: "Ready for allocation",
      count: statusCounts.UNASSIGNED,
      accentClass: "bg-muted-foreground",
    },
    {
      key: "FIRST_CONTACT" as StatusFilter,
      label: "First Contact",
      helper: "Contact and invoice",
      count: statusCounts.FIRST_CONTACT,
      accentClass: "bg-primary",
    },
    {
      key: "REMINDER_7D" as StatusFilter,
      label: "Reminder 7D",
      helper: "Early reminder cycle",
      count: statusCounts.REMINDER_7D,
      accentClass: "bg-accent",
    },
    {
      key: "FOLLOW_UP_7D" as StatusFilter,
      label: "Follow up 7D",
      helper: "Post follow‑up wait",
      count: statusCounts.FOLLOW_UP_7D,
      accentClass: "bg-[hsl(265,72%,58%)]",
    },
    {
      key: "REMINDER_14D" as StatusFilter,
      label: "Reminder 14D",
      helper: "Final reminder cycle",
      count: statusCounts.REMINDER_14D,
      accentClass: "bg-[hsl(24,92%,56%)]",
    },
    {
      key: "RESOLUTION" as StatusFilter,
      label: "Resolution",
      helper: "Decision point",
      count: statusCounts.RESOLUTION,
      accentClass: "bg-primary",
    },
    {
      key: "ITC" as StatusFilter,
      label: "ITC",
      helper: "Credit route",
      count: statusCounts.ITC,
      accentClass: "bg-secondary",
    },
    {
      key: "LEGAL" as StatusFilter,
      label: "Legal",
      helper: "Escalated cases",
      count: statusCounts.LEGAL,
      accentClass: "bg-destructive",
    },
    {
      key: "ARRANGEMENT" as StatusFilter,
      label: "Arrangement",
      helper: "Payment plans",
      count: statusCounts.ARRANGEMENT,
      accentClass: "bg-[hsl(45,96%,58%)]",
    },
    {
      key: "PAID" as StatusFilter,
      label: "Paid",
      helper: "Recovered accounts",
      count: statusCounts.PAID,
      accentClass: "bg-secondary",
    },
  ];

  const visibleDebtors =
    activeFilter === "ALL"
      ? masterDebtors
      : masterDebtors.filter((item) => item.workflowStatus === activeFilter);

  const isLoading = casesQuery.isLoading;
  const hasError = casesQuery.isError;

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Master list"
        title="All debtors"
        description="This is the main debtor operations workspace. Scan the full debtor register, filter by workflow stage, and open individual cases for detailed action."
        actions={
          <>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Filter className="mr-2 h-4 w-4" />
              Live filters
            </Button>

            <Button
              className="bg-white text-primary hover:bg-white/90"
              onClick={() => exportDebtorsCsv(visibleDebtors)}
              disabled={!visibleDebtors.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Loading debtor master list...
          </p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">
            Could not load the debtor master list.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the backend case endpoint and SOAP service, then refresh the page.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total debt outstanding"
              value={formatCurrency(totalDebtOutstanding)}
              helper="Total value across all debtor accounts"
              icon={Landmark}
              tone="primary"
            />
            <StatCard
              label="Total debtors"
              value={String(masterDebtors.length)}
              helper="All qualifying debtor accounts"
              icon={Users}
              tone="primary"
            />
            <StatCard
              label="Assigned cases"
              value={String(assignedCount)}
              helper="Currently owned by agents"
              icon={Mail}
              tone="secondary"
            />
            <StatCard
              label="High-value cases"
              value={String(highValueCount)}
              helper="Balances above R50 000"
              icon={GitBranch}
              tone="accent"
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  Status filters
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click a stage to filter the debtor table by workflow status.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeFlowCount > 0 ? (
                  <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    Active flow: {activeFlowCount}
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Current filter:{" "}
                  {activeFilter === "ALL"
                    ? "All"
                    : filterCards.find((item) => item.key === activeFilter)?.label}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {filterCards.map((item) => (
                <StatusFilterCard
                  key={item.key}
                  label={item.label}
                  helper={item.helper}
                  count={item.count}
                  isActive={activeFilter === item.key}
                  accentClass={item.accentClass}
                  onClick={() => setActiveFilter(item.key)}
                />
              ))}
            </div>
          </section>

          <MasterWorkflowBoard
            debtors={masterDebtors}
            activeFilter={activeFilter}
            onClearFilter={() => setActiveFilter("ALL")}
          />
        </>
      )}
    </DebtAppShell>
  );
}

// ── Redesigned Master List Page ────────────────────────────────────────
// The new MasterListPage component completely replaces the original
// implementation above.  It mirrors the layout and interaction patterns of
// the Agent list page, offering compact status pills, a search bar,
// assignment controls, and a streamlined table.  Managers can
// quickly find high‑priority cases and allocate them to agents.

export default function MasterListPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State hooks for status filter, search query, and selected agent
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | number | null>(null);

  // Fetch all debt records from the legacy DebtCollector table via the
  // records endpoint.  The backend returns the same fields as the
  // current debt case API but drawn from the old import table.
  const casesQuery = useQuery({
    queryKey: ["debt-manager", "records"],
    queryFn: () => apiRequest<ApiResponse<DebtCaseRow[]>>("/api/debt-manager/records"),
  });
  // Fetch all agents for assignment
  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () => apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  // Mutation to assign a case to an agent
  const assignMutation = useMutation({
    mutationFn: async (payload: { caseId: string | number; agentId: string | number }) => {
      const { caseId, agentId } = payload;
      return apiRequest(`/api/debt-manager/records/${caseId}/assign`, {
        method: "POST",
        body: JSON.stringify({ agentId }),
      });
    },
    onSuccess: () => {
      // Invalidate the records query so the assigned agent column updates.
      queryClient.invalidateQueries(["debt-manager", "records"]);
    },
  });

  // Transform raw cases into display objects
  const rawCases: DebtCaseRow[] = casesQuery.data?.data ?? [];
  const masterDebtors: MasterDebtorRow[] = useMemo(() => {
    return rawCases.map((row) => {
      const workflowStatus = mapWorkflowStatus(row);
      return {
        id: String(row.DebtCaseID),
        name: row.DebtorName,
        accountNumber: row.AccountNo,
        contactName: row.DebtorName,
        phone: row.ContactPhone ?? "No phone loaded",
        email: row.ContactEmail ?? "No email loaded",
        area: row.ComplexName ?? "Unknown area",
        daysSinceTermination: asNumber(row.DaysSinceTermination),
        outstandingBalance: asNumber(row.TotalOutstanding),
        assignedTo: row.CurrentOwnerName ?? null,
        priority: mapPriority(row.Priority),
        workflowStatus,
        nextActionDue: getNextActionDue(row, workflowStatus),
        lastActionLabel: getLastActionLabel(row, workflowStatus),
        recommendedPath: normalizeText(row.RecommendedPath) === "legal" ? "LEGAL" : "ITC",
      };
    });
  }, [rawCases]);

  // Statistics for summary cards
  const totalDebtOutstanding = useMemo(
    () => masterDebtors.reduce((sum, d) => sum + d.outstandingBalance, 0),
    [masterDebtors],
  );
  const totalDebtors = masterDebtors.length;
  const assignedCount = masterDebtors.filter((d) => d.assignedTo).length;
  const highValueCount = masterDebtors.filter((d) => d.outstandingBalance >= 50000).length;

  // Counts by workflow status
  const statusCounts: Record<WorkflowStatus, number> = useMemo(() => {
    return {
      UNASSIGNED: masterDebtors.filter((d) => d.workflowStatus === "UNASSIGNED").length,
      FIRST_CONTACT: masterDebtors.filter((d) => d.workflowStatus === "FIRST_CONTACT").length,
      REMINDER_7D: masterDebtors.filter((d) => d.workflowStatus === "REMINDER_7D").length,
      FOLLOW_UP_7D: masterDebtors.filter((d) => d.workflowStatus === "FOLLOW_UP_7D").length,
      REMINDER_14D: masterDebtors.filter((d) => d.workflowStatus === "REMINDER_14D").length,
      RESOLUTION: masterDebtors.filter((d) => d.workflowStatus === "RESOLUTION").length,
      ITC: masterDebtors.filter((d) => d.workflowStatus === "ITC").length,
      LEGAL: masterDebtors.filter((d) => d.workflowStatus === "LEGAL").length,
      ARRANGEMENT: masterDebtors.filter((d) => d.workflowStatus === "ARRANGEMENT").length,
      PAID: masterDebtors.filter((d) => d.workflowStatus === "PAID").length,
    };
  }, [masterDebtors]);

  // Define filter buttons
  const filterButtons: Array<{ key: StatusFilter; label: string; count: number }> = useMemo(
    () => [
      { key: "ALL", label: "All", count: totalDebtors },
      { key: "UNASSIGNED", label: "Unassigned", count: statusCounts.UNASSIGNED },
      { key: "FIRST_CONTACT", label: "First contact", count: statusCounts.FIRST_CONTACT },
      { key: "REMINDER_7D", label: "7 day wait", count: statusCounts.REMINDER_7D },
      { key: "FOLLOW_UP_7D", label: "Second 7 day", count: statusCounts.FOLLOW_UP_7D },
      { key: "REMINDER_14D", label: "14 day wait", count: statusCounts.REMINDER_14D },
      { key: "RESOLUTION", label: "Resolution", count: statusCounts.RESOLUTION },
      { key: "ITC", label: "ITC", count: statusCounts.ITC },
      { key: "LEGAL", label: "Legal", count: statusCounts.LEGAL },
      { key: "ARRANGEMENT", label: "Arrangement", count: statusCounts.ARRANGEMENT },
      { key: "PAID", label: "Paid", count: statusCounts.PAID },
    ],
    [statusCounts, totalDebtors],
  );

  // Apply filters
  const filteredByStatus = useMemo(() => {
    if (activeFilter === "ALL") return masterDebtors;
    return masterDebtors.filter((d) => d.workflowStatus === activeFilter);
  }, [activeFilter, masterDebtors]);

  const normalizedQuery = normalizeText(searchQuery);
  const filteredDebtors = useMemo(() => {
    if (!normalizedQuery) return filteredByStatus;
    return filteredByStatus.filter((d) => {
      const haystack = `${normalizeText(d.name)} ${normalizeText(d.accountNumber)} ${normalizeText(d.contactName)} ${normalizeText(d.phone)} ${normalizeText(d.email)} ${normalizeText(d.area)}`;
      return haystack.includes(normalizedQuery);
    });
  }, [filteredByStatus, normalizedQuery]);

  const isLoading = casesQuery.isLoading || agentsQuery.isLoading;
  const hasError = casesQuery.isError || agentsQuery.isError;

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Master list"
        title="Debt register"
        description="Management view for the full debt case register. Quickly search, filter and assign high‑priority cases."
        actions={
          <Button
            className="bg-white text-primary hover:bg-white/90"
            onClick={() => exportDebtorsCsv(filteredDebtors)}
            disabled={!filteredDebtors.length}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading master debt list...</p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">Could not load the debt list.</p>
          <p className="mt-2 text-sm text-muted-foreground">Check the backend endpoints and refresh.</p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total outstanding"
              value={formatCurrency(totalDebtOutstanding)}
              helper="Total value across all debtors"
              icon={Landmark}
              tone="primary"
            />
            <StatCard
              label="Total debtors"
              value={String(totalDebtors)}
              helper="All qualifying accounts"
              icon={Users}
              tone="primary"
            />
            <StatCard
              label="Assigned cases"
              value={String(assignedCount)}
              helper="Cases currently owned by collectors"
              icon={Mail}
              tone="secondary"
            />
            <StatCard
              label="High‑value cases"
              value={String(highValueCount)}
              helper="Balances above R50 000"
              icon={GitBranch}
              tone="accent"
            />
          </section>

          {/* Filter and search controls */}
          <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Status pills */}
              <div className="flex flex-wrap gap-2">
                {filterButtons.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveFilter(item.key)}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      activeFilter === item.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
              {/* Search and agent select */}
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="text"
                  placeholder="Search debtors…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-60"
                />
                <select
                  value={selectedAgentId ?? ""}
                  onChange={(e) =>
                    setSelectedAgentId(e.target.value === "" ? null : e.target.value)
                  }
                  className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="">Assign to…</option>
                  {agentsQuery.data?.data?.map((agent) => (
                    <option key={String(agent.ID)} value={String(agent.ID)}>
                      {agent.AgentName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Results table */}
          <section className="rounded-[28px] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-5 py-5">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Debtor register
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {filteredDebtors.length} case{filteredDebtors.length === 1 ? "" : "s"} match your current filters and search.
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
                    <th className="px-5 py-3 font-medium text-muted-foreground">Assigned to</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebtors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No debt cases match the current view.
                      </td>
                    </tr>
                  ) : (
                    filteredDebtors.map((item) => {
                      return (
                        <tr
                          key={item.id}
                          className="border-t border-border/70 transition hover:bg-muted/20"
                        >
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-medium text-foreground">{item.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{item.phone}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-foreground">{item.accountNumber}</td>
                          <td className="px-5 py-4 text-muted-foreground">{item.area}</td>
                          <td className="px-5 py-4 text-foreground">{item.daysSinceTermination}</td>
                          <td className="px-5 py-4 font-medium text-foreground">{formatCurrency(item.outstandingBalance)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                item.priority === "High"
                                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                                  : item.priority === "Medium"
                                  ? "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]"
                                  : "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${(() => {
                                const normalized = normalizeText(item.workflowStatus);
                                if (normalized.includes("legal") || normalized.includes("itc") || normalized.includes("escalation")) {
                                  return "border-destructive/20 bg-destructive/10 text-destructive";
                                }
                                if (normalized.includes("reminder")) {
                                  return "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]";
                                }
                                if (normalized.includes("paid")) {
                                  return "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]";
                                }
                                return "border-primary/20 bg-primary/5 text-primary";
                              })()}`}
                            >
                              {item.workflowStatus.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{item.assignedTo ?? "Unassigned"}</td>
                          <td className="px-5 py-4 text-right space-x-2">
                            <Button
                              size="sm"
                              className="rounded-xl bg-muted text-foreground hover:bg-muted/80"
                              disabled={!selectedAgentId || assignMutation.isLoading}
                              onClick={() => {
                                if (!selectedAgentId) return;
                                assignMutation.mutate({ caseId: item.id, agentId: selectedAgentId });
                              }}
                            >
                              Assign
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/debt-manager/debtors/${item.id}`)}
                              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Open
                              <ChevronRight className="ml-1 h-4 w-4" />
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