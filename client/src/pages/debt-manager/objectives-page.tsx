import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  Coins,
  Flame,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";

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
  CoinsEarnedLifetime?: number | string | null;
  CoinsSpentLifetime?: number | string | null;
  CurrentStreakDays?: number | string | null;
  LongestStreakDays?: number | string | null;
  ObjectivesCompleted?: number | string | null;
  LastLoginAt?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface DebtCaseRow {
  DebtCaseID: number | string;
  AccountNo: string;
  DebtorName: string;
  TotalOutstanding?: number | string | null;
  CurrentStatusName?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface LiveObjectiveTask {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progress: number;
  xpReward: number;
  shopCoinReward: number;
  completed: boolean;
  currentLabel: string;
  targetLabel: string;
  metricNote: string;
}

const LEVEL_SIZE = 100;

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

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDueWithinDays(value?: string | null, days = 7): boolean {
  const date = parseDate(value);
  if (!date) return false;

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= days;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ObjectiveCard({ task }: { task: LiveObjectiveTask }) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        task.completed
          ? "border-secondary/20 bg-secondary/[0.04]"
          : "border-border/70 bg-card"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {task.title}
            </h3>

            {task.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-[hsl(142,100%,28%)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
            ) : (
              <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                Auto-tracked
              </span>
            )}
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {task.description}
          </p>
        </div>

        <div className="shrink-0 space-y-2 text-right">
          <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            +{task.xpReward} XP
          </div>
          <div className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-[hsl(142,100%,28%)]">
            +{task.shopCoinReward} coins
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">
          {task.currentLabel} / {task.targetLabel}
        </span>
        <span className="text-muted-foreground">{task.progress}%</span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${
            task.completed
              ? "bg-[linear-gradient(90deg,hsl(142,100%,44%)_0%,hsl(190,100%,42%)_100%)]"
              : "bg-[linear-gradient(90deg,hsl(220,100%,15%)_0%,hsl(341,72%,74%)_55%,hsl(142,100%,44%)_100%)]"
          }`}
          style={{ width: `${task.progress}%` }}
        />
        {!task.completed ? (
          <div className="xp-shimmer absolute inset-y-0 w-20 rounded-full bg-white/20 blur-[1px]" />
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Completion source
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">{task.metricNote}</p>
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  const { user, isLoading: authLoading } = useAuth();

  const agentsQuery = useQuery({
    queryKey: ["debt-manager", "agents"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent[]>>("/api/debt-manager/agents"),
  });

  const casesQuery = useQuery({
    queryKey: ["debt-manager", "cases"],
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseRow[]>>("/api/debt-manager/cases"),
  });

  const agents = agentsQuery.data?.data ?? [];
  const cases = casesQuery.data?.data ?? [];

  const currentAgent = useMemo(
    () =>
      resolveCurrentAgent(
        (user as Record<string, unknown> | null | undefined) ?? null,
        agents,
      ),
    [agents, user],
  );

  const currentAgentId = currentAgent ? asNumber(currentAgent.ID, NaN) : NaN;

  const profileQuery = useQuery({
    queryKey: ["debt-manager", "agents", currentAgentId],
    enabled: Number.isFinite(currentAgentId),
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent>>(
        `/api/debt-manager/agents/${currentAgentId}`,
      ),
  });

  const profile = profileQuery.data?.data ?? currentAgent ?? null;

  const summary = useMemo(() => {
    const now = new Date();

    const ownedCases = Number.isFinite(currentAgentId)
      ? cases.filter(
          (item) => asNumber(item.CurrentOwnerAgentID, -1) === currentAgentId,
        )
      : [];

    const activeCases = ownedCases.filter((item) => !asBool(item.PaymentReceived));

    const recoveredThisMonth = ownedCases.filter((item) => {
      if (!asBool(item.PaymentReceived)) return false;
      const paymentDate = parseDate(item.PaymentReceivedAt ?? item.UpdatedAt);
      return paymentDate ? sameMonth(paymentDate, now) : false;
    });

    const recoveredThisMonthAmount = recoveredThisMonth.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const dueSoonCount = ownedCases.filter(
      (item) =>
        isDueWithinDays(item.Reminder7DueAt, 7) ||
        isDueWithinDays(item.Reminder14DueAt, 7),
    ).length;

    const escalatedCount = ownedCases.filter((item) =>
      asBool(item.EscalatedToSuperior),
    ).length;

    const touchedTodayCount = ownedCases.filter((item) => {
      const touchDate = parseDate(item.UpdatedAt ?? item.CreatedAt);
      return touchDate ? sameCalendarDay(touchDate, now) : false;
    }).length;

    const reminderStageCount = ownedCases.filter((item) => {
      const status = normalizeText(item.CurrentStatusName);
      return (
        status.includes("reminder") ||
        isDueWithinDays(item.Reminder7DueAt, 7) ||
        isDueWithinDays(item.Reminder14DueAt, 7)
      );
    }).length;

    const currentXp = asNumber(profile?.ExperiencePoints, 0);
    const currentLevel = Math.max(
      1,
      asNumber(profile?.Level, Math.floor(currentXp / LEVEL_SIZE) + 1),
    );
    const currentStreak = asNumber(profile?.CurrentStreakDays, 0);
    const shopCoins = asNumber(profile?.ShopCoins, 0);
    const lifetimeObjectivesCompleted = asNumber(profile?.ObjectivesCompleted, 0);

    const xpIntoCurrentLevel = currentXp - (currentLevel - 1) * LEVEL_SIZE;
    const xpProgress = Math.max(
      0,
      Math.min(100, Math.round((xpIntoCurrentLevel / LEVEL_SIZE) * 100)),
    );

    const liveObjectivesBase = [
      {
        id: "owned-queue",
        title: "Own your queue",
        description: "Keep a healthy active book of assigned debtor cases.",
        current: ownedCases.length,
        target: 8,
        xpReward: 20,
        shopCoinReward: 8,
        currentLabel: String(ownedCases.length),
        targetLabel: "8 cases",
        metricNote: "Counts live cases currently assigned to you.",
      },
      {
        id: "daily-touch",
        title: "Touch cases today",
        description: "Move cases forward by updating or working them today.",
        current: touchedTodayCount,
        target: 5,
        xpReward: 15,
        shopCoinReward: 5,
        currentLabel: String(touchedTodayCount),
        targetLabel: "5 touches",
        metricNote: "Based on case activity timestamps from today.",
      },
      {
        id: "reminder-control",
        title: "Control reminder-stage cases",
        description: "Keep follow-up and reminder work visible and managed.",
        current: reminderStageCount,
        target: 3,
        xpReward: 20,
        shopCoinReward: 8,
        currentLabel: String(reminderStageCount),
        targetLabel: "3 cases",
        metricNote: "Built from live reminder-stage and due-soon cases.",
      },
      {
        id: "recovery-goal",
        title: "Monthly recovery target",
        description: "Build recovered value on the cases assigned to you.",
        current: Math.round(recoveredThisMonthAmount),
        target: 25000,
        xpReward: 50,
        shopCoinReward: 20,
        currentLabel: formatCurrency(recoveredThisMonthAmount),
        targetLabel: formatCurrency(25000),
        metricNote: "Uses paid cases recorded this month from your queue.",
      },
      {
        id: "streak-goal",
        title: "Maintain your streak",
        description: "Stay active consistently through the week.",
        current: currentStreak,
        target: 7,
        xpReward: 10,
        shopCoinReward: 4,
        currentLabel: `${currentStreak} days`,
        targetLabel: "7 days",
        metricNote: "Pulled directly from your live collector streak.",
      },
      {
        id: "support-visibility",
        title: "Escalate when needed",
        description: "Keep difficult cases visible instead of letting them stall.",
        current: escalatedCount,
        target: 1,
        xpReward: 10,
        shopCoinReward: 3,
        currentLabel: String(escalatedCount),
        targetLabel: "1 escalation",
        metricNote: "Counts live cases escalated for support.",
      },
    ];

    const liveObjectives: LiveObjectiveTask[] = liveObjectivesBase.map((task) => ({
      ...task,
      completed: task.current >= task.target,
      progress: Math.max(0, Math.min(100, Math.round((task.current / task.target) * 100))),
    }));

    const completedObjectivesCount = liveObjectives.filter(
      (task) => task.completed,
    ).length;

    const possibleXpToday = liveObjectives
      .filter((task) => !task.completed)
      .reduce((sum, task) => sum + task.xpReward, 0);

    return {
      ownedCasesCount: ownedCases.length,
      activeCasesCount: activeCases.length,
      recoveredThisMonthAmount,
      dueSoonCount,
      escalatedCount,
      touchedTodayCount,
      reminderStageCount,
      currentXp,
      currentLevel,
      currentStreak,
      shopCoins,
      lifetimeObjectivesCompleted,
      xpProgress,
      xpIntoCurrentLevel,
      levelSize: LEVEL_SIZE,
      liveObjectives,
      completedObjectivesCount,
      possibleXpToday,
    };
  }, [cases, currentAgentId, profile]);

  const isLoading =
    authLoading ||
    agentsQuery.isLoading ||
    casesQuery.isLoading ||
    (Number.isFinite(currentAgentId) && profileQuery.isLoading);

  const hasError =
    agentsQuery.isError || casesQuery.isError || profileQuery.isError;

  const collectorName =
    profile?.AgentName ??
    ((user as { username?: string | null } | null)?.username ?? "Collector");

  return (
    <DebtAppShell>
      <style>{`
        @keyframes xpShimmer {
          0% { transform: translateX(-140%); opacity: 0; }
          20% { opacity: 0.65; }
          100% { transform: translateX(420%); opacity: 0; }
        }

        @keyframes xpOrbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.04); }
        }

        @keyframes statPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.16); }
          50% { box-shadow: 0 0 0 8px rgba(16,185,129,0.02); }
        }

        .xp-shimmer {
          animation: xpShimmer 3.2s linear infinite;
        }

        .xp-orb {
          animation: xpOrbFloat 2.8s ease-in-out infinite;
        }

        .stat-pulse {
          animation: statPulse 2.8s ease-in-out infinite;
        }
      `}</style>

      <DebtPageHeader
        badge="Daily objectives"
        title="Collector objectives and progression"
        description="Objectives are now fully auto-tracked from real case activity, recoveries, reminders, streaks, and escalations. No manual progress updates needed."
        actions={
          <>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Target className="mr-2 h-4 w-4" />
              {summary.completedObjectivesCount}/{summary.liveObjectives.length} complete
            </Button>

            <Button className="bg-white text-primary hover:bg-white/90">
              <Trophy className="mr-2 h-4 w-4" />
              Level {summary.currentLevel}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Loading collector objectives...
          </p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">
            Could not load the objectives workspace.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the agent and case endpoints, then refresh the page.
          </p>
        </section>
      ) : !profile ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="font-medium text-foreground">
            Could not match the logged-in user to a DebtCaseAgents profile.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure the auth user matches an agent record by id, email, or name.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_56%,hsl(142,100%,34%)_130%)] p-6 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)]">
            <div className="absolute -right-16 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-[hsl(341,72%,74%)]/20 blur-3xl" />

            <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live progression system
                </div>

                <div>
                  <p className="text-sm text-white/72">{collectorName}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Level {summary.currentLevel} collector progression
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
                    XP, streaks, reminders, recoveries, and queue movement now feed this
                    page automatically as work gets completed in the live debt workflow.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                        Experience
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {summary.currentXp} XP
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-white/50">
                        Progress
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {summary.xpProgress}%
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="h-4 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="relative h-4 rounded-full bg-[linear-gradient(90deg,hsl(45,96%,58%)_0%,hsl(341,72%,74%)_45%,hsl(142,100%,44%)_100%)] transition-all duration-700"
                        style={{ width: `${summary.xpProgress}%` }}
                      >
                        <div className="xp-shimmer absolute inset-y-0 w-24 rounded-full bg-white/25" />
                      </div>
                    </div>

                    
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/70">
                    <span>{summary.xpIntoCurrentLevel} XP into current level</span>
                    <span>{summary.levelSize - summary.xpIntoCurrentLevel} XP to next</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Streak
                    </p>
                    <p className="mt-1 text-lg font-semibold">{summary.currentStreak} days</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Shop coins
                    </p>
                    <p className="mt-1 text-lg font-semibold">{summary.shopCoins}</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Potential XP left
                    </p>
                    <p className="mt-1 text-lg font-semibold">{summary.possibleXpToday}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    Auto-tracked objectives
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Completed now
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {summary.completedObjectivesCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Lifetime completions
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {summary.lifetimeObjectivesCompleted}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        How it works
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/80">
                        Progress moves when cases are worked, reminders become due,
                        recoveries are recorded, and escalations happen in the real system.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
                    <Target className="h-4 w-4 text-[hsl(45,96%,58%)]" />
                    Live performance signals
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Cases owned
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {summary.ownedCasesCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Active cases
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {summary.activeCasesCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Touched today
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {summary.touchedTodayCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Reminders due
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {summary.dueSoonCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                XP
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.currentXp}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Live from DebtCaseAgents
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-accent" />
                Streak
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.currentStreak} days
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Current activity streak
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-secondary" />
                Active cases
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.activeCasesCount}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Owned cases still in motion
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-secondary" />
                Shop coins
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.shopCoins}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Earned from live task completion
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  Live objective board
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  These objective cards are read-only here. Progress updates automatically
                  as the related debt-collection work gets completed.
                </p>
              </div>

              <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                No manual updates
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {summary.liveObjectives.map((task) => (
                <ObjectiveCard key={task.id} task={task} />
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4 text-primary" />
                Cases touched today
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.touchedTodayCount}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Based on live case activity timestamps.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Escalations
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {summary.escalatedCount}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Difficult cases kept visible and moving.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-secondary" />
                Recovered this month
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(summary.recoveredThisMonthAmount)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pulled from paid cases in your queue this month.
              </p>
            </div>
          </section>
        </div>
      )}
    </DebtAppShell>
  );
}