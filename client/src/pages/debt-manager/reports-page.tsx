import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FileWarning,
  Hourglass,
  PhoneCall,
  ShieldAlert,
  TrendingUp,
  Users,
  WalletCards,
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
  count?: number;
  value?: number;
  openCases?: number;
  contacts?: number;
  successfulContacts?: number;
  failedContacts?: number;
  completedTasks?: number;
  successRate?: number;
  agent?: string;
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

function formatCurrency(value: unknown) {
  return currency.format(Number(value ?? 0));
}

function formatNumber(value: unknown) {
  return numberFmt.format(Number(value ?? 0));
}

function formatDecimal(value: unknown, digits = 1) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

function compactMoney(value: unknown) {
  return `R${compact.format(Number(value ?? 0))}`;
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function StatusPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
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

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
      No data to display for this period.
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((item: any, index: number) => (
        <p key={index} className="text-muted-foreground">
          <span className="font-medium text-foreground">{item.name}: </span>
          {typeof item.value === "number" && /value|income|outstanding/i.test(item.dataKey)
            ? formatCurrency(item.value)
            : formatNumber(item.value)}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStartIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());

  const statsQuery = useQuery({
    queryKey: ["debt-manager", "stats", startDate, endDate],
    queryFn: () =>
      apiRequest<ApiResponse<any>>(
        `/api/debt-manager/stats?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
      ),
  });

  const data = statsQuery.data?.data ?? {};
  const overview = data.overview ?? {};
  const productivity = data.productivity ?? {};
  const operationalActions = data.operationalActions ?? {};
  const income = data.income ?? {};
  const charts = data.charts ?? {};
  const workflow = data.workflow ?? {};

  const statusData: ChartDatum[] = useMemo(() => charts.statusDistribution ?? [], [charts.statusDistribution]);
  const statusValueData: ChartDatum[] = useMemo(() => charts.statusValueDistribution ?? [], [charts.statusValueDistribution]);
  const waitingData: ChartDatum[] = useMemo(() => charts.waitingBreakdown ?? [], [charts.waitingBreakdown]);
  const contactData: ChartDatum[] = useMemo(() => charts.contactAttemptsByType ?? [], [charts.contactAttemptsByType]);
  const contactOutcomeData: ChartDatum[] = useMemo(() => charts.contactOutcomes ?? [], [charts.contactOutcomes]);
  const dailyContactTrend: ChartDatum[] = useMemo(() => charts.dailyContactTrend ?? [], [charts.dailyContactTrend]);
  const priorityData: ChartDatum[] = useMemo(() => charts.priorityDistribution ?? [], [charts.priorityDistribution]);
  const pathData: ChartDatum[] = useMemo(() => charts.recommendedPathDistribution ?? [], [charts.recommendedPathDistribution]);
  const ageBucketData: ChartDatum[] = useMemo(() => charts.ageBuckets ?? [], [charts.ageBuckets]);
  const resolutionData: ChartDatum[] = useMemo(() => charts.resolutionDistribution ?? [], [charts.resolutionDistribution]);
  const agentWorkload: ChartDatum[] = useMemo(() => charts.agentWorkload ?? [], [charts.agentWorkload]);
  const agentPerformance: ChartDatum[] = useMemo(() => charts.agentPerformance ?? [], [charts.agentPerformance]);

  const verifiedIncome = Number(income.verifiedIncome ?? data.collectedIncome ?? 0);
  const unverifiedValue = Number(income.unverifiedPaymentMarkers?.value ?? 0);
  const waitingValue = Number(workflow.waitingValue ?? 0);

  const actionBarData = [
    { name: "Invoices", count: Number(operationalActions.invoicesSent ?? 0) },
    { name: "Final demands", count: Number(operationalActions.finalDemandsSent ?? 0) },
    { name: "Escalations", count: Number(operationalActions.superiorEscalations ?? 0) },
    { name: "Resolutions", count: Number(operationalActions.resolutionsChosen ?? 0) },
    { name: "Payment markers", count: Number(operationalActions.paymentMarkers ?? 0) },
  ];

  const valueOverview = [
    { name: "Verified income", value: verifiedIncome },
    { name: "Outstanding", value: Number(overview.totalOutstandingValue ?? 0) },
    { name: "Waiting value", value: waitingValue },
    { name: "Unverified markers", value: unverifiedValue },
  ];

  const responseMetrics = [
    { name: "First response hrs", count: Number(productivity.avgFirstResponseHours ?? 0) },
    { name: "Days to close", count: Number(productivity.avgDaysToClose ?? 0) },
    { name: "Days to paid marker", count: Number(productivity.avgDaysToMarkedPayment ?? 0) },
  ];

  const setQuickRange = (days: number) => {
    const now = new Date();
    setStartDate(addDays(now, -days).toISOString().split("T")[0]);
    setEndDate(todayIsoDate());
  };

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Reports"
        title="Debt collection command centre"
        description="A dense operational reporting view for management: workload, contact activity, waiting stages, response speed, agent output and recovery integrity."
      />

      <section className="mb-5 rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Reporting period</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {startDate} to {endDate}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Income is intentionally separated from user-marked payment flags. Verified income will activate once the company transaction query is wired in.
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
      </section>

      {statsQuery.isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading premium reporting dashboard...</p>
        </section>
      ) : statsQuery.isError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">Could not load reports.</p>
          <p className="mt-2 text-sm text-muted-foreground">Check the stats endpoint and SOAP service, then refresh.</p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Verified income" value={formatCurrency(verifiedIncome)} helper="From transaction query when connected" icon={DollarSign} tone="secondary" />
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
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <FileWarning className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Income integrity status</p>
                    <h3 className="text-xl font-semibold text-foreground">Verified income source pending</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {income.note ?? "Verified income will be calculated from the company transaction query once supplied."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatusPill label="Source" value={income.source ?? "Pending"} />
                  <StatusPill label="Transactions" value={formatNumber(income.transactionCount)} />
                  <StatusPill label="Unverified markers" value={formatCurrency(unverifiedValue)} />
                </div>
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
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No agent activity found.</td></tr>
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
