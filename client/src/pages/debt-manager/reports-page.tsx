import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileWarning,
  Hourglass,
  PhoneCall,
  ShieldAlert,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from "recharts";

import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ChartDatum = {
  name?: string;
  day?: string;
  date?: string;
  count?: number;
  value?: number;
  openCases?: number;
  contacts?: number;
  successfulContacts?: number;
  failedContacts?: number;
  completedTasks?: number;
  successRate?: number;
  agent?: string;
  accountNo?: string;
  debtorName?: string;
  agentName?: string;
  amountPaid?: number;
  transactionCount?: number;
  lastPaymentAt?: string | null;
  cumulativeValue?: number;
  avgValue?: number;
};

type TransactionRow = {
  accountNo: string;
  debtorName: string;
  agentName: string;
  amount: number;
  tranDate: string | null;
  journalNo: string | number | null;
  description: string | null;
};

type TransactionSummaryPayload = {
  verifiedIncome: number;
  transactionCount: number;
  paymentsTimeline: Array<{
    date: string;
    value: number;
    count: number;
  }>;
  agentCollections: Array<{
    name: string;
    value: number;
    count: number;
  }>;
  topPaidAccounts: Array<{
    accountNo: string;
    debtorName: string;
    agentName: string;
    amountPaid: number;
    transactionCount: number;
    lastPaymentAt: string | null;
  }>;
  transactions: TransactionRow[];
  source: string;
  rule: string;
  note: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-ZA", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const colors = [
  "#0e45a9",
  "#14b8a6",
  "#e91e63",
  "#7c3aed",
  "#f97316",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#64748b",
  "#06b6d4",
  "#84cc16",
  "#a855f7",
];

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value: unknown) {
  return currency.format(asNumber(value));
}

function formatNumber(value: unknown) {
  return numberFmt.format(asNumber(value));
}

function formatDecimal(value: unknown, digits = 1) {
  const n = asNumber(value);
  return n.toFixed(digits);
}

function compactMoney(value: unknown) {
  return `R${compact.format(asNumber(value))}`;
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function yearsAgoIsoDate(years: number) {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - years);
  return start.toISOString().split("T")[0];
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function cleanDate(value?: string | null) {
  return value ? String(value).slice(0, 10) : "-";
}

function StatusPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="p-5 pt-3">{children}</CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function EmptyChart({ height = 280 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground"
      style={{ height }}
    >
      No data to display for this period.
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((item: any, index: number) => {
        const key = String(item.dataKey ?? "");
        const isMoney = /value|income|outstanding|amount|paid|cumulative/i.test(key);

        return (
          <p key={index} className="text-muted-foreground">
            <span className="font-medium text-foreground">{item.name}: </span>
            {typeof item.value === "number" && isMoney
              ? formatCurrency(item.value)
              : formatNumber(item.value)}
          </p>
        );
      })}
    </div>
  );
}

