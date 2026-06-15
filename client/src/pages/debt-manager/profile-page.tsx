import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  Coins,
  Crown,
  Flame,
  Mail,
  Palette,
  Phone,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserCircle2,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";
import { StatCard } from "./ui/stat-card";
import { Button } from "@/components/ui/button";

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
  AchievementsJson?: string | null;
  InventoryJson?: string | null;
  LastLoginAt?: string | null;
  IsActive?: boolean | number | string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface DebtCaseRow {
  DebtCaseID: number | string;
  AccountNo: string;
  ComplexName?: string | null;
  DebtorName: string;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  TotalOutstanding?: number | string | null;
  CurrentStatusID?: number | string | null;
  CurrentStatusName?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Priority?: string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  ResolutionType?: string | null;
  ArrangementActive?: boolean | number | string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

interface AchievementItem {
  title: string;
  description: string;
  icon: typeof Flame;
}

interface MilestoneItem {
  title: string;
  date: string;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRelativeLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "Recently";

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
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

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function tryParseAchievements(raw?: string | null): AchievementItem[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const iconCycle = [Flame, BadgeCheck, Shield, Sparkles] as const;

    return parsed
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            title: item,
            description: "Achievement unlocked",
            icon: iconCycle[index % iconCycle.length],
          };
        }

        if (item && typeof item === "object") {
          const record = item as { title?: unknown; description?: unknown };
          return {
            title:
              typeof record.title === "string" && record.title.trim()
                ? record.title
                : `Achievement ${index + 1}`,
            description:
              typeof record.description === "string" && record.description.trim()
                ? record.description
                : "Achievement unlocked",
            icon: iconCycle[index % iconCycle.length],
          };
        }

        return null;
      })
      .filter((item): item is AchievementItem => Boolean(item));
  } catch {
    return null;
  }
}

