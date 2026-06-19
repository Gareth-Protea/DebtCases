import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  Landmark,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  UploadCloud,
  Send,
  ShieldAlert,
  Sparkles,
  TimerReset,
  UserCircle2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";

/*
 * Redesigned debt case page
 *
 * This file mirrors the functionality of the original page but tweaks the layout
 * to be more compact and monitor‑friendly. The colours, typography and
 * interactive behaviour remain intact, while spacing and grid breakpoints are
 * adjusted to better utilise horizontal space on smaller monitors. A scrollable
 * timeline prevents content from overflowing vertically.
 */

type WorkflowStatus =
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

type MessageChannel = "email" | "whatsapp" | "phone";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface DebtCaseDetailPayload {
  case: DebtCaseRecord;
  events: DebtCaseEventRow[];
}

interface CaseTransactionPayload {
  debtCase: {
    debtCaseId: number | string;
    accountNo: string;
    debtorName: string;
    totalOutstanding: number;
  };
  money: {
    verifiedPaid: number;
    calculatedRemaining: number;
    progressPercent: number;
    transactionCount: number;
    lastPaymentAt?: string | null;
    source: string;
    rule: string;
    note: string;
  };
  transactions: Array<{
    accountNo: string;
    debtorName: string;
    agentName: string;
    amount: number;
    tranDate: string | null;
    journalNo: string | number | null;
    description: string | null;
  }>;
  timeline: Array<{
    date: string;
    value: number;
    count: number;
  }>;
}

interface WhatsAppSendPayload {
  success: boolean;
  data?: {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    whatsappMessageId?: string;
    templateName?: string;
    appName?: string;
    requestedBy?: string;
    raw?: unknown;
  };
  message?: string;
}

interface WhatsAppTemplateConfig {
  templateName: string;
  languageCode: string;
  variables: string[];
  preview: string;
}

interface DebtCaseAgent {
  ID: number | string;
  AgentName: string;
  Email: string;
  Phone?: string | null;
  AccessLevel?: number | string | null;
}

