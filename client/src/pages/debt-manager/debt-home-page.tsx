import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Clock3,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DebtAppShell } from "./ui/debt-app-shell";
import { StatCard } from "./ui/stat-card";
import { MoneyGoalProgress } from "./ui/money-goal-progress";

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
  ProfileImageFileName?: string | null;
  Bio?: string | null;
  ProfileTheme?: string | null;
  ProfileAccentColor?: string | null;
  ExperiencePoints?: number | string | null;
  Level?: number | string | null;
  ShopCoins?: number | string | null;
  CoinsEarnedLifetime?: number | string | null;
  CoinsSpentLifetime?: number | string | null;
  CurrentStreakDays?: number | string | null;
  LongestStreakDays?: number | string | null;
  ObjectivesCompleted?: number | string | null;
  LastLoginAt?: string | null;
  IsActive?: boolean | number | string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface QueueItem {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  email: string;
  area: string;
  daysSinceTermination: number;
  outstandingBalance: number;
  priority: "High" | "Medium" | "Low";
  meterReference: string;
  note: string;
  qualifiedDateLabel: string;
  qualifiedAtTs: number;
  statusLabel: string;
  actionScore: number;
  actionReason: string;
  dueDateLabel?: string;
  overdueDays?: number;
}

interface ActionQueueSectionProps {
  id?: string;
  badge: string;
  title: string;
  description: string;
  items: QueueItem[];
  mode: "assign" | "assigned" | "followup";
  primaryActionLabel: string;
  secondaryActionLabel: string;
  onPrimaryAction: (id: string) => void;
  onSecondaryAction: (id: string) => void;
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

function formatDateLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "Recently qualified";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function isDueNow(value?: string | null): boolean {
  const date = parseDate(value);
  if (!date) return false;
  return date.getTime() <= Date.now();
}

function daysOverdue(value?: string | null): number {
  const date = parseDate(value);
  if (!date) return 0;

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
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

function priorityScore(priority: "High" | "Medium" | "Low") {
  if (priority === "High") return 48;
  if (priority === "Medium") return 30;
  return 16;
}

function getAssignableScore(row: DebtCaseRow) {
  const priority = mapPriority(row.Priority);
  const days = asNumber(row.DaysSinceTermination);
  const outstanding = asNumber(row.TotalOutstanding);

  const ageBoost = Math.min(24, Math.max(0, days - 30));
  const balanceBoost =
    outstanding >= 75000
      ? 26
      : outstanding >= 40000
        ? 18
        : outstanding >= 20000
          ? 12
          : 7;

  return Math.min(100, priorityScore(priority) + ageBoost + balanceBoost);
}

function getFollowUpScore(row: DebtCaseRow) {
  const priority = mapPriority(row.Priority);
  const outstanding = asNumber(row.TotalOutstanding);
  const status = normalizeText(row.CurrentStatusName);

  const overdueBoost =
    status === "reminder_14d"
      ? 36 + daysOverdue(row.Reminder14DueAt) * 4
      : 24 + daysOverdue(row.Reminder7DueAt) * 3;

  const balanceBoost =
    outstanding >= 75000
      ? 24
      : outstanding >= 40000
        ? 16
        : outstanding >= 20000
          ? 10
          : 6;

  return Math.min(100, priorityScore(priority) + overdueBoost + balanceBoost);
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Immediate pickup";
  if (score >= 65) return "High candidate";
  if (score >= 45) return "Ready today";
  return "Review soon";
}

function getAssignReason(row: DebtCaseRow) {
  const outstanding = asNumber(row.TotalOutstanding);
  const days = asNumber(row.DaysSinceTermination);
  const priority = mapPriority(row.Priority);

  if (priority === "High" && outstanding >= 50000) {
    return "High priority balance with strong recovery value.";
  }

  if (days >= 45) {
    return "Older than the grace threshold and should be claimed quickly.";
  }

  if (outstanding >= 25000) {
    return "Meaningful outstanding balance worth immediate attention.";
  }

  return "Freshly qualified and ready for collector assignment.";
}

function getFollowUpReason(row: DebtCaseRow) {
  const status = normalizeText(row.CurrentStatusName);
  const overdue =
    status === "reminder_14d"
      ? daysOverdue(row.Reminder14DueAt)
      : daysOverdue(row.Reminder7DueAt);

  if (status === "reminder_14d") {
    return overdue > 0
      ? `14 day waiting period expired ${overdue} day${overdue === 1 ? "" : "s"} ago. Outcome decision is now needed.`
      : "14 day waiting period has ended. This case now needs escalation or resolution.";
  }

  return overdue > 0
    ? `7 day waiting period expired ${overdue} day${overdue === 1 ? "" : "s"} ago. Final demand follow-up is due.`
    : "7 day waiting period has ended. This case now needs follow-up action.";
}

function mapQueueItem(row: DebtCaseRow): QueueItem {
  const qualifiedDate = parseDate(row.DebtorQualifiedDate ?? row.CreatedAt);
  const priority = mapPriority(row.Priority);

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
    priority,
    meterReference: row.ComplexID ?? "—",
    note:
      row.InternalNotes ||
      row.CurrentStatusName ||
      "Ready for action in the debt collection workflow.",
    qualifiedDateLabel: formatDateLabel(row.DebtorQualifiedDate ?? row.CreatedAt),
    qualifiedAtTs: qualifiedDate?.getTime() ?? 0,
    statusLabel: row.CurrentStatusName ?? "Unassigned",
    actionScore: getAssignableScore(row),
    actionReason: getAssignReason(row),
  };
}

function mapFollowUpQueueItem(row: DebtCaseRow): QueueItem {
  const base = mapQueueItem(row);
  const status = normalizeText(row.CurrentStatusName);
  const dueAt = status === "reminder_14d" ? row.Reminder14DueAt : row.Reminder7DueAt;
  const overdueDays = daysOverdue(dueAt);

  return {
    ...base,
    note: row.InternalNotes || getFollowUpReason(row),
    statusLabel: status === "reminder_14d" ? "14 day follow-up due" : "7 day follow-up due",
    actionScore: getFollowUpScore(row),
    actionReason: getFollowUpReason(row),
    dueDateLabel: formatDateLabel(dueAt),
    overdueDays,
  };
}

const priorityBadgeClass: Record<QueueItem["priority"], string> = {
  High: "border-destructive/20 bg-destructive/10 text-destructive",
  Medium: "border-accent/30 bg-accent/15 text-[hsl(341,72%,42%)]",
  Low: "border-secondary/20 bg-secondary/10 text-[hsl(142,100%,28%)]",
};

function QueueCard({
  item,
  selected,
  onClick,
}: {
  item: QueueItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-primary/20 bg-primary/[0.04] shadow-sm"
          : "border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">
              {item.name}
            </p>

            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityBadgeClass[item.priority]}`}
            >
              {item.priority}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1">
              {item.accountNumber}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              {item.daysSinceTermination} days
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">{item.area}</span>
            {item.dueDateLabel ? (
              <span className="rounded-full bg-primary/5 px-2.5 py-1 text-primary">
                Due {item.dueDateLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(item.outstandingBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.actionScore}% score</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="truncate text-sm text-muted-foreground">
          {item.contactName} • {item.phone}
        </p>

        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            item.actionScore >= 80
              ? "bg-destructive/10 text-destructive"
              : item.actionScore >= 55
                ? "bg-accent/15 text-[hsl(341,72%,42%)]"
                : "bg-secondary/10 text-[hsl(142,100%,28%)]"
          }`}
        >
          <Zap className="h-3 w-3" />
          {getScoreLabel(item.actionScore)}
        </div>
      </div>
    </button>
  );
}

