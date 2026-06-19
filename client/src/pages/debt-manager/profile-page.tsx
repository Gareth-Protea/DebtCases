import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Crown,
  Flame,
  Gauge,
  Gem,
  Layers3,
  Mail,
  Medal,
  Palette,
  Phone,
  Radio,
  Rocket,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserCircle2,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  icon: LucideIcon;
}

interface MilestoneItem {
  title: string;
  date: string;
  icon: LucideIcon;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(value);
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

function getInitials(name?: string | null): string {
  const parts = (name ?? "Collector")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.length) return "C";
  return parts
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
}

function getAccessLabel(accessLevel: number): string {
  if (accessLevel >= 3) return "Admin access";
  if (accessLevel === 2) return "Supervisor access";
  return "Collector access";
}

function getRankTitle(level: number): string {
  if (level >= 25) return "Legendary Collector";
  if (level >= 15) return "Senior Recovery Specialist";
  if (level >= 10) return "Elite Collector";
  if (level >= 5) return "Case Controller";
  return "Debt Collections Agent";
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

function parseInventoryCount(raw?: string | null): number {
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function tryParseAchievements(raw?: string | null): AchievementItem[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const iconCycle = [Flame, BadgeCheck, Shield, Sparkles, Trophy, Star] as const;

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

function getThemePreviewClass(theme?: string | null, accent?: string | null) {
  const themeKey = normalizeText(theme);
  const accentKey = normalizeText(accent);

  if (themeKey.includes("gold") || accentKey.includes("gold")) {
    return "bg-[radial-gradient(circle_at_10%_10%,rgba(250,204,21,0.35),transparent_28%),linear-gradient(135deg,hsl(220,100%,9%)_0%,hsl(40,90%,26%)_48%,hsl(45,96%,58%)_135%)]";
  }

  if (themeKey.includes("emerald") || accentKey.includes("green")) {
    return "bg-[radial-gradient(circle_at_18%_18%,rgba(0,224,104,0.32),transparent_30%),linear-gradient(135deg,hsl(220,100%,12%)_0%,hsl(142,100%,23%)_55%,hsl(142,100%,44%)_130%)]";
  }

  if (themeKey.includes("neon") || accentKey.includes("pink")) {
    return "bg-[radial-gradient(circle_at_20%_20%,rgba(233,30,99,0.30),transparent_30%),linear-gradient(135deg,hsl(220,100%,12%)_0%,hsl(280,85%,38%)_50%,hsl(341,72%,74%)_130%)]";
  }

  return "bg-[radial-gradient(circle_at_18%_18%,rgba(0,224,104,0.25),transparent_30%),linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)]";
}

function ProfileKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "accent" | "gold";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary border-primary/15",
    secondary: "bg-secondary/10 text-[hsl(142,100%,26%)] border-secondary/20",
    accent: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
    gold: "bg-[hsl(45,96%,58%)]/16 text-[hsl(38,92%,34%)] border-[hsl(45,96%,58%)]/30",
  } as const;

  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-border/70 bg-card p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,hsl(220,100%,15%),hsl(142,100%,44%))]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{helper}</p>
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function GlassMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/55">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function SectionPanel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 p-6">
        <div>
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative h-28 w-28">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="9"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#profileProgress)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="profileProgress" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(142,100%,50%)" />
            <stop offset="100%" stopColor="hsl(45,96%,58%)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-semibold tracking-tight">{safe}%</span>
        <span className="text-[10px] uppercase tracking-wide text-white/55">XP</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeText(status);
  const style = normalized.includes("legal")
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : normalized.includes("paid")
      ? "bg-secondary/10 text-[hsl(142,100%,25%)] border-secondary/20"
      : normalized.includes("reminder") || normalized.includes("wait")
        ? "bg-[hsl(24,92%,56%)]/12 text-[hsl(24,82%,42%)] border-[hsl(24,92%,56%)]/20"
        : "bg-primary/8 text-primary border-primary/15";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
      {status || "Open"}
    </span>
  );
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

  const username =
    profile?.AgentName ??
    ((user as { username?: string | null } | null)?.username ?? "Collector");

  const email =
    profile?.Email ??
    ((user as { email?: string | null } | null)?.email ??
      "collector@proteametering.co.za");

  const profileSummary = useMemo(() => {
    const now = new Date();
    const ownedCases = Number.isFinite(currentAgentId)
      ? cases.filter(
          (item) => asNumber(item.CurrentOwnerAgentID, -1) === currentAgentId,
        )
      : [];

    const paidMarkersThisMonth = ownedCases.filter((item) => {
      if (!asBool(item.PaymentReceived)) return false;
      const paymentDate = parseDate(item.PaymentReceivedAt ?? item.UpdatedAt);
      return paymentDate ? sameMonth(paymentDate, now) : false;
    });

    const markedRecoveredThisMonthAmount = paidMarkersThisMonth.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const activeCases = ownedCases.filter((item) => !asBool(item.PaymentReceived));
    const reminderCases = ownedCases.filter(
      (item) =>
        normalizeText(item.CurrentStatusName).includes("reminder") ||
        normalizeText(item.CurrentStatusName).includes("wait") ||
        parseDate(item.Reminder7DueAt) ||
        parseDate(item.Reminder14DueAt),
    );

    const escalatedCases = ownedCases.filter((item) => asBool(item.EscalatedToSuperior));
    const arrangementCases = ownedCases.filter((item) => asBool(item.ArrangementActive));
    const highPriorityCases = ownedCases.filter((item) => normalizeText(item.Priority) === "high");
    const totalOutstanding = activeCases.reduce(
      (sum, item) => sum + asNumber(item.TotalOutstanding),
      0,
    );

    const level = Math.max(1, asNumber(profile?.Level, 1));
    const currentXp = Math.max(0, asNumber(profile?.ExperiencePoints));
    const xpTarget = level * 100;
    const xpIntoCurrentLevel = currentXp - (level - 1) * 100;
    const xpProgress = Math.max(
      0,
      Math.min(100, Math.round((xpIntoCurrentLevel / 100) * 100)),
    );

    const currentStreak = asNumber(profile?.CurrentStreakDays);
    const longestStreak = asNumber(profile?.LongestStreakDays);
    const shopCoins = asNumber(profile?.ShopCoins);
    const coinsEarnedLifetime = asNumber(profile?.CoinsEarnedLifetime);
    const coinsSpentLifetime = asNumber(profile?.CoinsSpentLifetime);
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
      value: Math.max(10, Math.round((item.raw / maxWeekly) * 100)),
    }));

    const statusMap = new Map<string, { count: number; value: number }>();
    for (const item of activeCases) {
      const status = item.CurrentStatusName || "Open";
      const current = statusMap.get(status) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += asNumber(item.TotalOutstanding);
      statusMap.set(status, current);
    }

    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, item]) => ({ status, ...item }))
      .sort((a, b) => b.count - a.count);

    const topCases = activeCases
      .slice()
      .sort((a, b) => asNumber(b.TotalOutstanding) - asNumber(a.TotalOutstanding))
      .slice(0, 5);

    const parsedAchievements = tryParseAchievements(profile?.AchievementsJson);
    const achievements: AchievementItem[] =
      parsedAchievements && parsedAchievements.length
        ? parsedAchievements.slice(0, 6)
        : [
            {
              title: "Recovery Streak",
              description: `${currentStreak} active day${currentStreak === 1 ? "" : "s"} recorded`,
              icon: Flame,
            },
            {
              title: "Case Controller",
              description: `${activeCases.length} active case${activeCases.length === 1 ? "" : "s"} under ownership`,
              icon: BadgeCheck,
            },
            {
              title: "Queue Specialist",
              description: `${reminderCases.length} waiting or reminder-stage case${reminderCases.length === 1 ? "" : "s"} managed`,
              icon: Shield,
            },
            {
              title: "Progress Builder",
              description: `${formatNumber(currentXp)} XP and ${formatNumber(shopCoins)} shop coins available`,
              icon: Sparkles,
            },
            {
              title: "Objective Hunter",
              description: `${formatNumber(objectivesCompleted)} objectives completed`,
              icon: Target,
            },
            {
              title: "Premium Locker",
              description: `${formatNumber(inventoryCount)} cosmetic item${inventoryCount === 1 ? "" : "s"} owned`,
              icon: Gem,
            },
          ];

    const recentMilestones: MilestoneItem[] = [
      markedRecoveredThisMonthAmount > 0
        ? {
            title: `${formatCurrency(markedRecoveredThisMonthAmount)} marked recovered this month`,
            date: "This month",
            icon: TrendingUp,
          }
        : {
            title: "Collector profile is linked to live debt case data",
            date: "Now",
            icon: Radio,
          },
      {
        title: `${formatNumber(objectivesCompleted)} objectives completed so far`,
        date: "Current",
        icon: Target,
      },
      {
        title: `${formatNumber(activeCases.length)} active owned cases in the live queue`,
        date: "Current",
        icon: BriefcaseBusiness,
      },
      {
        title: `${formatNumber(escalatedCases.length)} cases escalated for support`,
        date: "Current",
        icon: Shield,
      },
    ];

    return {
      ownedCases,
      activeCases,
      activeCasesCount: activeCases.length,
      reminderCasesCount: reminderCases.length,
      escalatedCasesCount: escalatedCases.length,
      arrangementCasesCount: arrangementCases.length,
      highPriorityCasesCount: highPriorityCases.length,
      totalOutstanding,
      markedRecoveredThisMonthAmount,
      paidMarkersThisMonthCount: paidMarkersThisMonth.length,
      level,
      currentXp,
      xpTarget,
      xpProgress,
      currentStreak,
      longestStreak,
      shopCoins,
      coinsEarnedLifetime,
      coinsSpentLifetime,
      objectivesCompleted,
      inventoryCount,
      weeklyProgress,
      statusBreakdown,
      topCases,
      achievements,
      recentMilestones,
    };
  }, [cases, currentAgentId, profile]);

  const phone = profile?.Phone ?? "—";
  const displayTitle = profile?.DisplayTitle ?? getRankTitle(profileSummary.level);
  const accessLevel = asNumber(profile?.AccessLevel, 1);
  const accessLabel = getAccessLabel(accessLevel);
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
        description="A premium performance hub for collectors, rewards, workload, and live debt case activity."
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
        <section className="rounded-[28px] border border-border/70 bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary/10" />
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
        <div className="space-y-6">
          <section className={`relative overflow-hidden rounded-[34px] border border-primary/10 p-6 text-white shadow-[0_30px_80px_-36px_rgba(8,38,84,0.65)] ${themePreviewClass}`}>
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 left-20 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />

            <div className="relative grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                  <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-[32px] border border-white/15 bg-white/12 text-4xl font-semibold tracking-tight text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.75)] backdrop-blur-md">
                    <div className="absolute inset-0 rounded-[32px] bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.03))]" />
                    <span className="relative">{getInitials(username)}</span>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                      <Sparkles className="h-3.5 w-3.5 text-[hsl(45,96%,68%)]" />
                      Collector command profile
                    </div>

                    <div>
                      <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
                        {username}
                      </h2>
                      <p className="mt-2 text-base text-white/72">{displayTitle}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/90">
                        Level {profileSummary.level}
                      </span>
                      <span className="rounded-full bg-secondary/18 px-3 py-1 text-xs font-semibold text-white">
                        {accessLabel}
                      </span>
                      <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/85">
                        {profileSummary.currentStreak} day streak
                      </span>
                      <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/85">
                        {asBool(profile.IsActive) ? "Active profile" : "Profile loaded"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <GlassMetric
                    label="Marked recovery"
                    value={formatCurrency(profileSummary.markedRecoveredThisMonthAmount)}
                    icon={TrendingUp}
                  />
                  <GlassMetric
                    label="Active exposure"
                    value={formatCurrency(profileSummary.totalOutstanding)}
                    icon={WalletCards}
                  />
                  <GlassMetric
                    label="Shop balance"
                    value={`${formatNumber(profileSummary.shopCoins)} coins`}
                    icon={Coins}
                  />
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Bio</p>
                      <p className="text-xs text-white/55">Collector profile summary</p>
                    </div>
                    <BadgeCheck className="h-5 w-5 text-secondary" />
                  </div>
                  <p className="text-sm leading-6 text-white/76">
                    {profile.Bio ||
                      "Focused on clean follow-up, debtor communication, and keeping the collection queue moving with accurate case notes."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto] xl:grid-cols-1">
                <div className="rounded-[30px] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-5">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                        <Rocket className="h-3.5 w-3.5" />
                        Next level progress
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">
                        {formatNumber(profileSummary.currentXp)} XP
                      </p>
                      <p className="mt-1 text-sm text-white/62">
                        {formatNumber(Math.max(0, profileSummary.xpTarget - profileSummary.currentXp))} XP to next level
                      </p>
                    </div>
                    <ProgressRing value={profileSummary.xpProgress} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                  <GlassMetric
                    label="Current streak"
                    value={`${profileSummary.currentStreak} days`}
                    icon={Flame}
                  />
                  <GlassMetric
                    label="Best streak"
                    value={`${profileSummary.longestStreak} days`}
                    icon={Medal}
                  />
                  <GlassMetric
                    label="Objectives"
                    value={formatNumber(profileSummary.objectivesCompleted)}
                    icon={Target}
                  />
                  <GlassMetric
                    label="Locker items"
                    value={formatNumber(profileSummary.inventoryCount)}
                    icon={Gem}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProfileKpi
              label="Owned active cases"
              value={formatNumber(profileSummary.activeCasesCount)}
              helper="Cases currently under this collector"
              icon={BriefcaseBusiness}
              tone="primary"
            />
            <ProfileKpi
              label="Waiting cases"
              value={formatNumber(profileSummary.reminderCasesCount)}
              helper="Reminder or waiting-stage items"
              icon={Clock3}
              tone="gold"
            />
            <ProfileKpi
              label="Escalations"
              value={formatNumber(profileSummary.escalatedCasesCount)}
              helper="Cases requiring superior support"
              icon={Shield}
              tone="accent"
            />
            <ProfileKpi
              label="Level progress"
              value={`${profileSummary.xpProgress}%`}
              helper={`${formatNumber(profileSummary.currentXp)} / ${formatNumber(profileSummary.xpTarget)} XP`}
              icon={Gauge}
              tone="secondary"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionPanel
              title="Weekly performance rhythm"
              subtitle="A compact activity pulse based on case updates owned by this collector."
              icon={TrendingUp}
            >
              <div className="flex h-[260px] items-end gap-3">
                {profileSummary.weeklyProgress.map((item) => (
                  <div key={item.day} className="flex flex-1 flex-col items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {item.raw}
                    </span>
                    <div className="flex h-[190px] w-full items-end rounded-2xl bg-muted/45 p-1.5">
                      <div
                        className="w-full rounded-[18px] bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(142,100%,44%)_100%)] shadow-[0_16px_40px_-24px_rgba(8,38,84,0.8)] transition-all duration-500"
                        style={{ height: `${item.value}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </SectionPanel>

            <SectionPanel
              title="Contact card"
              subtitle="Quick identity, access, and profile metadata."
              icon={UserCircle2}
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                      <p className="truncate text-sm font-semibold text-foreground">{email}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                      <p className="text-sm font-semibold text-foreground">{phone}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat
                    label="Access"
                    value={accessLabel}
                    helper={`Level ${accessLevel}`}
                    icon={Shield}
                  />
                  <MiniStat
                    label="Member since"
                    value={formatDate(profile.CreatedAt)}
                    helper={`Last login ${formatRelativeLabel(profile.LastLoginAt)}`}
                    icon={CalendarDays}
                  />
                </div>
              </div>
            </SectionPanel>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <SectionPanel
                title="Collector boutique"
                subtitle="Coins, themes, titles, and cosmetics from the collector shop."
                icon={ShoppingBag}
              >
                <div className={`mb-4 overflow-hidden rounded-[24px] p-5 text-white ${themePreviewClass}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/85">
                        <Crown className="h-3.5 w-3.5" />
                        Equipped style
                      </div>
                      <h4 className="text-2xl font-semibold tracking-tight">
                        {profile.ProfileTheme ?? "Core Protea"}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-white/72">
                        {profile.ProfileAccentColor
                          ? `Accent: ${profile.ProfileAccentColor}`
                          : "Default Protea command theme"}
                      </p>
                    </div>
                    <Button
                      onClick={() => setLocation("/debt-manager/shop")}
                      className="bg-white text-primary hover:bg-white/90"
                    >
                      Shop
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat
                    label="Available coins"
                    value={formatNumber(profileSummary.shopCoins)}
                    helper="Ready to spend"
                    icon={Coins}
                  />
                  <MiniStat
                    label="Lifetime earned"
                    value={formatNumber(profileSummary.coinsEarnedLifetime)}
                    helper={`${formatNumber(profileSummary.coinsSpentLifetime)} spent`}
                    icon={WalletCards}
                  />
                  <MiniStat
                    label="Equipped title"
                    value={profile.DisplayTitle ?? "Default"}
                    helper="Current display title"
                    icon={Crown}
                  />
                  <MiniStat
                    label="Locker"
                    value={formatNumber(profileSummary.inventoryCount)}
                    helper="Owned cosmetics"
                    icon={Palette}
                  />
                </div>
              </SectionPanel>

              <SectionPanel
                title="Achievements"
                subtitle="Unlocked or generated achievements based on live profile progress."
                icon={Award}
              >
                <div className="grid gap-3">
                  {profileSummary.achievements.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4 transition hover:border-primary/20 hover:bg-primary/[0.03]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionPanel>
            </div>

            <div className="space-y-6">
              <SectionPanel
                title="Live workload snapshot"
                subtitle="Current collector workload and exposure by workflow state."
                icon={Layers3}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat
                    label="Assigned"
                    value={formatNumber(profileSummary.ownedCases.length)}
                    helper="Total linked cases"
                    icon={BriefcaseBusiness}
                  />
                  <MiniStat
                    label="Active"
                    value={formatNumber(profileSummary.activeCasesCount)}
                    helper="Not marked paid"
                    icon={Radio}
                  />
                  <MiniStat
                    label="Arrangements"
                    value={formatNumber(profileSummary.arrangementCasesCount)}
                    helper="Active arrangements"
                    icon={CheckCircle2}
                  />
                  <MiniStat
                    label="High priority"
                    value={formatNumber(profileSummary.highPriorityCasesCount)}
                    helper="Priority queue"
                    icon={Flame}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {profileSummary.statusBreakdown.length ? (
                    profileSummary.statusBreakdown.slice(0, 6).map((item) => {
                      const percent = profileSummary.activeCasesCount
                        ? Math.round((item.count / profileSummary.activeCasesCount) * 100)
                        : 0;

                      return (
                        <div key={item.status} className="rounded-2xl border border-border/60 bg-background p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <StatusPill status={item.status} />
                            <div className="text-right">
                              <p className="text-sm font-semibold text-foreground">
                                {formatNumber(item.count)} cases
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(item.value)}
                              </p>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-[linear-gradient(90deg,hsl(220,100%,15%),hsl(142,100%,44%))]"
                              style={{ width: `${Math.max(6, percent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      No active workload breakdown yet.
                    </div>
                  )}
                </div>
              </SectionPanel>

              <SectionPanel
                title="Top active cases"
                subtitle="Largest active balances currently owned by this collector."
                icon={Target}
              >
                {profileSummary.topCases.length ? (
                  <div className="overflow-hidden rounded-2xl border border-border/70">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/45 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Debtor</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {profileSummary.topCases.map((item) => (
                          <tr key={String(item.DebtCaseID)} className="bg-card">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-foreground">{item.DebtorName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.AccountNo} • {item.ComplexName ?? "No complex"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={item.CurrentStatusName ?? "Open"} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-foreground">
                              {formatCurrency(asNumber(item.TotalOutstanding))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    No active cases are currently assigned to this profile.
                  </div>
                )}
              </SectionPanel>

              <SectionPanel
                title="Recent milestones"
                subtitle="A quick audit trail of current progress markers."
                icon={Medal}
              >
                <div className="space-y-3">
                  {profileSummary.recentMilestones.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={`${item.title}-${item.date}`}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-muted/25 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-[hsl(142,100%,28%)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="font-medium leading-6 text-foreground">{item.title}</p>
                        </div>

                        <span className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                          {item.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionPanel>
            </div>
          </section>
        </div>
      )}
    </DebtAppShell>
  );
}
