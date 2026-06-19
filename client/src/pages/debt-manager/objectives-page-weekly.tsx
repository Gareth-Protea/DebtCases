import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  Coins,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
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
}

interface ObjectivePayload {
  profile: {
    agentId: number;
    agentName: string;
    experiencePoints: number;
    level: number;
    xpIntoLevel: number;
    xpToNext: number;
    xpProgress: number;
    levelSize: number;
    shopCoins: number;
    currentStreakDays: number;
    longestStreakDays: number;
    objectivesCompleted: number;
  };
  week: {
    weekKey: string;
    startsAt: string;
    endsAt: string;
    objectivePoolIndex: number;
  };
  awards: {
    xpAwarded: number;
    shopCoinsAwarded: number;
    completedCount: number;
    justCompletedCodes: string[];
    leveledUp: boolean;
    previousLevel: number;
    currentLevel: number;
  };
  metrics: Record<string, number>;
  objectives: LiveObjectiveTask[];
  summary: {
    completedObjectivesCount: number;
    totalObjectivesCount: number;
    possibleXpRemaining: number;
    possibleCoinsRemaining: number;
  };
}

interface LiveObjectiveTask {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: string;
  objectiveType: string;
  metricType: string;
  current: number;
  target: number;
  progress: number;
  xpReward: number;
  shopCoinReward: number;
  completed: boolean;
  xpAwarded: boolean;
  completedAt?: string | null;
  awardedAt?: string | null;
  currentLabel: string;
  targetLabel: string;
  metricNote: string;
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

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Request failed: ${response.status}`,
    );
  }

  return payload as T;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

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

function getPriorityClass(priority: string) {
  const normalized = priority.toLowerCase();

  if (normalized === "high") {
    return "bg-destructive/10 text-destructive";
  }

  if (normalized === "medium") {
    return "bg-[hsl(24,92%,56%)]/12 text-[hsl(24,82%,42%)]";
  }

  return "bg-muted text-muted-foreground";
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
                {task.xpAwarded ? "Completed + awarded" : "Completed"}
              </span>
            ) : (
              <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                Auto-tracked
              </span>
            )}

            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClass(task.priority)}`}>
              {task.priority}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {task.description}
          </p>

          <div className="mt-3 inline-flex rounded-full bg-muted/45 px-3 py-1 text-xs font-medium text-muted-foreground">
            {task.objectiveType}
          </div>
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
        <p className="mt-2 text-sm font-medium text-foreground">
          {task.metricNote}
        </p>
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [awardNotice, setAwardNotice] = useState<string | null>(null);

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

  const objectivesQuery = useQuery({
    queryKey: ["debt-manager", "objectives", currentAgentId],
    enabled: Number.isFinite(currentAgentId),
    queryFn: () =>
      apiRequest<ApiResponse<ObjectivePayload>>(
        `/api/debt-manager/objectives/${currentAgentId}`,
      ),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      apiRequest<ApiResponse<ObjectivePayload>>(
        `/api/debt-manager/objectives/${currentAgentId}/refresh`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
    onSuccess: async (response) => {
      await queryClient.setQueryData(
        ["debt-manager", "objectives", currentAgentId],
        response,
      );

      const awards = response.data.awards;
      if (awards.xpAwarded || awards.shopCoinsAwarded || awards.leveledUp) {
        setAwardNotice(
          `${awards.xpAwarded} XP and ${awards.shopCoinsAwarded} coins awarded${
            awards.leveledUp
              ? ` — level ${awards.previousLevel} → ${awards.currentLevel}`
              : ""
          }.`,
        );
      } else {
        setAwardNotice("Objectives refreshed. No new awards yet.");
      }
    },
  });

  const data = objectivesQuery.data?.data ?? null;
  const profile = data?.profile ?? null;
  const objectives = data?.objectives ?? [];
  const summary = data?.summary ?? {
    completedObjectivesCount: 0,
    totalObjectivesCount: 0,
    possibleXpRemaining: 0,
    possibleCoinsRemaining: 0,
  };

  useEffect(() => {
    const awards = data?.awards;
    if (!awards) return;

    if (awards.xpAwarded || awards.shopCoinsAwarded || awards.leveledUp) {
      setAwardNotice(
        `${awards.xpAwarded} XP and ${awards.shopCoinsAwarded} coins awarded${
          awards.leveledUp
            ? ` — level ${awards.previousLevel} → ${awards.currentLevel}`
            : ""
        }.`,
      );
    }
  }, [data?.awards]);

  const isLoading =
    authLoading ||
    agentsQuery.isLoading ||
    (Number.isFinite(currentAgentId) && objectivesQuery.isLoading);

  const hasError = agentsQuery.isError || objectivesQuery.isError;

  const collectorName =
    profile?.agentName ??
    currentAgent?.AgentName ??
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
        badge="Weekly objectives"
        title="Collector objectives and progression"
        description="Objectives now rotate weekly, award XP once, and level up from lifetime XP on the backend."
        actions={
          <>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              disabled={!data}
            >
              <Target className="mr-2 h-4 w-4" />
              {summary.completedObjectivesCount}/{summary.totalObjectivesCount} complete
            </Button>

            <Button className="bg-white text-primary hover:bg-white/90" disabled={!profile}>
              <Trophy className="mr-2 h-4 w-4" />
              Level {profile?.level ?? "—"}
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
            Check the objectives endpoint and refresh the page.
          </p>
        </section>
      ) : !currentAgent || !profile || !data ? (
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
          {awardNotice ? (
            <section className="rounded-[24px] border border-secondary/20 bg-secondary/[0.06] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-[hsl(142,100%,28%)]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Progress updated</p>
                    <p className="text-sm text-muted-foreground">{awardNotice}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                  onClick={() => setAwardNotice(null)}
                >
                  Dismiss
                </button>
              </div>
            </section>
          ) : null}

          <section className="relative overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_56%,hsl(142,100%,34%)_130%)] p-6 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)]">
            <div className="absolute -right-16 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-[hsl(341,72%,74%)]/20 blur-3xl" />

            <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  Backend progression system
                </div>

                <div>
                  <p className="text-sm text-white/72">{collectorName}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Level {profile.level} collector progression
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
                    XP is stored as lifetime XP. The backend recalculates your level from
                    total XP every time objectives refresh, so the bar cannot overflow.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                        Experience
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {profile.experiencePoints} XP
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-white/50">
                        Progress
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {profile.xpProgress}%
                      </p>
                    </div>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="relative h-4 rounded-full bg-[linear-gradient(90deg,hsl(45,96%,58%)_0%,hsl(341,72%,74%)_45%,hsl(142,100%,44%)_100%)] transition-all duration-700"
                      style={{ width: `${profile.xpProgress}%` }}
                    >
                      <div className="xp-shimmer absolute inset-y-0 w-24 rounded-full bg-white/25" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/70">
                    <span>{profile.xpIntoLevel} XP into current level</span>
                    <span>{profile.xpToNext} XP to next</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Week
                    </p>
                    <p className="mt-1 text-lg font-semibold">{data.week.weekKey}</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Streak
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {profile.currentStreakDays} days
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Shop coins
                    </p>
                    <p className="mt-1 text-lg font-semibold">{profile.shopCoins}</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      XP remaining
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {summary.possibleXpRemaining}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    Weekly objective cycle
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Completed this week
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {summary.completedObjectivesCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Active period
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {formatShortDate(data.week.startsAt)} to {formatShortDate(data.week.endsAt)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        How it works
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/80">
                        Weekly objectives are generated on the backend. Completed objectives
                        are awarded once and never repeatedly farmed.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm text-white/75">
                    <Target className="h-4 w-4 text-[hsl(45,96%,58%)]" />
                    Live performance signals
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Active cases
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {asNumber(data.metrics.OWNED_ACTIVE_CASES)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Cases touched
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {asNumber(data.metrics.WEEKLY_CASE_TOUCHES)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Communications
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {asNumber(data.metrics.WEEKLY_COMMUNICATIONS)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs uppercase tracking-wide text-white/55">
                        Recovery value
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(asNumber(data.metrics.MONTHLY_RECOVERY_VALUE))}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-white text-primary hover:bg-white/90"
                    disabled={refreshMutation.isPending}
                    onClick={() => refreshMutation.mutate()}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
                    />
                    Refresh and award progress
                  </Button>
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
                {profile.experiencePoints}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Lifetime XP from DebtCaseAgents
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-accent" />
                Streak
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {profile.currentStreakDays} days
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Current activity streak
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-secondary" />
                Objectives complete
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {profile.objectivesCompleted}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Lifetime completed objectives
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-secondary" />
                Shop coins
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {profile.shopCoins}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Earned from objective completion
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  Weekly objective board
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  These cards change by ISO week and are awarded by the backend only once.
                </p>
              </div>

              <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                Backend tracked
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {objectives.map((task) => (
                <ObjectiveCard key={task.id} task={task} />
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4 text-primary" />
                Cases touched this week
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {asNumber(data.metrics.WEEKLY_CASE_TOUCHES)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Distinct cases with your events this week.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Escalations
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {asNumber(data.metrics.WEEKLY_ESCALATIONS)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Difficult cases kept visible this week.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-secondary" />
                Recovered this month
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(asNumber(data.metrics.MONTHLY_RECOVERY_VALUE))}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Current month payment-marked value in your queue.
              </p>
            </div>
          </section>
        </div>
      )}
    </DebtAppShell>
  );
}
