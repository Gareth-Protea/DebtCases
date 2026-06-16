import { useMemo, useState } from "react";
import {
  Download,
  GitBranch,
  Landmark,
  Mail,
  Users,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";

import type { WorkflowStatus } from "./ui/master-workflow-board";

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

interface MasterDebtorRow {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  email: string;
  area: string;
  terminationDate: string | null;
  daysSinceTermination: number;
  outstandingBalance: number;
  assignedTo: string | null;
  priority: "High" | "Medium" | "Low";
  workflowStatus: WorkflowStatus;
  nextActionDue: string;
  lastActionLabel: string;
  recommendedPath: string | null;
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

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinLastThreeYears(value?: string | null): boolean {
  const date = parseDate(value);
  if (!date) return false;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  cutoff.setHours(0, 0, 0, 0);

  return date >= cutoff;
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
    year: "numeric",
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
  const statusId = asNumber(row.CurrentStatusID, 0);

  if (status === "unassigned" || statusId === 8) return "UNASSIGNED";
  if (status === "first_contact" || status === "invoice_due" || statusId === 1 || statusId === 2) {
    return "FIRST_CONTACT";
  }
  if (status === "reminder_7d" || statusId === 3) return "REMINDER_7D";
  if (status === "follow_up_7d" || status === "post_follow_up_7d") return "FOLLOW_UP_7D";
  if (status === "reminder_14d" || status === "final_demand" || statusId === 4 || statusId === 5) {
    return "REMINDER_14D";
  }
  if (status === "resolution" || status === "escalation_manager" || statusId === 7 || statusId === 11) {
    return "RESOLUTION";
  }
  if (status === "arrangement" || statusId === 9 || asBool(row.ArrangementActive)) return "ARRANGEMENT";
  if (status === "paid" || statusId === 13 || asBool(row.PaymentReceived)) return "PAID";
  if (status === "legal" || statusId === 10) return "LEGAL";
  if (status === "itc" || statusId === 12) return "ITC";
  if (status === "itc_legal" || statusId === 6) {
    return recommended === "legal" ? "LEGAL" : "ITC";
  }

  return "UNASSIGNED";
}

function getStatusLabel(status: WorkflowStatus): string {
  switch (status) {
    case "UNASSIGNED":
      return "Unassigned";
    case "FIRST_CONTACT":
      return "First contact";
    case "REMINDER_7D":
      return "7 day wait";
    case "FOLLOW_UP_7D":
      return "Second 7 day";
    case "REMINDER_14D":
      return "14 day wait";
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

function getStatusBadgeClasses(status: WorkflowStatus): string {
  switch (status) {
    case "LEGAL":
    case "ITC":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "REMINDER_7D":
    case "FOLLOW_UP_7D":
    case "REMINDER_14D":
      return "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]";
    case "PAID":
      return "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]";
    case "ARRANGEMENT":
      return "border-[hsl(45,96%,58%)]/30 bg-[hsl(45,96%,58%)]/18 text-[hsl(40,90%,32%)]";
    default:
      return "border-primary/20 bg-primary/5 text-primary";
  }
}

function getPriorityBadgeClasses(priority: "High" | "Medium" | "Low"): string {
  if (priority === "High") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (priority === "Medium") return "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]";
  return "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]";
}

function getNextActionDue(row: DebtCaseRow, workflowStatus: WorkflowStatus): string {
  switch (workflowStatus) {
    case "UNASSIGNED":
      return "Import and assign to a collector";
    case "FIRST_CONTACT":
      return asBool(row.InvoiceSent) ? "Monitor payment or assign for action" : "Needs first contact";
    case "REMINDER_7D":
      return "Follow-up stage";
    case "FOLLOW_UP_7D":
      return "Second 7 day wait";
    case "REMINDER_14D":
      return "Final demand or decision stage";
    case "RESOLUTION":
      return "Choose final route";
    case "ITC":
      return "ITC route";
    case "LEGAL":
      return "Legal route";
    case "ARRANGEMENT":
      return "Payment arrangement";
    case "PAID":
      return "Recovered";
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

  return getNextActionDue(row, workflowStatus);
}

function exportDebtorsCsv(rows: MasterDebtorRow[]) {
  const headers = [
    "Debtor",
    "Account Number",
    "Contact Name",
    "Phone",
    "Email",
    "Area",
    "Termination Date",
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
    formatShortDate(row.terminationDate),
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
  link.download = "debt-collector-master-list.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function MasterListPage() {
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | number | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  // This endpoint should return only the last 3 years from DebtCollector.
  // Recommended backend WHERE clause:
  // WHERE dc.TerminationDate >= DATEADD(YEAR, -3, GETDATE())
  const recordsQuery = useQuery({
    queryKey: ["debt-manager", "records", "last-three-years"],
    queryFn: () => apiRequest<ApiResponse<DebtCaseRow[]>>("/api/debt-manager/records?years=3"),
  });

  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () => apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { recordId: string; agentId: string | number }) => {
      const { recordId, agentId } = payload;

      // This route should convert the old DebtCollector row into the new DebtCase row,
      // set the new case owner to agentId, and mark the old row as assigned/imported.
      return apiRequest<ApiResponse<unknown>>(
        `/api/debt-manager/records/${encodeURIComponent(recordId)}/assign`,
        {
          method: "POST",
          body: JSON.stringify({ agentId }),
        },
      );
    },
    onSuccess: async () => {
      setFeedback("Debt record imported and assigned successfully.");
      await queryClient.invalidateQueries({ queryKey: ["debt-manager", "records"] });
      await queryClient.invalidateQueries({ queryKey: ["debt-manager", "cases"] });
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Failed to import and assign debt record.");
    },
  });

  const rawRecords = recordsQuery.data?.data ?? [];

  const masterDebtors = useMemo<MasterDebtorRow[]>(() => {
    return rawRecords
      .filter((row) => isWithinLastThreeYears(row.TerminationDate))
      .map((row) => {
        const workflowStatus = mapWorkflowStatus(row);

        return {
          id: String(row.DebtCaseID),
          name: row.DebtorName,
          accountNumber: row.AccountNo,
          contactName: row.DebtorName,
          phone: row.ContactPhone ?? "No phone loaded",
          email: row.ContactEmail ?? "No email loaded",
          area: row.ComplexName ?? "Unknown area",
          terminationDate: row.TerminationDate ?? null,
          daysSinceTermination: asNumber(row.DaysSinceTermination),
          outstandingBalance: asNumber(row.TotalOutstanding),
          assignedTo: row.CurrentOwnerName ?? null,
          priority: mapPriority(row.Priority),
          workflowStatus,
          nextActionDue: getNextActionDue(row, workflowStatus),
          lastActionLabel: getLastActionLabel(row, workflowStatus),
          recommendedPath: normalizeText(row.RecommendedPath) === "legal" ? "LEGAL" : "ITC",
        };
      })
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }, [rawRecords]);

  const totalDebtOutstanding = useMemo(
    () => masterDebtors.reduce((sum, debtor) => sum + debtor.outstandingBalance, 0),
    [masterDebtors],
  );

  const totalDebtors = masterDebtors.length;
  const assignedCount = masterDebtors.filter((item) => item.assignedTo).length;
  const highValueCount = masterDebtors.filter((item) => item.outstandingBalance >= 50000).length;

  const statusCounts: Record<WorkflowStatus, number> = useMemo(
    () => ({
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
    }),
    [masterDebtors],
  );

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

  const filteredByStatus = useMemo(() => {
    if (activeFilter === "ALL") return masterDebtors;
    return masterDebtors.filter((item) => item.workflowStatus === activeFilter);
  }, [activeFilter, masterDebtors]);

  const normalizedQuery = normalizeText(searchQuery);
  const filteredDebtors = useMemo(() => {
    if (!normalizedQuery) return filteredByStatus;

    return filteredByStatus.filter((item) => {
      const haystack = [
        item.name,
        item.accountNumber,
        item.contactName,
        item.phone,
        item.email,
        item.area,
        item.assignedTo ?? "",
        item.priority,
        item.workflowStatus,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [filteredByStatus, normalizedQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredDebtors.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const startIndex = filteredDebtors.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredDebtors.length);

  const paginatedDebtors = useMemo(() => {
    return filteredDebtors.slice(startIndex, endIndex);
  }, [filteredDebtors, startIndex, endIndex]);

  const isLoading = recordsQuery.isLoading || agentsQuery.isLoading;
  const hasError = recordsQuery.isError || agentsQuery.isError;

  function handleStatusFilterChange(nextFilter: StatusFilter) {
    setActiveFilter(nextFilter);
    setCurrentPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setCurrentPage(1);
  }

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Master list"
        title="Debt register"
        description="Management view for the last three years of DebtCollector records. Search, filter, import, and assign priority cases into the new workflow."
        actions={
          <Button
            className="bg-white text-primary hover:bg-white/90"
            onClick={() => exportDebtorsCsv(filteredDebtors)}
            disabled={!filteredDebtors.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
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
          <p className="mt-2 text-sm text-muted-foreground">
            Check the records and agents endpoints, then refresh the page.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total outstanding"
              value={formatCurrency(totalDebtOutstanding)}
              helper="Last three years of DebtCollector"
              icon={Landmark}
              tone="primary"
            />
            <StatCard
              label="Total records"
              value={String(totalDebtors)}
              helper="DebtCollector rows in scope"
              icon={Users}
              tone="primary"
            />
            <StatCard
              label="Assigned records"
              value={String(assignedCount)}
              helper="Already linked to an agent"
              icon={Mail}
              tone="secondary"
            />
            <StatCard
              label="High-value records"
              value={String(highValueCount)}
              helper="Balances above R50 000"
              icon={GitBranch}
              tone="accent"
            />
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {filterButtons.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleStatusFilterChange(item.key)}
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

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="text"
                  placeholder="Search debtors..."
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="w-64"
                />

                <select
                  value={selectedAgentId ?? ""}
                  onChange={(event) =>
                    setSelectedAgentId(event.target.value === "" ? null : event.target.value)
                  }
                  className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="">Assign to...</option>
                  {agentsQuery.data?.data?.map((agent) => (
                    <option key={String(agent.ID)} value={String(agent.ID)}>
                      {agent.AgentName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {feedback ? (
              <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-3 text-sm text-foreground">
                {feedback}
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    DebtCollector records
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {filteredDebtors.length} record{filteredDebtors.length === 1 ? "" : "s"} match your current filters. Showing {filteredDebtors.length === 0 ? 0 : startIndex + 1}-{endIndex}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-muted-foreground" htmlFor="page-size">
                    Rows per page
                  </label>
                  <select
                    id="page-size"
                    value={pageSize}
                    onChange={(event) => handlePageSizeChange(event.target.value)}
                    className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    {[10, 25, 50, 100, 250].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/35">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-medium text-muted-foreground">Debtor</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Account</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Area</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Termination</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Days</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Balance</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Priority</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Assigned to</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDebtors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No DebtCollector records match the current view.
                      </td>
                    </tr>
                  ) : (
                    paginatedDebtors.map((item) => (
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
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatShortDate(item.terminationDate)}
                        </td>
                        <td className="px-5 py-4 text-foreground">{item.daysSinceTermination}</td>
                        <td className="px-5 py-4 font-medium text-foreground">
                          {formatCurrency(item.outstandingBalance)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityBadgeClasses(item.priority)}`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClasses(item.workflowStatus)}`}
                          >
                            {getStatusLabel(item.workflowStatus)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {item.assignedTo ?? "Unassigned"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={!selectedAgentId || assignMutation.isPending}
                            onClick={() => {
                              if (!selectedAgentId) {
                                setFeedback("Select an agent before importing and assigning.");
                                return;
                              }
                              assignMutation.mutate({
                                recordId: item.id,
                                agentId: selectedAgentId,
                              });
                            }}
                          >
                            Import + assign
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Page {safeCurrentPage} of {pageCount}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  disabled={safeCurrentPage >= pageCount}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentPage(pageCount)}
                  disabled={safeCurrentPage >= pageCount}
                >
                  Last
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </DebtAppShell>
  );
}