function parseInventoryCount(raw?: string | null): number {
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getThemePreviewClass(theme?: string | null, accent?: string | null) {
  const themeKey = normalizeText(theme);
  const accentKey = normalizeText(accent);

  if (themeKey.includes("gold") || accentKey.includes("gold")) {
    return "bg-[linear-gradient(135deg,hsl(220,100%,9%)_0%,hsl(40,90%,26%)_45%,hsl(45,96%,58%)_120%)]";
  }

  if (themeKey.includes("emerald") || accentKey.includes("green")) {
    return "bg-[linear-gradient(135deg,hsl(220,100%,12%)_0%,hsl(142,100%,24%)_50%,hsl(142,100%,44%)_120%)]";
  }

  if (themeKey.includes("neon") || accentKey.includes("pink")) {
    return "bg-[linear-gradient(135deg,hsl(220,100%,12%)_0%,hsl(280,85%,38%)_50%,hsl(341,72%,74%)_120%)]";
  }

  return "bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)]";
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
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
        (user as unknown as Record<string, unknown>) ?? null,
        agents,
      ),
    [agents, user],
  );

  const currentAgentId = currentAgent ? asNumber(currentAgent.ID, NaN) : NaN;

  const agentProfileQuery = useQuery({
    queryKey: ["debt-manager", "agents", currentAgentId],
    enabled: Number.isFinite(currentAgentId),
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent>>(
        `/api/debt-manager/agents/${currentAgentId}`,
      ),
  });

  const profile = agentProfileQuery.data?.data ?? currentAgent ?? null;

  const profileSummary = useMemo(() => {
    const now = new Date();
    const ownedCases = Number.isFinite(currentAgentId)
      ? cases.filter(
          (item) => asNumber(item.CurrentOwnerAgentID, -1) === currentAgentId,
        )
      : [];

    const recoveredThisMonth = ownedCases.filter((item) => {
      if (!asBool(item.PaymentReceived)) return false;
      const paymentDate = parseDate(item.PaymentReceivedAt ?? item.UpdatedAt);
      return paymentDate ? sameMonth(paymentDate, now) : false;
    });

    const recoveredThisMonthAmount = recoveredThisMonth.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const activeCases = ownedCases.filter((item) => !asBool(item.PaymentReceived));
    const reminderCases = ownedCases.filter(
      (item) =>
        normalizeText(item.CurrentStatusName).includes("reminder") ||
        parseDate(item.Reminder7DueAt) ||
        parseDate(item.Reminder14DueAt),
    );

    const escalatedCases = ownedCases.filter((item) =>
      asBool(item.EscalatedToSuperior),
    );

    const level = Math.max(1, asNumber(profile?.Level, 1));
    const currentXp = asNumber(profile?.ExperiencePoints);
    const xpTarget = level * 100;
    const xpIntoCurrentLevel = currentXp - (level - 1) * 100;
    const xpProgress = Math.max(
      0,
      Math.min(100, Math.round((xpIntoCurrentLevel / 100) * 100)),
    );

    const currentStreak = asNumber(profile?.CurrentStreakDays);
    const shopCoins = asNumber(profile?.ShopCoins);
    const objectivesCompleted = asNumber(profile?.ObjectivesCompleted);
    const inventoryCount = parseInventoryCount(profile?.InventoryJson);

    const daySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const weeklyRaw = daySeries.map((date) => {
      const activityCount = ownedCases.reduce((count, item) => {
        const activityDate = parseDate(item.UpdatedAt ?? item.CreatedAt);
        if (!activityDate) return count;
        return sameCalendarDay(activityDate, date) ? count + 1 : count;
      }, 0);

      return {
        day: new Intl.DateTimeFormat("en-ZA", { weekday: "short" }).format(date),
        raw: activityCount,
      };
    });

    const maxWeekly = Math.max(...weeklyRaw.map((item) => item.raw), 1);
    const weeklyProgress = weeklyRaw.map((item) => ({
      day: item.day,
      raw: item.raw,
      value: Math.max(14, Math.round((item.raw / maxWeekly) * 100)),
    }));

    const parsedAchievements = tryParseAchievements(profile?.AchievementsJson);
    const achievements: AchievementItem[] =
      parsedAchievements && parsedAchievements.length
        ? parsedAchievements.slice(0, 4)
        : [
            {
              title: "Recovery Streak",
              description: `${currentStreak} active days recorded`,
              icon: Flame,
            },
            {
              title: "Case Momentum",
              description: `${activeCases.length} active cases under ownership`,
              icon: BadgeCheck,
            },
            {
              title: "Queue Controller",
              description: `${reminderCases.length} reminder-stage cases managed`,
              icon: Shield,
            },
            {
              title: "Progress Builder",
              description: `${currentXp} XP and ${shopCoins} shop coins earned`,
              icon: Sparkles,
            },
          ];

    const recentMilestones: MilestoneItem[] = [
      recoveredThisMonthAmount > 0
        ? {
            title: `Recovered ${formatCurrency(recoveredThisMonthAmount)} this month`,
            date: "This month",
          }
        : {
            title: "Collector profile is now linked to live case data",
            date: "Now",
          },
      {
        title: `${objectivesCompleted} objectives completed so far`,
        date: "Current",
      },
      {
        title: `${activeCases.length} active owned cases in the live queue`,
        date: "Current",
      },
      {
        title: `${escalatedCases.length} cases escalated for support`,
        date: "Current",
      },
    ];

    return {
      ownedCases,
      recoveredThisMonthAmount,
      activeCasesCount: activeCases.length,
      reminderCasesCount: reminderCases.length,
      escalatedCasesCount: escalatedCases.length,
      level,
      currentXp,
      xpTarget,
      xpProgress,
      currentStreak,
      shopCoins,
      objectivesCompleted,
      inventoryCount,
      weeklyProgress,
      achievements,
      recentMilestones,
    };
  }, [cases, currentAgentId, profile]);

  const username =
    profile?.AgentName ??
    ((user as { username?: string | null } | null)?.username ?? "Collector");

  const email =
    profile?.Email ??
    ((user as { email?: string | null } | null)?.email ??
      "collector@proteametering.co.za");

  const phone = profile?.Phone ?? "—";
  const displayTitle = profile?.DisplayTitle ?? "Debt Collections Agent";
  const accessLevel = asNumber(profile?.AccessLevel, 1);
  const accessLabel =
    accessLevel >= 3
      ? "Admin access"
      : accessLevel === 2
        ? "Supervisor access"
        : "Collector access";

  const themePreviewClass = getThemePreviewClass(
    profile?.ProfileTheme,
    profile?.ProfileAccentColor,
  );

  const isLoading =
    authLoading ||
    agentsQuery.isLoading ||
    casesQuery.isLoading ||
    (Number.isFinite(currentAgentId) && agentProfileQuery.isLoading);

  const hasError =
    agentsQuery.isError || casesQuery.isError || agentProfileQuery.isError;

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Profile"
        title="Collector profile"
        description="A live performance hub for each collector using DebtCaseAgents and current debt case data."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setLocation("/debt-manager/objectives")}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Trophy className="mr-2 h-4 w-4" />
              Objectives
            </Button>

            <Button
              onClick={() => setLocation("/debt-manager/shop")}
              className="bg-white text-primary hover:bg-white/90"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              Open shop
            </Button>
          </>
        }
      />

      {isLoading ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading collector profile...</p>
        </section>
      ) : hasError ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <p className="font-medium text-destructive">Could not load collector profile.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the agent and case backend routes, then refresh the page.
          </p>
        </section>
      ) : !profile ? (
        <section className="rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="font-medium text-foreground">
            Could not match the logged-in user to a DebtCaseAgents profile.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure the auth user email or username matches an agent record.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)] p-6 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/10 backdrop-blur-sm">
                    <UserCircle2 className="h-12 w-12 text-white/90" />
                  </div>

                  <div className="space-y-2">
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight">{username}</h2>
                      <p className="text-sm text-white/72">{displayTitle}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
                        Level {profileSummary.level}
                      </span>
                      <span className="rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-white">
                        {accessLabel}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        Streak: {profileSummary.currentStreak} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:w-[320px] lg:grid-cols-1">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Current rank
                    </p>
                    <p className="mt-2 text-lg font-semibold">{displayTitle}</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Monthly recovery
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatCurrency(profileSummary.recoveredThisMonthAmount)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-wide text-white/55">
                      Shop coins
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {profileSummary.shopCoins}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-white/75">
                    <Trophy className="h-4 w-4 text-secondary" />
                    Collector progression
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight">
                        {profileSummary.currentXp} XP
                      </p>
                      <p className="text-xs text-white/62">
                        {Math.max(
                          0,
                          profileSummary.xpTarget - profileSummary.currentXp,
                        )}{" "}
                        XP to next level
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-white/50">
                        Progress
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {profileSummary.xpProgress}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 rounded-full bg-white/10">
                    <div
                      className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(142,100%,50%)_0%,hsl(45,96%,58%)_100%)] transition-all duration-500"
                      style={{ width: `${profileSummary.xpProgress}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
                    <Award className="h-4 w-4 text-[hsl(45,96%,58%)]" />
                    Contact details
                  </div>

                  <div className="space-y-3 text-sm text-white/82">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-white/60" />
                      <span>{email}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-white/60" />
                      <span>{phone}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-white/60" />
                      <span>{accessLabel}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-white/60" />
                      <span>Member since {formatDate(profile.CreatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <StatCard
                label="Collected this month"
                value={formatCurrency(profileSummary.recoveredThisMonthAmount)}
                helper="Live value from paid owned cases"
                icon={TrendingUp}
                tone="secondary"
              />
              <StatCard
                label="Owned active cases"
                value={String(profileSummary.activeCasesCount)}
                helper="Cases currently under this collector"
                icon={BadgeCheck}
                tone="primary"
              />
              <StatCard
                label="Current streak"
                value={`${profileSummary.currentStreak} days`}
                helper="Pulled from DebtCaseAgents"
                icon={Flame}
                tone="accent"
              />
              <StatCard
                label="Level progress"
                value={`${profileSummary.xpProgress}%`}
                helper={`${profileSummary.currentXp} / ${profileSummary.xpTarget} XP`}
                icon={Star}
                tone="primary"
              />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 p-6">
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  Weekly performance rhythm
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  A live pulse of owned case activity based on recent case updates.
                </p>
              </div>

              <div className="p-6">
                <div className="flex h-[240px] items-end gap-3">
                  {profileSummary.weeklyProgress.map((item) => (
                    <div key={item.day} className="flex flex-1 flex-col items-center gap-3">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {item.raw}
                      </span>
                      <div className="flex h-[180px] w-full items-end rounded-2xl bg-muted/45 p-1">
                        <div
                          className="w-full rounded-[18px] bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(142,100%,44%)_100%)] transition-all duration-500"
                          style={{ height: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="overflow-hidden rounded-[28px] border border-primary/10 bg-card shadow-sm">
                <div className={`relative p-6 text-white ${themePreviewClass}`}>
                  <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Collector boutique
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        Your premium loadout
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/78">
                        Themes, titles, profile cosmetics, and future collector rewards all live in the shop.
                      </p>
                    </div>

                    <Button
                      onClick={() => setLocation("/debt-manager/shop")}
                      className="bg-white text-primary hover:bg-white/90"
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Visit shop
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 p-6 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Coins className="h-4 w-4 text-secondary" />
                      Shop coins
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {profileSummary.shopCoins}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ready to spend
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="h-4 w-4 text-primary" />
                      Equipped title
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {profile?.DisplayTitle ?? "Default"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Active collector title
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Palette className="h-4 w-4 text-primary" />
                      Theme
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {profile?.ProfileTheme ?? "Core Protea"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current profile style
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-accent" />
                      Owned cosmetics
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {profileSummary.inventoryCount}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Items in your locker
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 p-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    Achievements
                  </h3>
                </div>

                <div className="grid gap-3 p-6">
                  {profileSummary.achievements.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex items-start gap-3 rounded-2xl bg-muted/35 p-4"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 p-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    Recent milestones
                  </h3>
                </div>

                <div className="space-y-3 p-6">
                  {profileSummary.recentMilestones.map((item) => (
                    <div
                      key={`${item.title}-${item.date}`}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-muted/35 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10">
                          <Target className="h-4 w-4 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {item.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 p-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    Live collector snapshot
                  </h3>
                </div>

                <div className="grid gap-3 p-6 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Assigned cases
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {profileSummary.ownedCases.length}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Reminder-stage cases
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {profileSummary.reminderCasesCount}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Escalations
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {profileSummary.escalatedCasesCount}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Last login
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatRelativeLabel(profile.LastLoginAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </DebtAppShell>
  );
}