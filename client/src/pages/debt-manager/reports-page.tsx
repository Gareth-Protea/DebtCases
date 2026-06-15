import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";

import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";

// API helper
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

export default function ReportsPage() {
  // Fetch summary stats from the backend. Requires admin privileges.
  const statsQuery = useQuery({
    queryKey: ["debt-manager", "stats"],
    queryFn: () => apiRequest<ApiResponse<any>>("/api/debt-manager/stats"),
  });

  const data = statsQuery.data?.data ?? {};

  // Prepare summary values with fallbacks.
  const collectedThisMonth = useMemo(() => data.collectedThisMonth ?? 0, [data]);
  const openDebtors = useMemo(() => data.openDebtors ?? 0, [data]);
  const taskCompletion = useMemo(() => data.taskCompletionRate ?? 0, [data]);
  const targetAttainment = useMemo(() => data.targetAttainment ?? 0, [data]);
  const statusCounts = useMemo<Record<string, number>>(
    () => data.statusCounts ?? {},
    [data],
  );

  // Build array for bar chart or pie chart from statusCounts. We map keys to
  // more readable labels using the same naming conventions used in the workflow boards.
  const statusData = useMemo(() => {
    const mapping: Record<string, string> = {
      UNASSIGNED: "Unassigned",
      FIRST_CONTACT: "First contact",
      REMINDER_7D: "7d reminder",
      FOLLOW_UP_7D: "Follow up 7d",
      REMINDER_14D: "14d reminder",
      RESOLUTION: "Resolution",
      ITC: "ITC",
      LEGAL: "Legal",
      ARRANGEMENT: "Arrangement",
      PAID: "Paid",
    };
    return Object.entries(statusCounts).map(([key, count]) => ({
      name: mapping[key] ?? key,
      count,
    }));
  }, [statusCounts]);

  const colors = [
    "#64748b",
    "#0e45a9",
    "#e91e63",
    "#7c3aed",
    "#f97316",
    "#0e45a9",
    "#ef4444",
    "#f59e0b",
    "#10b981",
  ];

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Reports"
        title="Debt collection analytics"
        description="Operational overview powered by live database metrics: recoveries, case workflow spread and collector productivity."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected this month"
          value={new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
            maximumFractionDigits: 0,
          }).format(collectedThisMonth)}
          helper="Total recovered since month start"
          icon={TrendingUp}
          tone="secondary"
        />
        <StatCard
          label="Open debtors"
          value={String(openDebtors)}
          helper="Cases still in active workflow"
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Task completion"
          value={`${taskCompletion}%`}
          helper="Ratio of completed tasks"
          icon={Activity}
          tone="accent"
        />
        <StatCard
          label="Target attainment"
          value={`${targetAttainment}%`}
          helper="Recovered vs outstanding"
          icon={Target}
          tone="primary"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] mt-6">
        <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Workflow distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#cbd5e1", fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#0ea5e9">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data to display</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Status pie chart
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data to display</p>
            )}
          </CardContent>
        </Card>
      </section>
    </DebtAppShell>
  );
}