function getModePillLabel(mode: ActionQueueSectionProps["mode"]) {
  if (mode === "assign") return "Ready to claim";
  if (mode === "followup") return "Due for action";
  return "Fresh in your queue";
}

function getModeContextLabel(mode: ActionQueueSectionProps["mode"]) {
  if (mode === "assign") return "Why this should be assigned";
  if (mode === "followup") return "Why this needs action now";
  return "Why this is here";
}

function getModeContextText(mode: ActionQueueSectionProps["mode"]) {
  if (mode === "assign") {
    return "This case is unassigned and ready to be claimed into your queue so first contact can begin.";
  }

  if (mode === "followup") {
    return "This case has reached the end of its waiting period and needs collector follow-up today.";
  }

  return "This is one of the newest debt cases already assigned to you after falling out of the 30-day grace period.";
}

function ActionQueueSection({
  id,
  badge,
  title,
  description,
  items,
  mode,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
}: ActionQueueSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = items.some((item) => item.id === selectedId);
    if (!stillExists) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  if (!items.length) {
    return (
      <section
        id={id}
        className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {badge}
        </div>

        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h3>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <div className="mt-6 rounded-[24px] border border-dashed border-border bg-muted/25 p-8 text-center">
          <p className="text-base font-medium text-foreground">Nothing to show right now.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This section will populate automatically when matching debt cases are available.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm"
    >
      <div className="mb-5 flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {badge}
        </div>

        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              selected={item.id === selectedItem?.id}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </div>

        {selectedItem ? (
          <div className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  <Target className="h-3.5 w-3.5" />
                  {getModePillLabel(mode)}
                </div>

                <h4 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {selectedItem.name}
                </h4>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadgeClass[selectedItem.priority]}`}
                  >
                    {selectedItem.priority}
                  </span>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {selectedItem.accountNumber}
                  </span>

                  <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-[hsl(142,100%,26%)]">
                    Qualified {selectedItem.qualifiedDateLabel}
                  </span>

                  {selectedItem.dueDateLabel ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-[hsl(341,72%,42%)]">
                      Due {selectedItem.dueDateLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-background px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Outstanding balance
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(selectedItem.outstandingBalance)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="space-y-4">
                <div className="rounded-[22px] bg-muted/35 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    <p className="text-sm font-medium text-foreground">
                      Queue signal
                    </p>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {getScoreLabel(selectedItem.actionScore)}
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedItem.actionScore}%
                    </span>
                  </div>

                  <div className="h-2.5 rounded-full bg-border/70">
                    <div
                      className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(220,100%,15%)_0%,hsl(341,72%,74%)_55%,hsl(142,100%,44%)_100%)]"
                      style={{ width: `${selectedItem.actionScore}%` }}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl bg-white px-3 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-secondary" />
                      Recommended move
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {selectedItem.actionReason}
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
                      {selectedItem.daysSinceTermination} days since termination
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedItem.area}
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Status: {selectedItem.statusLabel}
                    </div>

                    {selectedItem.dueDateLabel ? (
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-primary" />
                        {selectedItem.overdueDays && selectedItem.overdueDays > 0
                          ? `${selectedItem.overdueDays} day${selectedItem.overdueDays === 1 ? "" : "s"} overdue`
                          : `Due ${selectedItem.dueDateLabel}`}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Debtor overview
                  </p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {selectedItem.note}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      Contact
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {selectedItem.contactName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedItem.phone}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      Email
                    </div>
                    <p className="mt-3 break-all text-sm text-foreground">
                      {selectedItem.email}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-primary/10 bg-primary/[0.03] p-4">
                  <p className="text-xs uppercase tracking-wide text-primary">
                    {getModeContextLabel(mode)}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                    {getModeContextText(mode)}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => onPrimaryAction(selectedItem.id)}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {primaryActionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onSecondaryAction(selectedItem.id)}
                    className="flex-1 rounded-xl"
                  >
                    {secondaryActionLabel}
                  </Button>
                </div>

                {mode !== "assign" ? (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${selectedItem.phone.replace(/\s+/g, "")}`}
                      className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/15"
                    >
                      Quick call
                    </a>

                    <a
                      href={`mailto:${selectedItem.email}`}
                      className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/15"
                    >
                      Quick email
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function DebtActionPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const casesQuery = useQuery({
    queryKey: ["debt-manager", "cases"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseRow[]>>("/api/debt-manager/cases"),
  });

  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  const cases = casesQuery.data?.data ?? [];
  const agents = agentsQuery.data?.data ?? [];

  const currentAgent = useMemo(
    () =>
      resolveCurrentAgent(
        (user as Record<string, unknown> | null | undefined) ?? null,
        agents,
      ),
    [agents, user],
  );

  const assignMutation = useMutation({
    mutationFn: async (debtCaseId: string) => {
      if (!currentAgent) {
        throw new Error("Could not resolve the current debt agent profile.");
      }

      return apiRequest<ApiResponse<{ debtCaseId: number }>>(
        `/api/debt-manager/cases/${debtCaseId}/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            targetAgentId: asNumber(currentAgent.ID),
            triggeredByAgentId: asNumber(currentAgent.ID),
            note: "Assigned from action page",
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["debt-manager", "cases"] });
    },
  });

  const handleAssignToMe = async (debtCaseId: string) => {
    try {
      await assignMutation.mutateAsync(debtCaseId);
    } catch (error) {
      console.error("Assign to me failed:", error);
      window.alert(
        error instanceof Error ? error.message : "Failed to assign debt case.",
      );
    }
  };

  const handleOpenDebtor = (debtCaseId: string) => {
    setLocation(`/debt-manager/debtors/${debtCaseId}`);
  };

  const todayLabel = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const summary = useMemo(() => {
    const myCases = currentAgent
      ? cases.filter(
          (item) =>
            asNumber(item.CurrentOwnerAgentID, -1) ===
            asNumber(currentAgent.ID, -999),
        )
      : [];

    const unassignedRows = cases.filter(
      (item) =>
        !item.CurrentOwnerAgentID ||
        normalizeText(item.CurrentStatusName) === "unassigned",
    );

    const assignableCases = unassignedRows
      .map(mapQueueItem)
      .sort((a, b) => {
        if (b.actionScore !== a.actionScore) return b.actionScore - a.actionScore;
        return b.qualifiedAtTs - a.qualifiedAtTs;
      })
      .slice(0, 5);

    const freshAssignedCases = myCases
      .map(mapQueueItem)
      .sort((a, b) => b.qualifiedAtTs - a.qualifiedAtTs)
      .slice(0, 5);

    const followUpDueCases = myCases
      .filter((item) => !asBool(item.PaymentReceived))
      .filter((item) => {
        const status = normalizeText(item.CurrentStatusName);

        if (status === "reminder_7d") {
          return isDueNow(item.Reminder7DueAt);
        }

        if (status === "reminder_14d") {
          return isDueNow(item.Reminder14DueAt);
        }

        return false;
      })
      .map(mapFollowUpQueueItem)
      .sort((a, b) => {
        if (b.actionScore !== a.actionScore) return b.actionScore - a.actionScore;
        return b.outstandingBalance - a.outstandingBalance;
      })
      .slice(0, 5);

    const myQueueValue = myCases.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const totalDebtOutstanding = cases.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const paidCasesValue = cases
      .filter((item) => asBool(item.PaymentReceived))
      .reduce((sum, item) => sum + asNumber(item.TotalOutstanding), 0);

    const streakDays = asNumber(currentAgent?.CurrentStreakDays, 0);

    return {
      assignableCases,
      freshAssignedCases,
      followUpDueCases,
      myCasesCount: myCases.length,
      reminderDueSoonCount: followUpDueCases.length,
      myQueueValue,
      totalDebtOutstanding,
      paidCasesValue,
      streakDays,
      newestDebtorsCount: unassignedRows.length,
    };
  }, [cases, currentAgent]);

  const nextGoalAmount = Math.max(
    250000,
    Math.ceil((summary.paidCasesValue + 50000) / 50000) * 50000,
  );

  const dashboardStats = [
    {
      label: "Assignable today",
      value: String(summary.assignableCases.length),
      helper: "Daily pickup queue for claimable debt cases",
      icon: UserPlus,
      tone: "primary" as const,
    },
    {
      label: "Fresh in my queue",
      value: String(summary.freshAssignedCases.length),
      helper: "Newest cases already assigned to this collector",
      icon: BellRing,
      tone: "secondary" as const,
    },
    {
      label: "Follow-ups due now",
      value: String(summary.reminderDueSoonCount),
      helper: "Assigned reminder-stage cases ready for action",
      icon: Target,
      tone: "accent" as const,
    },
    {
      label: "My queue value",
      value: formatCurrency(summary.myQueueValue),
      helper: "Current outstanding value under my ownership",
      icon: TrendingUp,
      tone: "primary" as const,
    },
  ];

  const isLoading = authLoading || casesQuery.isLoading || agentsQuery.isLoading;
  const hasError = casesQuery.isError || agentsQuery.isError;

  return (
    <DebtAppShell>
      <section
        id="overview"
        className="relative overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)] p-5 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)] sm:p-6"
      >
        <div className="absolute -right-16 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-[hsl(341,72%,74%)]/20 blur-3xl" />

        <div className="relative grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              Daily action workspace
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white/70">{todayLabel}</p>
              <h1 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
                Start with the accounts that need action first.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/78">
                Your live debt collection command centre for newly qualified debtors,
                queue priorities, assignments, and visible recovery progress.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => scrollToSection("new-debtors")}
                className="bg-white text-primary hover:bg-white/90"
              >
                Review new debtors
              </Button>

              <Button
                variant="outline"
                onClick={() => setLocation("/debt-manager/objectives")}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Open daily objectives
              </Button>
            </div>

            <div className="rounded-2xl bg-white/8 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <LayoutDashboard className="mt-0.5 h-4 w-4 text-secondary" />
                <p className="text-sm leading-6 text-white/78">
                  Only accounts with an outstanding balance and termination older than{" "}
                  <span className="font-semibold text-white">30 days</span> should
                  qualify as debtors. This view is now loading from the live debt case
                  backend.
                </p>
              </div>
            </div>
          </div>

          <MoneyGoalProgress
            currentAmount={summary.paidCasesValue}
            monthlyTarget={nextGoalAmount}
            nextGoalAmount={nextGoalAmount}
            queueCount={summary.newestDebtorsCount}
            streakDays={summary.streakDays}
          />
        </div>
      </section>

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Loading debt action workspace...
          </p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">
            Could not load debt manager data.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the backend routes and SOAP service, then refresh the page.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <ActionQueueSection
            id="new-debtors"
            badge="Priority pickup queue"
            title="Top 5 assignable debt cases"
            description="These are the cases that should be claimed first today. Keep this queue tight and operational so new debtor work starts quickly."
            items={summary.assignableCases}
            mode="assign"
            primaryActionLabel="Assign to me"
            secondaryActionLabel="Open case"
            onPrimaryAction={handleAssignToMe}
            onSecondaryAction={handleOpenDebtor}
          />

          <ActionQueueSection
            badge="Fresh in my queue"
            title="Top 5 newest debt cases already assigned to me"
            description="These are the newest cases that have just crossed out of the 30-day grace period and have already landed in this collector's queue."
            items={summary.freshAssignedCases}
            mode="assigned"
            primaryActionLabel="Open case"
            secondaryActionLabel="Review detail"
            onPrimaryAction={handleOpenDebtor}
            onSecondaryAction={handleOpenDebtor}
          />

          <ActionQueueSection
            badge="Due now"
            title="Debt cases that need follow-up today"
            description="These assigned cases have reached the end of their waiting period and now need collector action. Open them and continue the workflow immediately."
            items={summary.followUpDueCases}
            mode="followup"
            primaryActionLabel="Open due action"
            secondaryActionLabel="Review case"
            onPrimaryAction={handleOpenDebtor}
            onSecondaryAction={handleOpenDebtor}
          />
        </div>
      )}
    </DebtAppShell>
  );
}