function TransactionSummaryBlock({
  verifiedIncome,
  transactionCount,
  averageTransaction,
  lastTransaction,
  isLoading,
  isError,
  onOpen,
}: {
  verifiedIncome: number;
  transactionCount: number;
  averageTransaction: number;
  lastTransaction: TransactionRow | null;
  isLoading: boolean;
  isError: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-[32px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-card to-card p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl"
    >
      <div className="relative p-5 md:p-6">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
              <DollarSign className="h-3.5 w-3.5" />
              Verified transaction money
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {isError ? "Transaction feed unavailable" : formatCurrency(verifiedIncome)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isError
                ? "The report is still available, but the transaction endpoint did not return verified money."
                : "Click to open the compact transaction command view with verified GL 1070 collections, debtor detail and trend graphs."}
            </p>
          </div>

          <div className="grid min-w-[min(100%,520px)] gap-3 sm:grid-cols-3">
            <MiniMetric
              label="Transactions"
              value={isLoading ? "..." : formatNumber(transactionCount)}
              helper="Verified rows"
            />
            <MiniMetric
              label="Avg value"
              value={isLoading ? "..." : formatCurrency(averageTransaction)}
              helper="Per transaction"
            />
            <MiniMetric
              label="Last payment"
              value={isLoading ? "..." : cleanDate(lastTransaction?.tranDate)}
              helper={lastTransaction?.amount ? formatCurrency(lastTransaction.amount) : "No row loaded"}
            />
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:translate-x-1">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function TransactionDetailView({
  open,
  onClose,
  transactionIncome,
  paymentsTimeline,
  cumulativeIncomeTimeline,
  transactionCountTimeline,
  agentCollections,
  descriptionBreakdown,
  topPaidAccounts,
  transactionRows,
  verifiedIncome,
  verifiedTransactionCount,
  averageTransaction,
  largestTransaction,
  lastTransaction,
  source,
  rule,
  note,
  endpointState,
}: {
  open: boolean;
  onClose: () => void;
  transactionIncome: TransactionSummaryPayload | null;
  paymentsTimeline: ChartDatum[];
  cumulativeIncomeTimeline: ChartDatum[];
  transactionCountTimeline: ChartDatum[];
  agentCollections: ChartDatum[];
  descriptionBreakdown: ChartDatum[];
  topPaidAccounts: ChartDatum[];
  transactionRows: TransactionRow[];
  verifiedIncome: number;
  verifiedTransactionCount: number;
  averageTransaction: number;
  largestTransaction: TransactionRow | null;
  lastTransaction: TransactionRow | null;
  source: string;
  rule: string;
  note: string;
  endpointState: "loading" | "error" | "active";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-3 backdrop-blur-xl md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 p-4 backdrop-blur md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                    Transaction command view
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {endpointState === "active"
                      ? "Endpoint active"
                      : endpointState === "loading"
                        ? "Loading endpoint"
                        : "Endpoint error"}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  Verified collections detail
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {note}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4 md:p-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MiniMetric label="Verified income" value={formatCurrency(verifiedIncome)} helper={source} />
              <MiniMetric label="Transactions" value={formatNumber(verifiedTransactionCount)} helper="Counted GL 1070 credits" />
              <MiniMetric label="Average" value={formatCurrency(averageTransaction)} helper="Average transaction value" />
              <MiniMetric
                label="Largest"
                value={formatCurrency(largestTransaction?.amount)}
                helper={largestTransaction?.debtorName ?? "No row loaded"}
              />
              <MiniMetric
                label="Last"
                value={cleanDate(lastTransaction?.tranDate)}
                helper={lastTransaction?.amount ? formatCurrency(lastTransaction.amount) : "No row loaded"}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <ChartCard title="Income timeline" subtitle="Daily verified GL 1070 income by transaction date.">
                {paymentsTimeline.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={paymentsTimeline}>
                      <defs>
                        <linearGradient id="txIncomeArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.75} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#txIncomeArea)" strokeWidth={3} name="Verified income" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Cumulative income" subtitle="Running total for the selected report period.">
                {cumulativeIncomeTimeline.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={cumulativeIncomeTimeline}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="cumulativeValue" stroke="#0e45a9" strokeWidth={4} dot={{ r: 4 }} name="Cumulative income" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Transactions per day" subtitle="Daily verified transaction count.">
                {transactionCountTimeline.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={transactionCountTimeline}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Transactions" radius={[12, 12, 0, 0]} fill="#14b8a6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart height={260} />}
              </ChartCard>

              <ChartCard title="Collections by agent" subtitle="Verified income grouped by current DebtCase owner.">
                {agentCollections.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={agentCollections} margin={{ bottom: 50 }}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={65} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Verified income" radius={[12, 12, 0, 0]} fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart height={260} />}
              </ChartCard>

              <ChartCard title="Journal description breakdown" subtitle="What the verified transactions are made up of.">
                {descriptionBreakdown.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={descriptionBreakdown} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} width={140} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Value" radius={[0, 12, 12, 0]} fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart height={300} />}
              </ChartCard>

              <ChartCard title="Integrity rule" subtitle="Exactly what this transaction block is counting.">
                <div className="grid gap-3">
                  <StatusPill label="Source" value={source} />
                  <StatusPill label="Rule" value={rule} />
                  <StatusPill
                    label="Endpoint range"
                    value={
                      transactionIncome?.dateRange
                        ? `${cleanDate(transactionIncome.dateRange.startDate)} to ${cleanDate(transactionIncome.dateRange.endDate)}`
                        : "No endpoint range loaded"
                    }
                  />
                </div>
              </ChartCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <ChartCard title="Top paid debtors" subtitle="Highest verified collections in the selected period.">
                {topPaidAccounts.length ? (
                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium text-muted-foreground">Account</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Debtor</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Paid</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Txns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPaidAccounts.map((item) => (
                          <tr key={`${item.accountNo}-${item.debtorName}`} className="border-t border-border/70">
                            <td className="px-3 py-3 font-medium text-foreground">{item.accountNo}</td>
                            <td className="px-3 py-3 text-muted-foreground">{item.debtorName}</td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(item.amountPaid)}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground">{formatNumber(item.transactionCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyChart height={280} />}
              </ChartCard>

              <ChartCard title="Recent verified transactions" subtitle="Latest transaction rows returned by the transaction controller.">
                {transactionRows.length ? (
                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Account</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Debtor</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionRows.map((item, index) => (
                          <tr key={`${item.accountNo}-${item.journalNo}-${index}`} className="border-t border-border/70">
                            <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">{cleanDate(item.tranDate)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{item.accountNo}</td>
                            <td className="px-3 py-3 text-muted-foreground">{item.debtorName}</td>
                            <td className="px-3 py-3 text-muted-foreground">{item.description ?? "No description"}</td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyChart height={280} />}
              </ChartCard>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


function CommunicationSummaryBlock({
  totalContactAttempts,
  contactSuccessRate,
  uniqueCasesContacted,
  outboundContacts,
  onOpen,
}: {
  totalContactAttempts: number;
  contactSuccessRate: number;
  uniqueCasesContacted: number;
  outboundContacts: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-[32px] border border-blue-500/20 bg-gradient-to-br from-blue-500/15 via-card to-card p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-xl"
    >
      <div className="relative p-5 md:p-6">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              <PhoneCall className="h-3.5 w-3.5" />
              Communication activity
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {formatNumber(totalContactAttempts)} contacts
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Click to open communication tracking: method mix, outcomes, daily trend, direction, agent activity and invoice/final demand communications.
            </p>
          </div>

          <div className="grid min-w-[min(100%,520px)] gap-3 sm:grid-cols-3">
            <MiniMetric label="Success rate" value={`${formatNumber(contactSuccessRate)}%`} helper="Successful vs failed" />
            <MiniMetric label="Cases touched" value={formatNumber(uniqueCasesContacted)} helper="Distinct debt cases" />
            <MiniMetric label="Outbound" value={formatNumber(outboundContacts)} helper="Outbound communications" />
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:translate-x-1">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function CommunicationDetailView({
  open,
  onClose,
  productivity,
  contactData,
  contactOutcomeData,
  contactDirectionData,
  dailyContactTrend,
  agentPerformance,
}: {
  open: boolean;
  onClose: () => void;
  productivity: any;
  contactData: ChartDatum[];
  contactOutcomeData: ChartDatum[];
  contactDirectionData: ChartDatum[];
  dailyContactTrend: ChartDatum[];
  agentPerformance: ChartDatum[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-3 backdrop-blur-xl md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 p-4 backdrop-blur md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    Communication command view
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    DebtCaseEvent.CommunicationType
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  Contact attempts and communication tracking
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  This view counts event rows where CommunicationType is populated, including emails, invoice communications, final demands and follow-ups.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4 md:p-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MiniMetric label="Total contacts" value={formatNumber(productivity.totalContactAttempts)} helper="Communication events" />
              <MiniMetric label="Successful" value={formatNumber(productivity.successfulContacts)} helper="SuccessFlag = 1" />
              <MiniMetric label="Failed" value={formatNumber(productivity.failedContacts)} helper="SuccessFlag = 0" />
              <MiniMetric label="Success rate" value={`${formatNumber(productivity.contactSuccessRate)}%`} helper="Success / known outcomes" />
              <MiniMetric label="Invoice comms" value={formatNumber(productivity.invoiceCommunications)} helper="IncludesInvoice = 1" />
              <MiniMetric label="Final demands" value={formatNumber(productivity.finalDemandCommunications)} helper="IncludesFinalDemand = 1" />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <ChartCard title="Daily communication activity" subtitle="Contact volume per day in the selected report period.">
                {dailyContactTrend.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyContactTrend}>
                      <defs>
                        <linearGradient id="communicationArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0e45a9" stopOpacity={0.7} />
                          <stop offset="95%" stopColor="#0e45a9" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#0e45a9" fill="url(#communicationArea)" strokeWidth={3} name="Contacts" />
                      <Line type="monotone" dataKey="successfulContacts" stroke="#10b981" strokeWidth={2} name="Successful" />
                      <Line type="monotone" dataKey="failedContacts" stroke="#ef4444" strokeWidth={2} name="Failed" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Communication methods" subtitle="Attempt mix by communication channel.">
                {contactData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={contactData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                        {contactData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Communication outcomes" subtitle="Success, failed and unknown communication outcomes.">
                {contactOutcomeData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={contactOutcomeData}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Contacts" radius={[12, 12, 0, 0]}>
                        {contactOutcomeData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Communication direction" subtitle="Inbound vs outbound communication rows.">
                {contactDirectionData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={contactDirectionData} dataKey="count" nameKey="name" innerRadius={55} outerRadius={105} label>
                        {contactDirectionData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Agent communication output" subtitle="Contacts, successes and failed attempts by collector.">
                {agentPerformance.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={agentPerformance} margin={{ bottom: 60 }}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="agent" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="contacts" name="Contacts" fill="#0e45a9" radius={[12, 12, 0, 0]} />
                      <Bar dataKey="successfulContacts" name="Successful" fill="#10b981" radius={[12, 12, 0, 0]} />
                      <Bar dataKey="failedContacts" name="Failed" fill="#ef4444" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Communication integrity rule" subtitle="How communication/contact attempts are counted.">
                <div className="grid gap-3">
                  <StatusPill label="Rule" value="DebtCaseEvent rows where CommunicationType IS NOT NULL" />
                  <StatusPill label="Unique cases contacted" value={formatNumber(productivity.uniqueCasesContacted)} />
                  <StatusPill label="Unique recipients" value={formatNumber(productivity.uniqueRecipientsContacted)} />
                  <StatusPill label="Outbound / inbound" value={`${formatNumber(productivity.outboundContacts)} / ${formatNumber(productivity.inboundContacts)}`} />
                </div>
              </ChartCard>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStartIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [transactionStartDate, setTransactionStartDate] = useState(yearsAgoIsoDate(3));
  const [transactionEndDate, setTransactionEndDate] = useState(todayIsoDate());
  const [isTransactionViewOpen, setIsTransactionViewOpen] = useState(false);
  const [isCommunicationViewOpen, setIsCommunicationViewOpen] = useState(false);

  const statsQuery = useQuery({
    queryKey: ["debt-manager", "stats", startDate, endDate],
    queryFn: () =>
      apiRequest<ApiResponse<any>>(
        `/api/debt-manager/stats?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
      ),
  });

  const transactionsQuery = useQuery({
    queryKey: [
      "debt-manager",
      "transactions",
      "reports",
      transactionStartDate,
      transactionEndDate,
    ],
    queryFn: () =>
      apiRequest<ApiResponse<TransactionSummaryPayload>>(
        `/api/debt-manager/transactions?start=${encodeURIComponent(transactionStartDate)}&end=${encodeURIComponent(transactionEndDate)}&includeTransactions=true&topLimit=10`,
      ),
  });

  const data = statsQuery.data?.data ?? {};
  const overview = data.overview ?? {};
  const productivity = data.productivity ?? {};
  const operationalActions = data.operationalActions ?? {};
  const income = data.income ?? {};
  const transactionIncome = transactionsQuery.data?.data ?? null;
  const charts = data.charts ?? {};
  const workflow = data.workflow ?? {};

  const statusData: ChartDatum[] = useMemo(() => charts.statusDistribution ?? [], [charts.statusDistribution]);
  const statusValueData: ChartDatum[] = useMemo(() => charts.statusValueDistribution ?? [], [charts.statusValueDistribution]);
  const waitingData: ChartDatum[] = useMemo(() => charts.waitingBreakdown ?? [], [charts.waitingBreakdown]);
  const contactData: ChartDatum[] = useMemo(() => charts.contactAttemptsByType ?? [], [charts.contactAttemptsByType]);
  const contactOutcomeData: ChartDatum[] = useMemo(() => charts.contactOutcomes ?? [], [charts.contactOutcomes]);
  const contactDirectionData: ChartDatum[] = useMemo(() => charts.contactDirections ?? [], [charts.contactDirections]);
  const dailyContactTrend: ChartDatum[] = useMemo(() => charts.dailyContactTrend ?? [], [charts.dailyContactTrend]);
  const priorityData: ChartDatum[] = useMemo(() => charts.priorityDistribution ?? [], [charts.priorityDistribution]);
  const pathData: ChartDatum[] = useMemo(() => charts.recommendedPathDistribution ?? [], [charts.recommendedPathDistribution]);
  const ageBucketData: ChartDatum[] = useMemo(() => charts.ageBuckets ?? [], [charts.ageBuckets]);
  const resolutionData: ChartDatum[] = useMemo(() => charts.resolutionDistribution ?? [], [charts.resolutionDistribution]);
  const agentWorkload: ChartDatum[] = useMemo(() => charts.agentWorkload ?? [], [charts.agentWorkload]);
  const agentPerformance: ChartDatum[] = useMemo(() => charts.agentPerformance ?? [], [charts.agentPerformance]);

  const paymentsTimeline: ChartDatum[] = useMemo(
    () => transactionIncome?.paymentsTimeline ?? charts.paymentsTimeline ?? income.paymentsTimeline ?? [],
    [transactionIncome?.paymentsTimeline, charts.paymentsTimeline, income.paymentsTimeline],
  );

  const agentCollections: ChartDatum[] = useMemo(
    () => transactionIncome?.agentCollections ?? charts.agentCollections ?? income.agentCollections ?? [],
    [transactionIncome?.agentCollections, charts.agentCollections, income.agentCollections],
  );

  const topPaidAccounts: ChartDatum[] = useMemo(
    () => transactionIncome?.topPaidAccounts ?? charts.topPaidAccounts ?? income.topPaidAccounts ?? [],
    [transactionIncome?.topPaidAccounts, charts.topPaidAccounts, income.topPaidAccounts],
  );

  const transactionRows: TransactionRow[] = useMemo(
    () => transactionIncome?.transactions ?? [],
    [transactionIncome?.transactions],
  );

  const cumulativeIncomeTimeline: ChartDatum[] = useMemo(() => {
    let runningTotal = 0;

    return paymentsTimeline.map((item) => {
      const value = asNumber(item.value);
      runningTotal += value;

      return {
        ...item,
        cumulativeValue: runningTotal,
        avgValue: asNumber(item.count) > 0 ? value / asNumber(item.count) : 0,
      };
    });
  }, [paymentsTimeline]);

  const descriptionBreakdown: ChartDatum[] = useMemo(() => {
    const grouped = new Map<string, { name: string; value: number; count: number }>();

    transactionRows.forEach((item) => {
      const name = item.description?.trim() || "No description";
      const current = grouped.get(name) ?? { name, value: 0, count: 0 };
      current.value += asNumber(item.amount);
      current.count += 1;
      grouped.set(name, current);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactionRows]);

  const transactionCountTimeline: ChartDatum[] = useMemo(
    () =>
      paymentsTimeline.map((item) => ({
        date: item.date,
        count: asNumber(item.count),
        value: asNumber(item.value),
      })),
    [paymentsTimeline],
  );

  const verifiedIncome = asNumber(transactionIncome?.verifiedIncome ?? income.verifiedIncome ?? data.collectedIncome);
  const verifiedTransactionCount = asNumber(transactionIncome?.transactionCount ?? income.transactionCount);
  const verifiedIncomeSource = transactionIncome?.source ?? income.source ?? "JournalTrans GL 1070 credits";
  const verifiedIncomeRule =
    transactionIncome?.rule ??
    income.rule ??
    "Only non-reversal GL 1070 credit transactions linked to DebtCase accounts and dated at least 30 days after DebtCase.TerminationDate are counted.";
  const verifiedIncomeNote =
    transactionIncome?.note ??
    income.note ??
    "DebtCase.PaymentReceived is intentionally excluded from verified income because it is user-marked and can be wrong.";

  const averageVerifiedTransaction =
    verifiedTransactionCount > 0 ? verifiedIncome / verifiedTransactionCount : 0;

  const largestVerifiedTransaction = transactionRows.reduce<TransactionRow | null>((largest, item) => {
    if (!largest) return item;
    return asNumber(item.amount) > asNumber(largest.amount) ? item : largest;
  }, null);

  const lastVerifiedTransaction = transactionRows[0] ?? null;

  const unverifiedValue = asNumber(income.unverifiedPaymentMarkers?.value);
  const waitingValue = asNumber(workflow.waitingValue);

  const actionBarData = [
    { name: "Invoices", count: asNumber(operationalActions.invoicesSent) },
    { name: "Final demands", count: asNumber(operationalActions.finalDemandsSent) },
    { name: "Escalations", count: asNumber(operationalActions.superiorEscalations) },
    { name: "Resolutions", count: asNumber(operationalActions.resolutionsChosen) },
    { name: "Payment markers", count: asNumber(operationalActions.paymentMarkers) },
  ];

  const valueOverview = [
    { name: "Verified income", value: verifiedIncome },
    { name: "Outstanding", value: asNumber(overview.totalOutstandingValue) },
    { name: "Waiting value", value: waitingValue },
    { name: "Unverified markers", value: unverifiedValue },
  ];

  const responseMetrics = [
    { name: "First response hrs", count: asNumber(productivity.avgFirstResponseHours) },
    { name: "Days to close", count: asNumber(productivity.avgDaysToClose) },
    { name: "Days to paid marker", count: asNumber(productivity.avgDaysToMarkedPayment) },
  ];

  const endpointState = transactionsQuery.isError
    ? "error"
    : transactionsQuery.isLoading
      ? "loading"
      : "active";

  const setQuickRange = (days: number) => {
    const now = new Date();
    setStartDate(addDays(now, -days).toISOString().split("T")[0]);
    setEndDate(todayIsoDate());
  };

  const setTransactionQuickRange = (days: number) => {
    const now = new Date();
    setTransactionStartDate(addDays(now, -days).toISOString().split("T")[0]);
    setTransactionEndDate(todayIsoDate());
  };

  const useReportRangeForTransactions = () => {
    setTransactionStartDate(startDate);
    setTransactionEndDate(endDate);
  };

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Reports"
        title="Debt collection command centre"
        description="A compact management reporting view. Transaction money is grouped into its own clickable module so operational reporting stays clean."
      />

      <section className="mb-5 rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Reporting period</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {startDate} to {endDate}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Operational stats use the report period below. Verified transaction money has its own range so older real payments do not disappear when you view 30 or 90 day activity.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex flex-col">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="startDate">
                Start
              </label>
              <input
                id="startDate"
                type="date"
                className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="endDate">
                End
              </label>
              <input
                id="endDate"
                type="date"
                className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80" onClick={() => setQuickRange(7)}>
                7 days
              </button>
              <button className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80" onClick={() => setQuickRange(30)}>
                30 days
              </button>
              <button className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80" onClick={() => setQuickRange(90)}>
                90 days
              </button>
              <button className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90" onClick={() => { setStartDate(monthStartIsoDate()); setEndDate(todayIsoDate()); }}>
                Month
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                Transaction money period
              </p>
              <h4 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                {transactionStartDate} to {transactionEndDate}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                This controls the clickable transaction block only. Default is 3 years because verified payments can happen long after case activity.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex flex-col">
                <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="transactionStartDate">
                  Tx start
                </label>
                <input
                  id="transactionStartDate"
                  type="date"
                  className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  value={transactionStartDate}
                  max={transactionEndDate}
                  onChange={(event) => setTransactionStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="transactionEndDate">
                  Tx end
                </label>
                <input
                  id="transactionEndDate"
                  type="date"
                  className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  value={transactionEndDate}
                  min={transactionStartDate}
                  onChange={(event) => setTransactionEndDate(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80" onClick={() => setTransactionQuickRange(90)}>
                  Tx 90 days
                </button>
                <button className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80" onClick={() => { setTransactionStartDate(yearsAgoIsoDate(1)); setTransactionEndDate(todayIsoDate()); }}>
                  Tx 1 year
                </button>
                <button className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700" onClick={() => { setTransactionStartDate(yearsAgoIsoDate(3)); setTransactionEndDate(todayIsoDate()); }}>
                  Tx 3 years
                </button>
                <button className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90" onClick={useReportRangeForTransactions}>
                  Use report range
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {statsQuery.isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading reporting dashboard...</p>
        </section>
      ) : statsQuery.isError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">Could not load reports.</p>
          <p className="mt-2 text-sm text-muted-foreground">Check the stats endpoint and SOAP service, then refresh.</p>
        </section>
      ) : (
        <div className="space-y-6">
          <TransactionSummaryBlock
            verifiedIncome={verifiedIncome}
            transactionCount={verifiedTransactionCount}
            averageTransaction={averageVerifiedTransaction}
            lastTransaction={lastVerifiedTransaction}
            isLoading={transactionsQuery.isLoading}
            isError={transactionsQuery.isError}
            onOpen={() => setIsTransactionViewOpen(true)}
          />

          <CommunicationSummaryBlock
            totalContactAttempts={asNumber(productivity.totalContactAttempts)}
            contactSuccessRate={asNumber(productivity.contactSuccessRate)}
            uniqueCasesContacted={asNumber(productivity.uniqueCasesContacted)}
            outboundContacts={asNumber(productivity.outboundContacts)}
            onOpen={() => setIsCommunicationViewOpen(true)}
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Outstanding book" value={formatCurrency(overview.totalOutstandingValue)} helper="All active and closed debt value" icon={Banknote} tone="primary" />
            <StatCard label="Open debtors" value={formatNumber(overview.openDebtors ?? data.openDebtors)} helper="Active unresolved cases" icon={Users} tone="primary" />
            <StatCard label="Waiting cases" value={formatNumber(data.waitingCount)} helper="7-day and 14-day waiting stages" icon={Hourglass} tone="accent" />
            <StatCard label="Contact attempts" value={formatNumber(productivity.totalContactAttempts)} helper="Within selected period" icon={PhoneCall} tone="primary" />
            <StatCard label="Contact success" value={`${formatNumber(productivity.contactSuccessRate)}%`} helper="Successful vs failed attempts" icon={CheckCircle2} tone="secondary" />
            <StatCard label="Task completion" value={`${formatNumber(productivity.taskCompletionRate)}%`} helper="Completed task events" icon={Activity} tone="accent" />
            <StatCard label="First response" value={`${formatDecimal(productivity.avgFirstResponseHours)}h`} helper="Average first contact time" icon={Clock} tone="primary" />
            <StatCard label="New cases" value={formatNumber(overview.newCasesInRange)} helper="Created in period" icon={TrendingUp} tone="secondary" />
            <StatCard label="High-value cases" value={formatNumber(overview.highValueCases)} helper="Balances above R50 000" icon={ShieldAlert} tone="accent" />
            <StatCard label="Overdue tasks" value={formatNumber(productivity.overdueTasks)} helper="Due tasks not completed" icon={AlertTriangle} tone="accent" />
            <StatCard label="Active arrangements" value={formatNumber(overview.activeArrangements)} helper="Open arrangement cases" icon={WalletCards} tone="secondary" />
            <StatCard label="Unverified markers" value={formatCurrency(unverifiedValue)} helper="User-marked payment flags only" icon={FileWarning} tone="accent" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Operational reporting</p>
                    <h3 className="text-xl font-semibold text-foreground">Activity, workload and contact performance</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  The transaction detail is grouped into the clickable money module above. The remaining report focuses on collector activity, queue health, waiting stages and case movement.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Portfolio pulse</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatusPill label="Total cases" value={formatNumber(overview.totalCases)} />
                  <StatusPill label="Closed" value={formatNumber(overview.closedCases)} />
                  <StatusPill label="Unassigned" value={formatNumber(overview.unassignedOpenCases)} />
                  <StatusPill label="Escalated" value={formatNumber(overview.escalatedOpenCases)} />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Daily contact activity" subtitle="Contact volume per day in the selected period.">
              {dailyContactTrend.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyContactTrend}>
                    <defs>
                      <linearGradient id="contactArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0e45a9" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#0e45a9" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#0e45a9" fill="url(#contactArea)" strokeWidth={3} name="Contacts" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Contact methods" subtitle="Attempt mix by channel.">
              {contactData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={contactData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                      {contactData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Contact outcomes" subtitle="Success, failure and unknown outcomes.">
              {contactOutcomeData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={contactOutcomeData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Attempts" radius={[12, 12, 0, 0]}>
                      {contactOutcomeData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Operational actions" subtitle="Invoices, final demands, escalations and resolutions.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={actionBarData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Actions" radius={[12, 12, 0, 0]} fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Workflow distribution" subtitle="Open cases by current workflow status.">
              {statusData.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={statusData} margin={{ bottom: 65 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Cases" radius={[12, 12, 0, 0]}>
                      {statusData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Workflow value distribution" subtitle="Outstanding value by workflow status.">
              {statusValueData.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={statusValueData} margin={{ bottom: 65 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Value" radius={[12, 12, 0, 0]}>
                      {statusValueData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Waiting stage breakdown" subtitle="Cases sitting in timed wait stages.">
              {waitingData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={waitingData} dataKey="count" nameKey="name" innerRadius={55} outerRadius={105} label>
                      {waitingData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Ageing buckets" subtitle="Open cases by age since termination.">
              {ageBucketData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ageBucketData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" name="Cases" fill="#0e45a9" radius={[12, 12, 0, 0]} />
                    <Bar yAxisId="right" dataKey="value" name="Value" fill="#f59e0b" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Priority mix" subtitle="Open cases by business priority.">
              {priorityData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={priorityData} dataKey="count" nameKey="name" outerRadius={105} label>
                      {priorityData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Recommended route mix" subtitle="ITC, Legal and other intended paths.">
              {pathData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pathData} dataKey="count" nameKey="name" innerRadius={45} outerRadius={105} label>
                      {pathData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Agent workload" subtitle="Open cases and outstanding value per owner.">
              {agentWorkload.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={agentWorkload} margin={{ bottom: 60 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="agent" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="openCases" name="Open cases" fill="#0e45a9" radius={[12, 12, 0, 0]} />
                    <Bar yAxisId="right" dataKey="value" name="Value" fill="#10b981" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Agent activity" subtitle="Contacts and task completions during the period.">
              {agentPerformance.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={agentPerformance} margin={{ bottom: 60 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="agent" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="contacts" name="Contacts" fill="#0e45a9" radius={[12, 12, 0, 0]} />
                    <Bar dataKey="successfulContacts" name="Successful" fill="#10b981" radius={[12, 12, 0, 0]} />
                    <Bar dataKey="completedTasks" name="Tasks" fill="#f59e0b" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Resolution outcomes" subtitle="Routes selected in the selected period.">
              {resolutionData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resolutionData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Outcomes" fill="#7c3aed" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Speed indicators" subtitle="Average first response, close and payment marker timing.">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseMetrics}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="#e91e63" strokeWidth={4} dot={{ r: 5 }} name="Speed" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Value overview" subtitle="Verified income, portfolio value and data integrity markers.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={valueOverview}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={65} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => compactMoney(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Value" radius={[12, 12, 0, 0]}>
                    {valueOverview.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold tracking-tight text-foreground">Agent performance table</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Contact output, successful contacts and completed tasks by collector.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/35">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-medium text-muted-foreground">Agent</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Contacts</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Success</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Failed</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Success rate</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.length ? agentPerformance.map((agent) => (
                    <tr key={String(agent.agent)} className="border-t border-border/70">
                      <td className="px-5 py-4 font-medium text-foreground">{agent.agent}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatNumber(agent.contacts)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatNumber(agent.successfulContacts)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatNumber(agent.failedContacts)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatNumber(agent.successRate)}%</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatNumber(agent.completedTasks)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        No agent activity found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <TransactionDetailView
            open={isTransactionViewOpen}
            onClose={() => setIsTransactionViewOpen(false)}
            transactionIncome={transactionIncome}
            paymentsTimeline={paymentsTimeline}
            cumulativeIncomeTimeline={cumulativeIncomeTimeline}
            transactionCountTimeline={transactionCountTimeline}
            agentCollections={agentCollections}
            descriptionBreakdown={descriptionBreakdown}
            topPaidAccounts={topPaidAccounts}
            transactionRows={transactionRows}
            verifiedIncome={verifiedIncome}
            verifiedTransactionCount={verifiedTransactionCount}
            averageTransaction={averageVerifiedTransaction}
            largestTransaction={largestVerifiedTransaction}
            lastTransaction={lastVerifiedTransaction}
            source={verifiedIncomeSource}
            rule={verifiedIncomeRule}
            note={verifiedIncomeNote}
            endpointState={endpointState}
          />

          <CommunicationDetailView
            open={isCommunicationViewOpen}
            onClose={() => setIsCommunicationViewOpen(false)}
            productivity={productivity}
            contactData={contactData}
            contactOutcomeData={contactOutcomeData}
            contactDirectionData={contactDirectionData}
            dailyContactTrend={dailyContactTrend}
            agentPerformance={agentPerformance}
          />
        </div>
      )}
    </DebtAppShell>
  );
}