interface DebtCaseRecord {
  DebtCaseID: number | string;
  AccountNo: string;
  ComplexID?: string | null;
  ComplexName?: string | null;
  DebtorName: string;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  TotalOutstanding?: number | string | null;
  TerminationDate?: string | null;
  DebtorQualifiedDate?: string | null;
  CurrentStatusID?: number | string | null;
  CurrentStatusName?: string | null;
  StatusStartedAt?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Priority?: string | null;
  RecommendedPath?: string | null;
  InvoiceSent?: boolean | number | string | null;
  InvoiceSentAt?: string | null;
  InvoiceFileName?: string | null;
  FinalDemandSent?: boolean | number | string | null;
  FinalDemandSentAt?: string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  ResolutionType?: string | null;
  ArrangementActive?: boolean | number | string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  DaysSinceTermination?: number | string | null;
  InternalNotes?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface DebtCaseEventRow {
  DebtCaseEventID?: number | string;
  DebtCaseID?: number | string;
  EventTypeID?: number | string;
  TriggeredByAgentID?: number | string | null;
  RelatedAgentID?: number | string | null;
  Title?: string | null;
  EventText?: string | null;
  Reason?: string | null;
  DueAt?: string | null;
  CompletedAt?: string | null;
  TaskStatus?: string | null;
  CommunicationType?: string | null;
  Direction?: string | null;
  SuccessFlag?: boolean | number | string | null;
  RecipientName?: string | null;
  RecipientAddress?: string | null;
  SubjectLine?: string | null;
  MessageBody?: string | null;
  IncludesInvoice?: boolean | number | string | null;
  IncludesFinalDemand?: boolean | number | string | null;
  ResolutionType?: string | null;
  FileName?: string | null;
  ExternalReference?: string | null;
  CreatedAt?: string | null;
  EventTypeName?: string | null;
  EventTypeCode?: string | null;
  TriggeredByAgentName?: string | null;
  RelatedAgentName?: string | null;
  Channel?: string | null;
  Subject?: string | null;
  Body?: string | null;
  Note?: string | null;
  ReminderAt?: string | null;
}

interface TimelineEvent {
  id: string;
  title: string;
  detail: string;
  dateLabel: string;
  type: "system" | "email" | "whatsapp" | "call" | "legal" | "payment" | "reminder";
}

type PreparedAttachment = {
  id: string;
  filename: string;
  content: string;
  contentType: string;
  sizeLabel: string;
  url?: string;
};

type ToastVariant = "success" | "error" | "warning" | "info";

type AppToast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  persistent?: boolean;
  onAction?: () => void | Promise<void>;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
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

function addDays(base?: string | null, amount = 0): string | null {
  const date = parseDate(base);
  if (!date) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next.toISOString();
}

function formatDateTimeLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function daysUntil(dateStr?: string | null) {
  const target = parseDate(dateStr);
  if (!target) return null;

  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDueText(days: number | null) {
  if (days === null) return "Not scheduled";
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Due today";
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };

    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function resolveCurrentAgent(
  user: Record<string, unknown> | null | undefined,
  agents: DebtCaseAgent[],
): DebtCaseAgent | null {
  if (!user) return null;

  const userId = asNumber(user.id, Number.NaN);
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

function mapApiStatus(status?: string | null): WorkflowStatus {
  const normalized = normalizeText(status);

  if (normalized === "unassigned") return "UNASSIGNED";
  if (normalized === "first_contact" || normalized === "invoice_due") return "FIRST_CONTACT";
  if (normalized === "reminder_7d") return "REMINDER_7D";
  if (normalized === "follow_up_7d" || normalized === "post_follow_up_7d") {
    return "FOLLOW_UP_7D";
  }
  if (normalized === "reminder_14d" || normalized === "final_demand") return "REMINDER_14D";
  if (normalized === "resolution") return "RESOLUTION";
  if (normalized === "itc" || normalized === "itc_legal") return "ITC";
  if (normalized === "legal") return "LEGAL";
  if (normalized === "arrangement") return "ARRANGEMENT";
  if (normalized === "paid") return "PAID";

  return "UNASSIGNED";
}

function getStatusPill(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "bg-muted text-muted-foreground border-border";
    case "FIRST_CONTACT":
      return "bg-primary/8 text-primary border-primary/15";
    case "REMINDER_7D":
      return "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30";
    case "FOLLOW_UP_7D":
      return "bg-[hsl(265,72%,58%)]/12 text-[hsl(265,70%,38%)] border-[hsl(265,72%,58%)]/20";
    case "REMINDER_14D":
      return "bg-[hsl(24,92%,56%)]/12 text-[hsl(24,82%,42%)] border-[hsl(24,92%,56%)]/20";
    case "RESOLUTION":
      return "bg-primary/10 text-primary border-primary/20";
    case "ITC":
      return "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20";
    case "LEGAL":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "ARRANGEMENT":
      return "bg-[hsl(45,96%,58%)]/18 text-[hsl(40,90%,32%)] border-[hsl(45,96%,58%)]/30";
    case "PAID":
      return "bg-secondary/10 text-[hsl(142,100%,25%)] border-secondary/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStageLabel(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "Unassigned";
    case "FIRST_CONTACT":
      return "First contact";
    case "REMINDER_7D":
      return "Wait 7 days";
    case "FOLLOW_UP_7D":
      // In the revised flow there is no separate "follow up" stage – the first
      // 7‑day wait includes sending the follow‑up. The next stage is a
      // second 7‑day wait before final demand. Provide a neutral label
      // reflecting this second waiting period.
      return "Wait 7 days";
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

function getStepIndex(status: WorkflowStatus) {
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

function getFlowMeta(status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return {
        title: "Assignment queue",
        helper: "Collector ownership still needed",
        accent:
          "linear-gradient(90deg, rgba(148,163,184,0.95) 0%, rgba(100,116,139,0.85) 100%)",
        glow: "rgba(148,163,184,0.28)",
      };
    case "FIRST_CONTACT":
      return {
        title: "First contact in progress",
        helper: "Communication and invoice stage",
        accent:
          "linear-gradient(90deg, rgba(8,38,84,0.98) 0%, rgba(24,68,140,0.9) 100%)",
        glow: "rgba(8,38,84,0.35)",
      };
    case "REMINDER_7D":
      return {
        title: "First 7 day wait",
        helper: "Invoice sent, waiting before follow‑up",
        accent:
          "linear-gradient(90deg, rgba(233,30,99,0.96) 0%, rgba(255,111,145,0.88) 100%)",
        glow: "rgba(233,30,99,0.26)",
      };
    case "FOLLOW_UP_7D":
      // The second waiting period before final demand. The follow‑up has
      // already been completed in the previous stage, so this period is
      // simply waiting out seven days before sending the final demand.
      return {
        title: "Second 7 day wait",
        helper: "Waiting period before final demand",
        accent:
          "linear-gradient(90deg, rgba(124,58,237,0.96) 0%, rgba(167,139,250,0.9) 100%)",
        glow: "rgba(124,58,237,0.26)",
      };
    case "REMINDER_14D":
      return {
        title: "14 day waiting period",
        helper: "Final demand sent, waiting for resolution window",
        accent:
          "linear-gradient(90deg, rgba(249,115,22,0.98) 0%, rgba(251,191,36,0.88) 100%)",
        glow: "rgba(249,115,22,0.28)",
      };
    case "RESOLUTION":
      return {
        title: "Resolution decision",
        helper: "Choose the outcome route",
        accent:
          "linear-gradient(90deg, rgba(8,38,84,0.98) 0%, rgba(0,224,104,0.9) 100%)",
        glow: "rgba(0,224,104,0.28)",
      };
    case "ITC":
      return {
        title: "ITC route active",
        helper: "Outcome route selected",
        accent:
          "linear-gradient(90deg, rgba(0,224,104,0.98) 0%, rgba(0,180,90,0.9) 100%)",
        glow: "rgba(0,224,104,0.28)",
      };
    case "LEGAL":
      return {
        title: "Legal route active",
        helper: "Outcome route selected",
        accent:
          "linear-gradient(90deg, rgba(239,68,68,0.98) 0%, rgba(220,38,38,0.9) 100%)",
        glow: "rgba(239,68,68,0.28)",
      };
    case "ARRANGEMENT":
      return {
        title: "Arrangement active",
        helper: "Outcome route selected",
        accent:
          "linear-gradient(90deg, rgba(245,158,11,0.98) 0%, rgba(234,179,8,0.9) 100%)",
        glow: "rgba(245,158,11,0.26)",
      };
    case "PAID":
      return {
        title: "Recovered and closed",
        helper: "Case completed",
        accent:
          "linear-gradient(90deg, rgba(0,224,104,0.98) 0%, rgba(0,180,90,0.9) 100%)",
        glow: "rgba(0,224,104,0.28)",
      };
    default:
      return {
        title: "Case in progress",
        helper: "Current stage",
        accent:
          "linear-gradient(90deg, rgba(8,38,84,0.98) 0%, rgba(24,68,140,0.9) 100%)",
        glow: "rgba(8,38,84,0.35)",
      };
  }
}

function getStepIcon(index: number) {
  switch (index) {
    case 0:
      return ShieldAlert;
    case 1:
      return Phone;
    case 2:
      return TimerReset;
    case 3:
      return MessageSquare;
    case 4:
      return CalendarClock;
    case 5:
      return Gavel;
    case 6:
      return BadgeCheck;
    default:
      return Sparkles;
  }
}

function getTimelineType(row: DebtCaseEventRow): TimelineEvent["type"] {
  const typeName = normalizeText(row.EventTypeName ?? row.EventTypeCode);
  const channel = normalizeText(row.Channel ?? row.CommunicationType);

  if (channel === "email" || typeName.includes("email")) return "email";
  if (channel === "whatsapp" || typeName.includes("whatsapp")) return "whatsapp";
  if (channel === "phone" || typeName.includes("call") || typeName.includes("phone")) {
    return "call";
  }
  if (typeName.includes("legal") || typeName.includes("itc") || typeName.includes("escalat")) {
    return "legal";
  }
  if (typeName.includes("payment") || typeName.includes("paid")) return "payment";
  if (typeName.includes("reminder")) return "reminder";
  return "system";
}

function getTimelineIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "email":
      return Mail;
    case "whatsapp":
      return MessageSquare;
    case "call":
      return Phone;
    case "legal":
      return Gavel;
    case "payment":
      return BadgeCheck;
    case "reminder":
      return CalendarClock;
    default:
      return Sparkles;
  }
}

function mapEventRowToTimeline(row: DebtCaseEventRow): TimelineEvent {
  const title =
    row.Title?.trim() ||
    row.EventTypeName?.trim() ||
    "Case activity";

  const detail =
    row.Note?.trim() ||
    row.Reason?.trim() ||
    row.EventText?.trim() ||
    row.Body?.trim() ||
    row.MessageBody?.trim() ||
    row.Subject?.trim() ||
    row.SubjectLine?.trim() ||
    "Action recorded on the debt case.";

  return {
    id: String(row.DebtCaseEventID ?? `${row.CreatedAt}-${title}`),
    title,
    detail,
    dateLabel: formatDateTimeLabel(
      row.CreatedAt ?? row.ReminderAt ?? row.DueAt ?? row.CompletedAt,
    ),
    type: getTimelineType(row),
  };
}

function getNextActionHint(caseRow: DebtCaseRecord, status: WorkflowStatus) {
  switch (status) {
    case "UNASSIGNED":
      return "Assign the case to an agent to start the workflow.";
    case "FIRST_CONTACT":
      return "Make first contact and send the invoice so the case can move into the first 7 day waiting period.";
    case "REMINDER_7D":
      return "Wait for the first 7 day cycle to end, then complete the follow‑up communication.";
    case "FOLLOW_UP_7D":
      return "The follow‑up has been done. Wait another 7 days before sending final demand.";
    case "REMINDER_14D":
      return "Final demand has been sent. Wait out the 14 day period and prepare the outcome route.";
    case "RESOLUTION":
      return "Confirm the outcome route: ITC, Legal, Arrangement, or Paid.";
    case "ITC":
      return "Track ITC progress and record any recovery updates.";
    case "LEGAL":
      return "Track legal handover and legal progress notes.";
    case "ARRANGEMENT":
      return "Monitor arrangement commitments and received payments.";
    case "PAID":
      return "Capture proof and close out the case cleanly.";
    default:
      return caseRow.InternalNotes ?? "Work the current stage.";
  }
}

function getDraftForCase(
  caseRow: DebtCaseRecord,
  channel: MessageChannel,
  mode: "invoice" | "followup",
) {
  const balance = formatCurrency(asNumber(caseRow.TotalOutstanding));

  if (mode === "followup") {
    if (channel === "email") {
      return {
        subject: `Follow‑up on outstanding account ${caseRow.AccountNo}`,
        body: `Hi ${caseRow.DebtorName},\n\nThis is a follow‑up regarding your outstanding Protea Metering account ${caseRow.AccountNo} with a balance of ${balance}.\n\nPlease advise on payment timing or contact us urgently if you need to discuss the account.\n\nRegards,\nCollections Team`,
      };
    }

    if (channel === "whatsapp") {
      return {
        subject: "",
        body: `Good day ${caseRow.DebtorName}. This is a reminder that account ${caseRow.AccountNo} remains outstanding at ${balance}. Please confirm payment timing or contact Protea Metering urgently.`,
      };
    }

    return {
      subject: "",
      body: "",
    };
  }

  if (channel === "email") {
    return {
      subject: `Outstanding invoice for account ${caseRow.AccountNo}`,
      body: `Hi ${caseRow.DebtorName},\n\nPlease find your outstanding invoice for account ${caseRow.AccountNo} with a balance of ${balance}.\n\nKindly confirm receipt and advise on expected payment timing.\n\nRegards,\nCollections Team`,
    };
  }

  if (channel === "whatsapp") {
    return {
      subject: "",
      body: `Good day ${caseRow.DebtorName}. This is Protea Metering collections regarding account ${caseRow.AccountNo}. Your outstanding balance is ${balance}. We are sending your invoice and request payment feedback.`,
    };
  }

  return {
    subject: "",
    body: "",
  };
}

function getFinalDemandDraft(caseRow: DebtCaseRecord, channel: MessageChannel) {
  const balance = formatCurrency(asNumber(caseRow.TotalOutstanding));

  if (channel === "whatsapp") {
    return {
      subject: "",
      body: `Good day ${caseRow.DebtorName}. This is a final demand for Protea Metering account ${caseRow.AccountNo}. Outstanding balance: ${balance}. Please make urgent payment or contact us immediately.`,
    };
  }

  return {
    subject: `Final demand for account ${caseRow.AccountNo}`,
    body: `Hi ${caseRow.DebtorName},\n\nThis email serves as a final demand in respect of Protea Metering account ${caseRow.AccountNo}.\n\nOur records reflect an outstanding balance of ${balance}. Please make payment urgently or contact us immediately to discuss the account.\n\nRegards,\nCollections Team`,
  };
}

function parseWhatsAppVariables(text: string): string[] {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}


function formatTemplateAmount(value: unknown) {
  return asNumber(value).toFixed(2);
}

function addDaysIsoFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getInvoiceNumber(caseRow: DebtCaseRecord) {
  return caseRow.InvoiceFileName?.replace(/\.[^.]+$/, "") || caseRow.AccountNo || String(caseRow.DebtCaseID);
}

function getAccountOrPremises(caseRow: DebtCaseRecord) {
  return caseRow.ComplexName || caseRow.AccountNo || caseRow.DebtorName;
}

function getWhatsAppTemplateConfig(
  caseRow: DebtCaseRecord,
  mode: "invoice" | "followup" | "final-demand",
): WhatsAppTemplateConfig {
  const clientName = caseRow.DebtorName || "Client";
  const invoiceNumber = getInvoiceNumber(caseRow);
  const accountOrPremises = getAccountOrPremises(caseRow);
  const amount = formatTemplateAmount(caseRow.TotalOutstanding);

  if (mode === "invoice") {
    const dueDate = formatShortDate(caseRow.Reminder7DueAt || addDaysIsoFromNow(7));
    return {
      templateName: "debt_invoice_document",
      languageCode: "en",
      variables: [clientName, invoiceNumber, accountOrPremises, amount, dueDate],
      preview: `Dear ${clientName}, your invoice ${invoiceNumber} for ${accountOrPremises} is attached. Amount due: R ${amount}. Due date: ${dueDate}.`,
    };
  }

  if (mode === "final-demand") {
    const finalDate = formatShortDate(caseRow.Reminder14DueAt || addDaysIsoFromNow(14));
    return {
      templateName: "debt_final_demand_document",
      languageCode: "en",
      variables: [clientName, accountOrPremises, amount, finalDate],
      preview: `Dear ${clientName}, your account for ${accountOrPremises} remains overdue. Outstanding amount: R ${amount}. Final payment date: ${finalDate}.`,
    };
  }

  const paymentDueDate = formatShortDate(caseRow.Reminder7DueAt || addDaysIsoFromNow(7));
  return {
    templateName: "debt_invoice_payment_followup",
    languageCode: "en",
    variables: [clientName, invoiceNumber, accountOrPremises, amount, paymentDueDate],
    preview: `Dear ${clientName}, this is a reminder that invoice ${invoiceNumber} for ${accountOrPremises} is still outstanding. Outstanding amount: R ${amount}. Please make payment by ${paymentDueDate}.`,
  };
}

function FlowTracker({ status }: { status: WorkflowStatus }) {
  const current = getStepIndex(status);
  const flow = getFlowMeta(status);

  // Updated flow: remove the separate follow‑up step. Instead, the first 7‑day
  // wait includes sending the follow‑up, and the second 7‑day wait is for
  // final demand. The flow now has six stages before the outcome stage.
  const steps = [
    { label: "Assign" },
    { label: "First contact" },
    { label: "Wait 7 days" },
    { label: "Wait 7 days" },
    { label: "14 day wait" },
    { label: "Resolution" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Status flow
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{flow.title}</p>
          <p className="mt-1 text-sm text-white/62">{flow.helper}</p>
        </div>

        <div className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-md">
          <p className="text-[11px] uppercase tracking-wide text-white/50">
            Current stage
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {getStageLabel(status)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 justify-center">
        {steps.map((step, index) => {
          const Icon = getStepIcon(index);
          const isComplete = index < current;
          const isActive = index === current;

          // Determine base tile classes based on status
          const baseTile = isActive
            ? "border-white/20 bg-white/20 shadow-[0_22px_50px_-28px_rgba(255,255,255,0.45)]"
            : isComplete
            ? "border-white/10 bg-white/15"
            : "border-white/8 bg-white/8";

          // Determine icon container classes
          const iconBox = isActive
            ? "bg-white text-[hsl(220,100%,15%)]"
            : isComplete
            ? "bg-[hsl(142,100%,44%)] text-white"
            : "bg-white/10 text-white/75";

          // Determine status text for overlay
          const statusLabel = isActive ? "Current" : isComplete ? "Done" : "Next";

          return (
            <div
              key={`${step.label}-${index}`}
              className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border px-5 py-6 transition-all duration-300 ${baseTile} ${isActive ? 'animate-pulse' : ''}`}
              style={
                isActive
                  ? {
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 28px ${flow.glow}, 0 24px 50px -30px rgba(0,0,0,0.35)`,
                      animationDuration: '2.5s',
                    }
                  : undefined
              }
            >
              {isActive ? (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.03)_40%,transparent_100%)]" />
                  <div className="pointer-events-none absolute inset-[-1px] rounded-2xl border border-white/18 animate-pulse" />
                </>
              ) : null}

              {/* Icon visible by default */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBox}`}>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
              </div>

              {/* Hidden details overlay shown on hover */}
              <div className="pointer-events-none absolute inset-0 hidden group-hover:flex flex-col justify-center gap-1 rounded-2xl bg-white/15 px-3 py-2 text-left text-white backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">
                  Step {index + 1}
                </p>
                <p className="text-xs font-semibold leading-5 text-white">
                  {step.label}
                </p>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  {statusLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  borderColor,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * Optional border color to visually distinguish sections. This string should
   * be a valid Tailwind class like `border-primary/30` or `border-destructive/40`.
   * The colour will apply to the top and left edges of the card to create a
   * subtle 3D effect.
   */
  borderColor?: string;
}) {
  // Default to a faint primary border if none provided
  const colour = borderColor ?? "border-primary/30";
  return (
    <Card
      className={`rounded-2xl border border-border/60 bg-card shadow-sm border-t-4 border-l-4 ${colour}`}
    >
      <CardHeader className="space-y-2 p-5">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        {subtitle ? (
          <p className="text-sm leading-5 text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {value}
      </p>
      {helper ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

function ActionPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)] p-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h4 className="mt-1 text-base font-semibold tracking-tight text-foreground">
        {title}
      </h4>
      {description ? (
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-primary bg-primary/[0.05] shadow-sm"
          : "border-border bg-background hover:border-primary/25"
      }`}
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}


function getToastMeta(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        Icon: CheckCircle2,
        ring: "border-secondary/25 bg-secondary/10 text-[hsl(142,100%,25%)]",
        glow: "shadow-[0_22px_60px_-32px_rgba(0,224,104,0.58)]",
        accent: "bg-secondary",
      };
    case "error":
      return {
        Icon: ShieldAlert,
        ring: "border-destructive/25 bg-destructive/10 text-destructive",
        glow: "shadow-[0_22px_60px_-32px_rgba(239,68,68,0.55)]",
        accent: "bg-destructive",
      };
    case "warning":
      return {
        Icon: ShieldAlert,
        ring: "border-[hsl(24,92%,56%)]/30 bg-[hsl(24,92%,56%)]/12 text-[hsl(24,82%,42%)]",
        glow: "shadow-[0_24px_65px_-34px_rgba(249,115,22,0.58)]",
        accent: "bg-[hsl(24,92%,56%)]",
      };
    default:
      return {
        Icon: Sparkles,
        ring: "border-primary/25 bg-primary/10 text-primary",
        glow: "shadow-[0_22px_60px_-32px_rgba(8,38,84,0.45)]",
        accent: "bg-primary",
      };
  }
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: AppToast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const meta = getToastMeta(toast.variant);
        const Icon = meta.Icon;

        return (
          <div
            key={toast.id}
            className={`relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-4 text-foreground backdrop-blur-xl ${meta.glow}`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${meta.accent}`} />

            <div className="flex gap-3">
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.ring}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      {toast.title}
                    </p>
                    {toast.description ? (
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {toast.description}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {(toast.actionLabel || toast.cancelLabel) ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {toast.actionLabel ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={async () => {
                          onDismiss(toast.id);
                          await toast.onAction?.();
                        }}
                      >
                        {toast.actionLabel}
                      </Button>
                    ) : null}

                    {toast.cancelLabel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => onDismiss(toast.id)}
                      >
                        {toast.cancelLabel}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function MoneyProgressBubble({
  debtCase,
  transactionData,
  isLoading,
}: {
  debtCase: DebtCaseRecord;
  transactionData?: CaseTransactionPayload | null;
  isLoading?: boolean;
}) {
  const originalOutstanding = asNumber(debtCase.TotalOutstanding);
  const verifiedPaid = asNumber(transactionData?.money?.verifiedPaid);

  const calculatedRemaining =
    transactionData?.money?.calculatedRemaining !== undefined
      ? asNumber(transactionData.money.calculatedRemaining)
      : Math.max(originalOutstanding - verifiedPaid, 0);

  const progressPercent =
    transactionData?.money?.progressPercent !== undefined
      ? Math.max(0, Math.min(100, asNumber(transactionData.money.progressPercent)))
      : originalOutstanding > 0
        ? Math.max(0, Math.min(100, Math.round((verifiedPaid / originalOutstanding) * 100)))
        : verifiedPaid > 0
          ? 100
          : 0;

  const hasVerifiedMoney = verifiedPaid > 0;
  const transactionCount = asNumber(transactionData?.money?.transactionCount);
  const lastPaymentAt = transactionData?.money?.lastPaymentAt ?? null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#0b1c51] p-4 text-white shadow-xl backdrop-blur-md">
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 left-1/2 h-24 w-24 rounded-full bg-secondary/20 blur-2xl" />

      <div className="relative grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <div
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-2"
          style={{
            background: `conic-gradient(rgba(0,224,104,0.95) ${
              progressPercent * 3.6
            }deg, rgba(255,255,255,0.18) 0deg)`,
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[#0b1c51] text-center shadow-inner ring-1 ring-white/10">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">
                {progressPercent}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">
                paid
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/65">
                Verified transaction progress
              </p>

              <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
                {isLoading
                  ? "Checking live transactions..."
                  : hasVerifiedMoney
                    ? "Money received against this account"
                    : "No verified money received yet"}
              </h3>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-white/70">
                Pulled from the dedicated transaction controller. User-marked
                payment flags are not counted as money.
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
              GL 1070 verified
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex min-h-[86px] flex-col justify-between rounded-2xl border border-white/12 bg-white/[0.08] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
                Original debt
              </p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {formatCurrency(originalOutstanding)}
              </p>
            </div>

            <div className="flex min-h-[86px] flex-col justify-between rounded-2xl border border-secondary/35 bg-secondary/15 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/65">
                Verified paid
              </p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {formatCurrency(verifiedPaid)}
              </p>
            </div>

            <div className="flex min-h-[86px] flex-col justify-between rounded-2xl border border-white/12 bg-white/[0.08] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
                Remaining
              </p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {formatCurrency(calculatedRemaining)}
              </p>
            </div>

            <div className="flex min-h-[86px] flex-col justify-between rounded-2xl border border-white/12 bg-white/[0.08] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
                Transactions
              </p>
              <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                {transactionCount}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Last verified payment:{" "}
              <span className="font-medium text-white/85">
                {lastPaymentAt ? formatShortDate(lastPaymentAt) : "None found"}
              </span>
            </span>

            <span className="text-white/55">
              Source:{" "}
              <span className="text-white/70">
                {transactionData?.money?.source ?? "JournalTrans GL 1070 credits"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DebtorCasePage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/debt-manager/debtors/:id");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const debtCaseId = match ? params.id : "";
  const [channel, setChannel] = useState<MessageChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachInvoice, setAttachInvoice] = useState(true);
  const [markContactSuccessful, setMarkContactSuccessful] = useState(true);
  const [remindDays, setRemindDays] = useState(5);
  const [reminderTitle, setReminderTitle] = useState("Follow up with debtor");
  const [reminderNote, setReminderNote] = useState("");
  const [resolutionChoice, setResolutionChoice] = useState<"ITC" | "LEGAL" | "ARRANGEMENT" | "PAID">("ITC");
  const [statusUpdateNote, setStatusUpdateNote] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<PreparedAttachment[]>([]);
  const [whatsappTemplateName, setWhatsappTemplateName] = useState("");
  const [whatsappLanguageCode, setWhatsappLanguageCode] = useState("en");
  const [whatsappVariablesText, setWhatsappVariablesText] = useState("");
  const seededDraftRef = useRef<string | null>(null);

  function dismissToast(id: string) {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }

  function showToast(toast: Omit<AppToast, "id">) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const nextToast: AppToast = { id, ...toast };
    setToasts((previous) => [nextToast, ...previous].slice(0, 5));

    if (!toast.persistent) {
      window.setTimeout(() => {
        dismissToast(id);
      }, toast.variant === "error" ? 6500 : 4500);
    }

    return id;
  }

  useEffect(() => {
    if (!feedback) return;

    const normalized = feedback.toLowerCase();
    const variant: ToastVariant =
      normalized.includes("failed") ||
      normalized.includes("error") ||
      normalized.includes("could not")
        ? "error"
        : normalized.includes("cancelled") || normalized.includes("canceled")
          ? "info"
          : "success";

    showToast({
      variant,
      title:
        variant === "error"
          ? "Action failed"
          : variant === "info"
            ? "Action cancelled"
            : "Action complete",
      description: feedback,
    });

    setFeedback(null);
  }, [feedback]);

  /**
   * Editable recipient fields
   *
   * By default the email and phone number will be pre‑populated from the
   * case record, but the collector can override them if the debtor
   * provides a different contact detail. Updating these values will
   * only affect the current communication action – the master record
   * remains unchanged. The values are initialised once when the case
   * data arrives and are not overwritten on subsequent state changes to
   * avoid erasing user input.
   */
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");

  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  const currentAgent = useMemo(
    () =>
      resolveCurrentAgent(
        (user as Record<string, unknown> | null | undefined) ?? null,
        agentsQuery.data?.data ?? [],
      ),
    [agentsQuery.data?.data, user],
  );

  const currentAgentId = currentAgent ? asNumber(currentAgent.ID, Number.NaN) : Number.NaN;

  const caseQuery = useQuery({
    queryKey: ["debt-manager", "cases", debtCaseId],
    enabled: Boolean(debtCaseId),
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseDetailPayload>>("/api/debt-manager/cases/" + debtCaseId),
  });

  const caseTransactionsQuery = useQuery({
    queryKey: ["debt-manager", "transactions", "case", debtCaseId],
    enabled: Boolean(debtCaseId),
    queryFn: () =>
      apiRequest<ApiResponse<CaseTransactionPayload>>(
        `/api/debt-manager/transactions/case/${debtCaseId}`,
      ),
  });

  const debtCase = caseQuery.data?.data?.case ?? null;
  const caseEvents = caseQuery.data?.data?.events ?? [];
  const transactionData = caseTransactionsQuery.data?.data ?? null;
  const workflowStatus = mapApiStatus(debtCase?.CurrentStatusName);
  const composeMode = workflowStatus === "FIRST_CONTACT" ? "invoice" : "followup";

  const followUp7DueAt =
    workflowStatus === "FOLLOW_UP_7D"
      ? addDays(debtCase?.StatusStartedAt, 7)
      : null;

  const followUp7DaysLeft = daysUntil(followUp7DueAt);

  useEffect(() => {
    if (!debtCase) return;

    // Seed editable recipient fields when the case loads or the contact
    // details change. Do not override an existing override: only set
    // when no value has been provided yet.
    setRecipientEmail((prev) => (prev ? prev : debtCase.ContactEmail ?? ""));
    setRecipientPhone((prev) => (prev ? prev : debtCase.ContactPhone ?? ""));

    setAttachInvoice(workflowStatus === "FIRST_CONTACT");
    setMarkContactSuccessful(workflowStatus === "FIRST_CONTACT");

    if (workflowStatus === "FOLLOW_UP_7D") {
      setReminderTitle("Check second 7 day waiting period");
    } else if (workflowStatus === "REMINDER_14D") {
      setReminderTitle("Check 14 day reminder period");
    } else {
      setReminderTitle("Follow up with debtor");
    }

    const seedKey = `${debtCaseId}-${channel}-${composeMode}`;
    if (seededDraftRef.current === seedKey) return;

    const defaults = getDraftForCase(debtCase, channel, composeMode);
    setSubject(defaults.subject);
    setBody(defaults.body);

    if (channel === "whatsapp") {
      const template = getWhatsAppTemplateConfig(
        debtCase,
        composeMode === "invoice" ? "invoice" : "followup",
      );
      setWhatsappTemplateName(template.templateName);
      setWhatsappLanguageCode(template.languageCode);
      setWhatsappVariablesText(template.variables.join("\n"));
    }

    seededDraftRef.current = seedKey;
  }, [debtCase, debtCaseId, channel, composeMode, workflowStatus]);

  useEffect(() => {
    if (!debtCase || channel !== "whatsapp") return;

    const templateMode =
      workflowStatus === "FIRST_CONTACT"
        ? "invoice"
        : workflowStatus === "FOLLOW_UP_7D"
          ? "final-demand"
          : "followup";

    const template = getWhatsAppTemplateConfig(debtCase, templateMode);
    setWhatsappTemplateName(template.templateName);
    setWhatsappLanguageCode(template.languageCode);
    setWhatsappVariablesText(template.variables.join("\n"));

    const draft =
      templateMode === "final-demand"
        ? getFinalDemandDraft(debtCase, "whatsapp")
        : getDraftForCase(debtCase, "whatsapp", templateMode === "invoice" ? "invoice" : "followup");
    setSubject(draft.subject);
    setBody(draft.body || template.preview);
  }, [debtCase, channel, workflowStatus]);

  const invalidateCaseData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["debt-manager", "cases", debtCaseId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["debt-manager", "cases"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["debt-manager", "transactions", "case", debtCaseId],
      }),
      Number.isFinite(currentAgentId)
        ? queryClient.invalidateQueries({
            queryKey: ["debt-manager", "agents", currentAgentId, "cases"],
          })
        : Promise.resolve(),
    ]);
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(currentAgentId)) {
        throw new Error("Could not resolve the current collector profile.");
      }

      return apiRequest<ApiResponse<unknown>>(
        `/api/debt-manager/cases/${debtCaseId}/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            targetAgentId: currentAgentId,
            triggeredByAgentId: currentAgentId,
            note: "Assigned from debt flow page",
          }),
        },
      );
    },
    onSuccess: async () => {
      setFeedback("Case assigned successfully.");
      await invalidateCaseData();
    },
  });

  const communicationMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiRequest<ApiResponse<unknown>>(
        `/api/debt-manager/cases/${debtCaseId}/events/communication`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
    },
  });

  const whatsappMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiRequest<WhatsAppSendPayload>("/api/whatsapp/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiRequest<ApiResponse<unknown>>(
        `/api/debt-manager/cases/${debtCaseId}/events/reminder`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: async () => {
      setFeedback("Reminder saved successfully.");
      await invalidateCaseData();
    },
  });

  const eventMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiRequest<ApiResponse<unknown>>(
        `/api/debt-manager/cases/${debtCaseId}/events`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
    },
  });

  const timeline = useMemo(() => {
    return caseEvents
      .slice()
      .sort((a, b) => {
        const aTime = parseDate(
          a.CreatedAt ?? a.ReminderAt ?? a.DueAt ?? a.CompletedAt,
        )?.getTime() ?? 0;
        const bTime = parseDate(
          b.CreatedAt ?? b.ReminderAt ?? b.DueAt ?? b.CompletedAt,
        )?.getTime() ?? 0;
        return bTime - aTime;
      })
      .map(mapEventRowToTimeline);
  }, [caseEvents]);

  const reminderEvents = useMemo(() => {
    return caseEvents.filter((row) => {
      const typeName = normalizeText(row.EventTypeName ?? row.EventTypeCode);
      return typeName.includes("reminder");
    });
  }, [caseEvents]);

  const reminder7DaysLeft = daysUntil(debtCase?.Reminder7DueAt);
  const reminder14DaysLeft = daysUntil(debtCase?.Reminder14DueAt);
  // Allow selecting a final resolution at any stage except when the final decision has already been made.
  // The early resolution panel appears for all statuses except the final resolution and outcome routes.
  const showEarlyResolution = useMemo(() => {
    return ![
      "REMINDER_14D",
      "RESOLUTION",
      "ITC",
      "LEGAL",
      "ARRANGEMENT",
      "PAID",
    ].includes(workflowStatus);
  }, [workflowStatus]);
  const canAct = Number.isFinite(currentAgentId);
  const anyMutationLoading =
    assignMutation.isPending ||
    communicationMutation.isPending ||
    whatsappMutation.isPending ||
    reminderMutation.isPending ||
    eventMutation.isPending;

  const isLoading = agentsQuery.isLoading || caseQuery.isLoading;
  const hasError = agentsQuery.isError || caseQuery.isError;

  const attachmentPayload = useMemo(
    () =>
      emailAttachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    [emailAttachments],
  );

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    try {
      const prepared = await Promise.all(
        files.map(async (file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          filename: file.name,
          content: await fileToBase64(file),
          contentType: file.type || "application/octet-stream",
          sizeLabel: formatFileSize(file.size),
        })),
      );

      setEmailAttachments((previous) => {
        const map = new Map(previous.map((item) => [item.id, item]));
        prepared.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to prepare attachments.");
    } finally {
      event.target.value = "";
    }
  }

  function removeAttachment(id: string) {
    setEmailAttachments((previous) => previous.filter((item) => item.id !== id));
  }

  function applyInvoiceDraft() {
    if (!debtCase) return;
    const draft = getDraftForCase(debtCase, channel, "invoice");
    setSubject(draft.subject);
    setBody(draft.body);
  }

  function applyFollowUpDraft() {
    if (!debtCase) return;
    const draft = getDraftForCase(debtCase, channel, "followup");
    setSubject(draft.subject);
    setBody(draft.body);
  }

  function applyFinalDemandDraft() {
    if (!debtCase) return;
    const draft = getFinalDemandDraft(debtCase, channel);
    setSubject(draft.subject);
    setBody(draft.body);

    if (channel === "whatsapp") {
      const template = getWhatsAppTemplateConfig(debtCase, "final-demand");
      setWhatsappTemplateName(template.templateName);
      setWhatsappLanguageCode(template.languageCode);
      setWhatsappVariablesText(template.variables.join("\n"));
    }
  }

  async function handleSendCommunication(sendNow: boolean) {
    if (!debtCase) return;

    try {
      setFeedback(null);

      const payload: Record<string, unknown> = {
        channel,
        subject: channel === "email" ? subject : null,
        body,
        sendNow,
        attachInvoice,
        markContactSuccessful,
        actionType:
          workflowStatus === "FIRST_CONTACT"
            ? attachInvoice
              ? "INVOICE_SENT"
              : "FIRST_CONTACT"
            : workflowStatus === "REMINDER_7D"
              ? "FOLLOW_UP_SENT"
              : workflowStatus === "FOLLOW_UP_7D"
                ? "SECOND_WAIT_NOTE"
                : workflowStatus === "REMINDER_14D"
                  ? "FINAL_REMINDER"
                  : "CASE_COMMUNICATION",
        recipientName: debtCase.DebtorName,
        // Use the editable recipient fields instead of the static case values
        recipientEmail: channel === "email" ? recipientEmail || debtCase.ContactEmail : null,
        recipientPhone:
          channel === "email" ? null : channel === "whatsapp" ? recipientPhone || debtCase.ContactPhone : recipientPhone || debtCase.ContactPhone,
        triggeredByAgentId: currentAgentId,
        note:
          workflowStatus === "FIRST_CONTACT" && attachInvoice
            ? "Invoice communication sent from debt flow."
            : workflowStatus === "REMINDER_7D"
              ? "Follow‑up communication sent from debt flow."
              : "Communication sent from debt flow.",
      };

      if (channel === "email" && attachmentPayload.length) {
        payload.attachments = attachmentPayload;
      }

      if (channel === "whatsapp") {
        const variables = parseWhatsAppVariables(whatsappVariablesText);
        payload.templateName = whatsappTemplateName;
        payload.languageCode = whatsappLanguageCode;
        payload.variables = variables;
        payload.attachments = attachmentPayload;

        if (sendNow) {
          const whatsappResponse = await whatsappMutation.mutateAsync({
            to: recipientPhone || debtCase.ContactPhone,
            templateName: whatsappTemplateName,
            languageCode: whatsappLanguageCode,
            variables,
            documents: attachmentPayload,
            appName: "DebtManager",
            requestedBy:
              currentAgent?.AgentName ||
              (typeof user?.username === "string" ? user.username : undefined) ||
              "SYSTEM",
          });

          payload.externalReference =
            whatsappResponse.data?.whatsappMessageId ||
            whatsappResponse.data?.reason ||
            null;
          payload.whatsappServiceResponse = whatsappResponse.data ?? whatsappResponse;
        }
      }

      await communicationMutation.mutateAsync(payload);
      setFeedback(
        sendNow
          ? channel === "whatsapp"
            ? "WhatsApp sent and communication logged successfully."
            : "Communication sent successfully."
          : "Communication saved successfully.",
      );

      if (sendNow && (channel === "email" || channel === "whatsapp")) {
        setEmailAttachments([]);
      }

      await invalidateCaseData();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to save communication.",
      );
    }
  }

  async function handleSaveReminder() {
    if (!debtCase) return;

    try {
      setFeedback(null);

      const remindAt = new Date();
      remindAt.setHours(9, 0, 0, 0);
      remindAt.setDate(remindAt.getDate() + remindDays);

      await reminderMutation.mutateAsync({
        remindAt: remindAt.toISOString(),
        title: reminderTitle,
        note: reminderNote,
        stage: workflowStatus,
        debtCaseId,
        triggeredByAgentId: currentAgentId,
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to save reminder.");
    }
  }

  async function sendFinalDemandConfirmed() {
    if (!debtCase) return;

    try {
      setFeedback(null);

      const isWhatsApp = channel === "whatsapp";
      const variables = parseWhatsAppVariables(whatsappVariablesText);
      let externalReference: string | null = null;
      let whatsappServiceResponse: unknown = null;

      if (isWhatsApp) {
        const whatsappResponse = await whatsappMutation.mutateAsync({
          to: recipientPhone || debtCase.ContactPhone,
          templateName: whatsappTemplateName,
          languageCode: whatsappLanguageCode,
          variables,
          documents: attachmentPayload,
          appName: "DebtManager",
          requestedBy:
            currentAgent?.AgentName ||
            (typeof user?.username === "string" ? user.username : undefined) ||
            "SYSTEM",
        });

        externalReference =
          whatsappResponse.data?.whatsappMessageId ||
          whatsappResponse.data?.reason ||
          null;
        whatsappServiceResponse = whatsappResponse.data ?? whatsappResponse;
      }

      await communicationMutation.mutateAsync({
        channel,
        subject: channel === "email" ? subject : null,
        body,
        sendNow: true,
        attachInvoice: false,
        markContactSuccessful: true,
        actionType: isWhatsApp ? "FINAL_DEMAND_WHATSAPP" : "FINAL_DEMAND_EMAIL",
        recipientName: debtCase.DebtorName,
        recipientEmail: channel === "email" ? recipientEmail || debtCase.ContactEmail : null,
        recipientPhone: isWhatsApp ? recipientPhone || debtCase.ContactPhone : null,
        triggeredByAgentId: currentAgentId,
        attachments: attachmentPayload,
        templateName: isWhatsApp ? whatsappTemplateName : undefined,
        languageCode: isWhatsApp ? whatsappLanguageCode : undefined,
        variables: isWhatsApp ? variables : undefined,
        externalReference,
        whatsappServiceResponse,
        note: isWhatsApp
          ? "Final demand WhatsApp sent from debt flow."
          : "Final demand email sent from debt flow.",
      });

      await eventMutation.mutateAsync({
        eventType: "FINAL_DEMAND_SENT",
        note:
          statusUpdateNote ||
          (isWhatsApp
            ? "Final demand WhatsApp sent from debt flow and 14 day cycle started."
            : "Final demand email sent from debt flow and 14 day cycle started."),
        channel,
        subject: channel === "email" ? subject : null,
        body,
        triggeredByAgentId: currentAgentId,
      });

      setFeedback(`${isWhatsApp ? "Final demand WhatsApp" : "Final demand email"} sent and case moved to the 14 day stage.`);
      setEmailAttachments([]);
      await invalidateCaseData();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to send final demand.",
      );
    }
  }

  async function handleSendFinalDemand() {
    if (!debtCase) return;

    if (
      workflowStatus === "FOLLOW_UP_7D" &&
      followUp7DaysLeft !== null &&
      followUp7DaysLeft > 0
    ) {
      showToast({
        variant: "warning",
        title: "Skip the remaining waiting period?",
        description: `There ${followUp7DaysLeft === 1 ? "is" : "are"} ${followUp7DaysLeft} day${followUp7DaysLeft === 1 ? "" : "s"} left in the second 7 day wait. Sending the final demand now will move this case straight into the 14 day waiting period.`,
        actionLabel: "Send final demand now",
        cancelLabel: "Keep waiting",
        persistent: true,
        onAction: sendFinalDemandConfirmed,
      });
      return;
    }

    await sendFinalDemandConfirmed();
  }

  async function handleConfirmResolution() {
    try {
      setFeedback(null);

      await eventMutation.mutateAsync({
        eventType: "RESOLUTION_SELECTED",
        resolutionType: resolutionChoice,
        note:
          statusUpdateNote ||
          `Resolution confirmed from debt flow: ${resolutionChoice}.`,
        triggeredByAgentId: currentAgentId,
      });

      setFeedback("Resolution confirmed successfully.");
      await invalidateCaseData();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to confirm resolution.",
      );
    }
  }

  function requestEarlyResolutionConfirmation() {
    showToast({
      variant: "warning",
      title: "Complete the case early?",
      description:
        "Confirming this outcome will skip any remaining workflow stages and mark the case according to the selected resolution. No fake dates will be added.",
      actionLabel: "Confirm resolution",
      cancelLabel: "Cancel",
      persistent: true,
      onAction: handleConfirmResolution,
    });
  }

  async function handleStatusUpdate(eventType: string, note: string) {
    try {
      setFeedback(null);

      await eventMutation.mutateAsync({
        eventType,
        note,
        triggeredByAgentId: currentAgentId,
      });

      setFeedback("Case update saved.");
      await invalidateCaseData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to save update.");
    }
  }

  async function handleEscalateToSuperior() {
    try {
      setFeedback(null);

      await eventMutation.mutateAsync({
        eventType: "ESCALATED_TO_SUPERIOR",
        note: escalationReason,
        triggeredByAgentId: currentAgentId,
      });

      setEscalationReason("");
      setFeedback("Case escalated successfully.");
      await invalidateCaseData();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to escalate case.",
      );
    }
  }

  function renderAttachmentPanel() {
    if (channel === "phone") return null;

    const isWhatsApp = channel === "whatsapp";

    return (
      <div className="space-y-2 rounded-xl border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isWhatsApp ? "WhatsApp document upload" : "Email attachments"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isWhatsApp
                ? "Upload the invoice or final demand document. It will be passed to the WhatsApp document template."
                : "Attach invoice files or supporting documents here."}
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40">
            {isWhatsApp ? <UploadCloud className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
            Add files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleAttachmentSelection}
            />
          </label>
        </div>

        {debtCase?.InvoiceFileName ? (
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Existing invoice on case: {" "}
            <span className="font-medium text-foreground">
              {debtCase.InvoiceFileName}
            </span>
          </div>
        ) : null}

        {emailAttachments.length ? (
          <div className="flex flex-wrap gap-2">
            {emailAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-3 py-2 text-xs"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">{attachment.filename}</span>
                <span className="text-muted-foreground">{attachment.sizeLabel}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
            No attachments added yet.
          </div>
        )}
      </div>
    );
  }

  function renderCommunicationWorkspace(mode: "first-contact" | "follow-up" | "final-demand") {
    return (
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <ActionPanel
          eyebrow="Message builder"
          title={
            channel === "email"
              ? "Compose email"
              : channel === "whatsapp"
                ? "Prepare WhatsApp"
                : "Log phone outcome"
          }
          description="Switch channels, drop in a draft, then complete the action without leaving the page."
        >
          <div className="flex flex-wrap gap-2">
            {[
              { key: "email", label: "Email", icon: Mail },
              { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
              { key: "phone", label: "Phone log", icon: Phone },
            ].map((item) => {
              const Icon = item.icon;
              const active = channel === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setChannel(item.key as MessageChannel)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "first-contact" ? (
              <Button type="button" variant="outline" className="rounded-lg" onClick={applyInvoiceDraft}>
                Use invoice draft
              </Button>
            ) : null}

            {mode === "follow-up" ? (
              <Button type="button" variant="outline" className="rounded-lg" onClick={applyFollowUpDraft}>
                Use follow‑up draft
              </Button>
            ) : null}

            {mode === "final-demand" ? (
              <Button type="button" variant="outline" className="rounded-lg" onClick={applyFinalDemandDraft}>
                Use final demand draft
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setSubject("");
                setBody("");
              }}
            >
              Clear
            </Button>
          </div>

          {channel === "email" ? (
            <>
              {/* Editable email recipient */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="recipient-email">
                  To
                </label>
                <input
                  id="recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder={debtCase?.ContactEmail || "Enter recipient email"}
                />
              </div>

              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Email subject"
              />

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[180px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Write the email body here."
              />

              {renderAttachmentPanel()}
            </>
          ) : null}

          {channel === "whatsapp" ? (
            <div className="space-y-3">
              {/* Editable WhatsApp recipient */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="recipient-phone-whatsapp">
                  To
                </label>
                <input
                  id="recipient-phone-whatsapp"
                  type="tel"
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder={debtCase?.ContactPhone || "Enter recipient phone"}
                />
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Auto-selected template
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {whatsappTemplateName || "No template selected"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {whatsappLanguageCode}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => { if (!debtCase) return; const template = getWhatsAppTemplateConfig(debtCase, "invoice"); setWhatsappTemplateName(template.templateName); setWhatsappLanguageCode(template.languageCode); setWhatsappVariablesText(template.variables.join("\n")); setBody(template.preview); setAttachInvoice(true); }}>Invoice template</Button>
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => { if (!debtCase) return; const template = getWhatsAppTemplateConfig(debtCase, "followup"); setWhatsappTemplateName(template.templateName); setWhatsappLanguageCode(template.languageCode); setWhatsappVariablesText(template.variables.join("\n")); setBody(template.preview); setAttachInvoice(false); }}>Follow-up template</Button>
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => { if (!debtCase) return; const template = getWhatsAppTemplateConfig(debtCase, "final-demand"); setWhatsappTemplateName(template.templateName); setWhatsappLanguageCode(template.languageCode); setWhatsappVariablesText(template.variables.join("\n")); setBody(template.preview); setAttachInvoice(false); }}>Final demand template</Button>
              </div>

              <textarea
                value={whatsappVariablesText}
                onChange={(event) => setWhatsappVariablesText(event.target.value)}
                className="min-h-[120px] w-full rounded-lg border bg-background px-4 py-2 font-mono text-xs outline-none"
                placeholder="One WhatsApp template variable per line"
              />

              {renderAttachmentPanel()}

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[100px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Optional log notes / preview for this WhatsApp action"
              />
            </div>
          ) : null}

          {channel === "phone" ? (
            <div className="space-y-3">
              {/* Editable phone recipient */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="recipient-phone-call">
                  Phone number
                </label>
                <input
                  id="recipient-phone-call"
                  type="tel"
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder={debtCase?.ContactPhone || "Enter phone number"}
                />
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[200px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Log the call outcome, who you spoke to, and what was agreed."
              />
            </div>
          ) : null}
        </ActionPanel>

        <ActionPanel
          eyebrow="Action controls"
          title="Complete the step"
          description="The workflow advances through real actions, not manual stage clicks."
        >
          <div className="grid gap-2">
            <MetricTile
              label="Current stage"
              value={getStageLabel(workflowStatus)}
              helper={debtCase?.CurrentOwnerName ? `Owned by ${debtCase.CurrentOwnerName}` : "No owner yet"}
            />

            {mode === "first-contact" ? (
              <>
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={attachInvoice}
                    onChange={(event) => setAttachInvoice(event.target.checked)}
                    className="h-4 w-4"
                    disabled={channel === "phone"}
                  />
                  Include invoice with this action
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={markContactSuccessful}
                    onChange={(event) => setMarkContactSuccessful(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Mark contact successful
                </label>
              </>
            ) : null}

            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended move</p>
              <p className="mt-1 text-sm font-medium leading-5 text-foreground">
                {getNextActionHint(debtCase!, workflowStatus)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleSendCommunication(channel !== "phone")}
                disabled={!canAct || anyMutationLoading}
                className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="mr-2 h-4 w-4" />
                {channel === "phone" ? "Save phone log" : channel === "whatsapp" ? "Send WhatsApp and log" : "Send and log action"}
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSendCommunication(false)}
                disabled={!canAct || anyMutationLoading || channel === "phone"}
                className="rounded-lg"
              >
                Save draft / log only
              </Button>
            </div>
          </div>
        </ActionPanel>
      </div>
    );
  }

  function renderMainAction(): ReactNode {
    if (!debtCase) return null;

    switch (workflowStatus) {
      case "UNASSIGNED":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="This case still needs an owner. Claim it and the workflow will start from first contact."
          >
            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <ActionPanel
                eyebrow="Assignment"
                title="Take ownership of this case"
                description="Claim the case into your queue so the collector workflow can begin immediately."
              >
                <MetricTile
                  label="Current owner"
                  value={debtCase.CurrentOwnerName ?? "Unassigned"}
                  helper="No collector currently owns this case"
                />
                <MetricTile
                  label="Recommended first step"
                  value="Assign and start first contact"
                  helper="The case will move into active handling once assigned"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => assignMutation.mutate()}
                    disabled={!canAct || anyMutationLoading}
                    className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Assign to me
                  </Button>
                  <Button variant="outline" disabled className="rounded-lg">
                    Assign to another agent
                  </Button>
                </div>
              </ActionPanel>

              <ActionPanel
                eyebrow="Case summary"
                title="What matters before you start"
                description="The core account details are visible here so you can decide whether to claim it immediately."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricTile
                    label="Outstanding"
                    value={formatCurrency(asNumber(debtCase.TotalOutstanding))}
                  />
                  <MetricTile
                    label="Priority"
                    value={debtCase.Priority ?? "Standard"}
                  />
                  <MetricTile
                    label="Days since termination"
                    value={String(asNumber(debtCase.DaysSinceTermination))}
                  />
                  <MetricTile
                    label="Recommended path"
                    value={debtCase.RecommendedPath ?? "Open"}
                  />
                </div>

                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Why this is waiting
                  </p>
                  <p className="mt-1 text-sm leading-5 text-foreground">
                    {debtCase.InternalNotes ||
                      "The case is sitting in the unassigned queue and needs a collector to begin first contact."}
                  </p>
                </div>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "FIRST_CONTACT":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="First contact is the active step. Use one clean action area to email, WhatsApp, or log calls without hunting around the page."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label="Invoice file"
                value={debtCase.InvoiceFileName || "Not attached yet"}
                helper="Attach a file if you want it sent with the message"
              />
              <MetricTile
                label="Contact phone"
                value={debtCase.ContactPhone || "No phone loaded"}
              />
              <MetricTile
                label="Contact email"
                value={debtCase.ContactEmail || "No email loaded"}
              />
            </div>

            {renderCommunicationWorkspace("first-contact")}
          </SectionCard>
        );

      case "REMINDER_7D":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="This is the first 7 day wait after first contact. Once the period ends, do the follow‑up here and move the case into the second 7 day wait."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label="Invoice sent"
                value={formatShortDate(debtCase.InvoiceSentAt)}
              />
              <MetricTile
                label="Follow‑up due"
                value={formatShortDate(debtCase.Reminder7DueAt)}
              />
              <MetricTile
                label="Cycle status"
                value={formatDueText(reminder7DaysLeft)}
                helper="This is the first waiting period before follow‑up"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
              <ActionPanel
                eyebrow="Follow‑up"
                title="Complete the follow‑up"
                description="Once the first 7 day wait has ended, use this area to send the actual follow‑up communication."
              >
                {renderCommunicationWorkspace("follow-up")}
              </ActionPanel>

              <ActionPanel
                eyebrow="Stage outcome"
                title="Move into the next 7 day wait"
                description="After the follow‑up is completed, the case should move into the second waiting period before final demand."
              >
                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[120px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add follow‑up notes or what happened with the debtor."
                />

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleSendCommunication(true)}
                    disabled={!canAct || anyMutationLoading}
                    className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {channel === "email"
                      ? "Send follow‑up email"
                      : channel === "whatsapp"
                        ? "Send WhatsApp template"
                        : "Save phone log"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() =>
                      handleStatusUpdate(
                        "FOLLOW_UP_SENT",
                        statusUpdateNote || "Follow‑up completed and second 7 day wait should begin.",
                      )
                    }
                    disabled={!canAct || anyMutationLoading}
                    className="rounded-lg"
                  >
                    Mark follow‑up complete
                  </Button>

                  {/* Reminder functionality has been removed from the application.
                      The save reminder button used to persist an internal reminder,
                      but this feature has been retired. */}
                </div>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "FOLLOW_UP_7D":
        // The second 7‑day waiting period before final demand. Reminders are no
        // longer part of the flow, so this stage simply displays the
        // waiting metrics and, once the period has passed, a panel to send
        // the final demand. If there are days remaining, an explanatory
        // message is shown instead of action controls.
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="The follow‑up has been completed. This stage is the second 7‑day wait before final demand."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label="Follow‑up completed"
                value={formatShortDate(debtCase.StatusStartedAt)}
              />
              <MetricTile
                label="Final demand available"
                value={formatShortDate(followUp7DueAt)}
              />
              <MetricTile
                label="Cycle status"
                value={formatDueText(followUp7DaysLeft)}
                helper="Once this period ends, final demand can be sent"
              />
            </div>

            {/* Final demand panel is always available during the second 7‑day wait.
                Collectors may choose to send the final demand early. If days remain in the
                waiting period, a note appears reminding them that sending now will skip
                the rest of the wait. */}
            <ActionPanel
              eyebrow="Final demand"
              title="Send final demand"
              description="Send the final demand to start the 14‑day waiting period."
            >
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={channel === "email" ? "default" : "outline"} className="rounded-lg" onClick={() => { setChannel("email"); if (!debtCase) return; const draft = getFinalDemandDraft(debtCase, "email"); setSubject(draft.subject); setBody(draft.body); }}>Email final demand</Button>
                <Button type="button" variant={channel === "whatsapp" ? "default" : "outline"} className="rounded-lg" onClick={() => { setChannel("whatsapp"); if (!debtCase) return; const template = getWhatsAppTemplateConfig(debtCase, "final-demand"); const draft = getFinalDemandDraft(debtCase, "whatsapp"); setWhatsappTemplateName(template.templateName); setWhatsappLanguageCode(template.languageCode); setWhatsappVariablesText(template.variables.join("\n")); setSubject(draft.subject); setBody(draft.body || template.preview); }}>WhatsApp final demand</Button>
                <Button type="button" variant="outline" className="rounded-lg" onClick={applyFinalDemandDraft}>Use current draft</Button>
              </div>

              {/* Editable email recipient for final demand */}
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="final-demand-recipient-email"
                >
                  To
                </label>
                <input
                  id="final-demand-recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder={debtCase?.ContactEmail || "Enter recipient email"}
                />
              </div>

              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Final demand subject"
              />

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Write the final demand email here."
              />

              {channel === "whatsapp" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="final-demand-recipient-whatsapp">To</label>
                    <input id="final-demand-recipient-whatsapp" type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} className="w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none" placeholder={debtCase?.ContactPhone || "Enter recipient phone"} />
                  </div>
                  <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Auto-selected WhatsApp template</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{whatsappTemplateName || "debt_final_demand_document"}</p>
                  </div>
                  <textarea value={whatsappVariablesText} onChange={(event) => setWhatsappVariablesText(event.target.value)} className="min-h-[120px] w-full rounded-lg border bg-background px-4 py-2 font-mono text-xs outline-none" placeholder="One WhatsApp template variable per line" />
                </div>
              ) : null}

              {renderAttachmentPanel()}

              <textarea
                value={statusUpdateNote}
                onChange={(event) => setStatusUpdateNote(event.target.value)}
                className="min-h-[80px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                placeholder="Add any context before sending final demand."
              />

              <Button
                onClick={handleSendFinalDemand}
                disabled={!canAct || anyMutationLoading}
                className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {channel === "whatsapp" ? "Send final demand WhatsApp" : "Send final demand email"}
              </Button>
            </ActionPanel>
          </SectionCard>
        );

      case "REMINDER_14D":
      case "RESOLUTION":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="The final demand has been sent. Now the 14 day waiting period and outcome decision sit in one clean control area."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label="Final demand sent"
                value={formatShortDate(debtCase.FinalDemandSentAt)}
              />
              <MetricTile
                label="14 day due"
                value={formatShortDate(debtCase.Reminder14DueAt)}
              />
              <MetricTile
                label="Cycle status"
                value={formatDueText(reminder14DaysLeft)}
                helper="When overdue, the collector should decide the next path now"
              />
            </div>

            {/* Reminder control removed – only the outcome route is now shown in this stage */}
            <div className="grid gap-3 xl:grid-cols-1">
              <ActionPanel
                eyebrow="Outcome route"
                title="Choose what happens next"
                description="Pick the next route for the debtor, then confirm it with a note so the workflow can move forward properly."
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <ChoiceButton
                    active={resolutionChoice === "ITC"}
                    onClick={() => setResolutionChoice("ITC")}
                    icon={<Landmark className="h-5 w-5 text-primary" />}
                    title="Send to ITC"
                    description="Move the case into the ITC process."
                  />
                  <ChoiceButton
                    active={resolutionChoice === "LEGAL"}
                    onClick={() => setResolutionChoice("LEGAL")}
                    icon={<Gavel className="h-5 w-5 text-primary" />}
                    title="Escalate to legal"
                    description="Hand the case over for legal action."
                  />
                  <ChoiceButton
                    active={resolutionChoice === "ARRANGEMENT"}
                    onClick={() => setResolutionChoice("ARRANGEMENT")}
                    icon={<FileText className="h-5 w-5 text-primary" />}
                    title="Create arrangement"
                    description="Set up a payment arrangement."
                  />
                  <ChoiceButton
                    active={resolutionChoice === "PAID"}
                    onClick={() => setResolutionChoice("PAID")}
                    icon={<BadgeCheck className="h-5 w-5 text-primary" />}
                    title="Mark as paid"
                    description="Close the case as paid."
                  />
                </div>

                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[100px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add the reasoning or note for the selected outcome."
                />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleConfirmResolution}
                    disabled={!canAct || anyMutationLoading}
                    className="flex-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Confirm outcome
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleStatusUpdate(
                        "CASE_NOTE_ADDED",
                        statusUpdateNote || "Resolution note added from the debt flow.",
                      )
                    }
                    disabled={!canAct || anyMutationLoading}
                    className="flex-1 rounded-lg"
                  >
                    Save note only
                  </Button>
                </div>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "ITC":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="This page should feel calm once a route is chosen. Record the real update and keep the next action obvious."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Route" value="ITC" />
              <MetricTile
                label="Recommended path"
                value={debtCase.RecommendedPath ?? "ITC"}
              />
              <MetricTile
                label="Current status"
                value={getStageLabel(workflowStatus)}
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
              <ActionPanel
                eyebrow="Update log"
                title="Record ITC progress"
                description="Keep one clean running note of the latest ITC action or response."
              >
                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add the latest ITC update."
                />
              </ActionPanel>

              <ActionPanel
                eyebrow="Quick actions"
                title="Complete the next move"
                description="The most likely actions are grouped here so the collector does not have to scan around the page."
              >
                <Button
                  onClick={() =>
                    handleStatusUpdate(
                      "ITC_UPDATE",
                      statusUpdateNote || "ITC progress update logged.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Record ITC update
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleStatusUpdate(
                      "PAYMENT_RECEIVED",
                      statusUpdateNote || "Payment received and case should close as paid.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg"
                >
                  Mark as paid
                </Button>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "LEGAL":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="Legal handling should feel direct and controlled: one note area and a small set of clear actions."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Route" value="Legal" />
              <MetricTile
                label="Current status"
                value={getStageLabel(workflowStatus)}
              />
              <MetricTile
                label="Outstanding"
                value={formatCurrency(asNumber(debtCase.TotalOutstanding))}
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
              <ActionPanel
                eyebrow="Legal notes"
                title="Capture legal progress"
                description="Keep references, handover notes, and legal updates in one place."
              >
                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add legal update, reference, or handover note."
                />
              </ActionPanel>

              <ActionPanel
                eyebrow="Quick actions"
                title="Complete the next move"
                description="Save the legal update or close the case as paid if recovery has happened."
              >
                <Button
                  onClick={() =>
                    handleStatusUpdate(
                      "LEGAL_UPDATE",
                      statusUpdateNote || "Legal progress update logged.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add legal update
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleStatusUpdate(
                      "PAYMENT_RECEIVED",
                      statusUpdateNote || "Payment received and case should close as paid.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg"
                >
                  Mark as paid
                </Button>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "ARRANGEMENT":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="Arrangement cases should be easy to manage: one clear note feed and a small set of follow‑up actions."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Route" value="Arrangement" />
              <MetricTile
                label="Arrangement active"
                value={asBool(debtCase.ArrangementActive) ? "Yes" : "Pending"}
              />
              <MetricTile
                label="Outstanding"
                value={formatCurrency(asNumber(debtCase.TotalOutstanding))}
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
              <ActionPanel
                eyebrow="Arrangement notes"
                title="Track arrangement progress"
                description="Record missed payments, collector notes, or progress updates in one clean area."
              >
                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add arrangement update, missed payment note, or received payment detail."
                />
              </ActionPanel>

              <ActionPanel
                eyebrow="Quick actions"
                title="Complete the next move"
                description="Update the arrangement or register a payment without jumping between sections."
              >
                <Button
                  onClick={() =>
                    handleStatusUpdate(
                      "ARRANGEMENT_UPDATE",
                      statusUpdateNote || "Arrangement update logged.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add arrangement note
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleStatusUpdate(
                      "PAYMENT_RECEIVED",
                      statusUpdateNote || "Payment received and case should close as paid.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg"
                >
                  Log payment received
                </Button>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      case "PAID":
        return (
          <SectionCard
            borderColor="border-primary/30"
            title="Action workspace"
            subtitle="Once paid, the page should mostly be about clean closure, proof, and a short closing record."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Case status" value="Paid" />
              <MetricTile
                label="Payment received"
                value={asBool(debtCase.PaymentReceived) ? "Yes" : "Not confirmed"}
              />
              <MetricTile
                label="Paid at"
                value={formatShortDate(debtCase.PaymentReceivedAt)}
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
              <ActionPanel
                eyebrow="Closure notes"
                title="Save closure detail"
                description="Capture the proof, reference, or final summary so the case closes cleanly."
              >
                <textarea
                  value={statusUpdateNote}
                  onChange={(event) => setStatusUpdateNote(event.target.value)}
                  className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
                  placeholder="Add payment reference, proof note, or closure summary."
                />
              </ActionPanel>

              <ActionPanel
                eyebrow="Finalise"
                title="Complete the record"
                description="Save the final closure note to keep the paid case complete and auditable."
              >
                <Button
                  onClick={() =>
                    handleStatusUpdate(
                      "PAYMENT_PROOF_ADDED",
                      statusUpdateNote || "Payment proof or closure note added.",
                    )
                  }
                  disabled={!canAct || anyMutationLoading}
                  className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save closure note
                </Button>
              </ActionPanel>
            </div>
          </SectionCard>
        );

      default:
        return null;
    }
  }

  return (
    <DebtAppShell>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <DebtPageHeader
        badge="Debtor case"
        title={debtCase?.DebtorName ?? "Debt flow"}
        description="A cleaner operational view of the debtor journey, with one compact action workspace per status."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setLocation("/debt-manager/master-list")}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to master list
            </Button>

            <Button
              onClick={() => setLocation("/debt-manager/agent-list")}
              className="bg-white text-primary hover:bg-white/90"
            >
              Open agent list
            </Button>
          </>
        }
      />

      {isLoading ? (
        <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading debt case...</p>
        </section>
      ) : hasError || !debtCase ? (
        <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center shadow-sm">
          <p className="font-medium text-destructive">Could not load the debt case.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the case and event endpoints, then refresh the page.
          </p>
        </section>
      ) : (
        // Restructured page layout: top two blocks, full-width action workspace, bottom row for reminders and escalation, timeline at end
        <section className="space-y-6">
          {/* Top row: debtor overview and case essentials side by side on large screens */}
          <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-start">
            {/* Debtor workflow case panel */}
            <div className="overflow-hidden rounded-3xl border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)] p-5 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  Debtor workflow case
                </div>

                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {debtCase.DebtorName}
                    </h2>
                    <p className="text-xs text-white/72">
                      {debtCase.AccountNo} • {debtCase.ComplexName ?? "No area loaded"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                      {getStageLabel(workflowStatus)}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
                      Verified paid: {formatCurrency(asNumber(transactionData?.money?.verifiedPaid))}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
                      Owner: {debtCase.CurrentOwnerName ?? "Unassigned"}
                    </span>
                  </div>
                </div>

               
                <FlowTracker status={workflowStatus} />

                <div className="rounded-xl bg-white/8 px-4 py-3 backdrop-blur-sm">
                  <p className="text-sm leading-5 text-white/80">
                    {getNextActionHint(debtCase, workflowStatus)}
                  </p>
                </div>
              </div>
            </div>

            {/* Case essentials card */}
            <SectionCard borderColor="border-secondary/30" title="Case essentials">
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    {debtCase.DebtorName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    {debtCase.ContactPhone ?? "No phone loaded"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {debtCase.ContactEmail ?? "No email loaded"}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {debtCase.ComplexName ?? "Unknown area"}
                  </div>
                </div>
              </div>

              {/* Display a couple of key metrics for quick context using consistent tiles */}
             

              {/* <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile
                  label="Verified paid"
                  value={formatCurrency(asNumber(transactionData?.money?.verifiedPaid))}
                  helper="From transaction controller"
                />
                <MetricTile
                  label="Calculated remaining"
                  value={formatCurrency(
                    transactionData?.money?.calculatedRemaining !== undefined
                      ? asNumber(transactionData.money.calculatedRemaining)
                      : Math.max(asNumber(debtCase.TotalOutstanding) - asNumber(transactionData?.money?.verifiedPaid), 0),
                  )}
                  helper="Original debt less verified payments"
                />
                <MetricTile
                  label="Payment progress"
                  value={`${asNumber(transactionData?.money?.progressPercent)}%`}
                  helper={`${asNumber(transactionData?.money?.transactionCount)} verified transaction(s)`}
                />
              </div> */}

              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">Key dates</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>Qualified</span>
                    <span className="font-medium text-foreground">
                      {formatShortDate(debtCase.DebtorQualifiedDate ?? debtCase.CreatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Invoice sent</span>
                    <span className="font-medium text-foreground">
                      {formatShortDate(debtCase.InvoiceSentAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>First 7 day due</span>
                    <span className="font-medium text-foreground">
                      {formatShortDate(debtCase.Reminder7DueAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Second 7 day due</span>
                    <span className="font-medium text-foreground">
                      {formatShortDate(followUp7DueAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>14 day due</span>
                    <span className="font-medium text-foreground">
                      {formatShortDate(debtCase.Reminder14DueAt)}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
 <MoneyProgressBubble
                  debtCase={debtCase}
                  transactionData={transactionData}
                  isLoading={caseTransactionsQuery.isLoading}
                />

          {/* Full width action workspace */}
          {renderMainAction()}
          

          {/* Optional early resolution panel.
             This panel allows collectors to mark the final outcome at any point in the process.
             When used, it completes the case and advances it through the remaining stages automatically. */}
          <div
  className={`grid w-full gap-6 lg:items-start ${
    showEarlyResolution ? "lg:grid-cols-2" : "lg:grid-cols-1"
  }`}
>
  {showEarlyResolution && (
    <SectionCard
      borderColor="border-primary/30"
      title="Resolve case early"
      subtitle="If a resolution has already been reached, you can set the final outcome now."
    >
      <div className="grid gap-2 md:grid-cols-2">
        <ChoiceButton
          active={resolutionChoice === "ITC"}
          onClick={() => setResolutionChoice("ITC")}
          icon={<Landmark className="h-5 w-5 text-primary" />}
          title="Send to ITC"
          description="Move the case into the ITC process."
        />

        <ChoiceButton
          active={resolutionChoice === "LEGAL"}
          onClick={() => setResolutionChoice("LEGAL")}
          icon={<Gavel className="h-5 w-5 text-primary" />}
          title="Escalate to legal"
          description="Hand the case over for legal action."
        />

        <ChoiceButton
          active={resolutionChoice === "ARRANGEMENT"}
          onClick={() => setResolutionChoice("ARRANGEMENT")}
          icon={<FileText className="h-5 w-5 text-primary" />}
          title="Create arrangement"
          description="Set up a payment arrangement."
        />

        <ChoiceButton
          active={resolutionChoice === "PAID"}
          onClick={() => setResolutionChoice("PAID")}
          icon={<BadgeCheck className="h-5 w-5 text-primary" />}
          title="Mark as paid"
          description="Close the case as paid."
        />
      </div>

      <textarea
        value={statusUpdateNote}
        onChange={(event) => setStatusUpdateNote(event.target.value)}
        className="mt-2 min-h-[100px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
        placeholder="Add the reasoning or note for the selected outcome."
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={requestEarlyResolutionConfirmation}
          disabled={!canAct || anyMutationLoading}
          className="flex-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Confirm resolution
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            handleStatusUpdate(
              "CASE_NOTE_ADDED",
              statusUpdateNote || "Resolution note added from the debt flow.",
            )
          }
          disabled={!canAct || anyMutationLoading}
          className="flex-1 rounded-lg"
        >
          Save note only
        </Button>
      </div>
    </SectionCard>
  )}

  <SectionCard
    borderColor="border-destructive/30"
    title="Escalate to superior"
    subtitle="This creates an escalation event and updates the case flag."
  >
    <textarea
      value={escalationReason}
      onChange={(event) => setEscalationReason(event.target.value)}
      className="min-h-[160px] w-full rounded-lg border bg-background px-4 py-2 text-sm outline-none"
      placeholder="Add the reason for escalation and what decision or support is needed."
    />

    <div className="mt-2 flex flex-wrap gap-2">
      <Button
        onClick={handleEscalateToSuperior}
        disabled={!canAct || anyMutationLoading || !escalationReason.trim()}
        className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Escalate to superior
      </Button>

      <Button
        variant="outline"
        onClick={() =>
          handleStatusUpdate(
            "CASE_NOTE_ADDED",
            escalationReason || "Escalation draft note saved.",
          )
        }
        disabled={!canAct || anyMutationLoading || !escalationReason.trim()}
        className="rounded-lg"
      >
        Save note only
      </Button>
    </div>
  </SectionCard>
</div>

          {/* Timeline/history section */}
          <SectionCard
            borderColor="border-secondary/30"
            title="Timeline and history"
            subtitle="Every action saved in the event table should appear here."
          >
            {timeline.length ? (
              <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-1">
                {timeline.map((item) => {
                  const Icon = getTimelineIcon(item.type);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl bg-muted/30 p-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-foreground text-sm">
                            {item.title}
                          </p>
                          <span className="text-xs font-medium text-muted-foreground">
                            {item.dateLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No case events yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  When actions are recorded in the backend, they will appear here.
                </p>
              </div>
            )}
          </SectionCard>
        </section>
      )}
    </DebtAppShell>
  );
}