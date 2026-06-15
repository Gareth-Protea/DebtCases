import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Brush,
  Check,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Gem,
  Lock,
  Palette,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserCircle2,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";

import FoxAvatar from "@/assets/debt-assets/Fox.png";
import OwlAvatar from "@/assets/debt-assets/Owl.png";
import PantherAvatar from "@/assets/debt-assets/Panther.png";
import WolfAvatar from "@/assets/debt-assets/Wolf.png";

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
  ProfileTheme?: string | null;
  ProfileAccentColor?: string | null;
  Bio?: string | null;
  ExperiencePoints?: number | string | null;
  Level?: number | string | null;
  ShopCoins?: number | string | null;
  CoinsEarnedLifetime?: number | string | null;
  CoinsSpentLifetime?: number | string | null;
  CurrentStreakDays?: number | string | null;
  LongestStreakDays?: number | string | null;
  ObjectivesCompleted?: number | string | null;
  InventoryJson?: string | null;
  LastLoginAt?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

type ShopCategory = "theme" | "avatar" | "title" | "badge" | "effect";
type ShopRarity = "Rare" | "Epic" | "Legendary";
interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  rarity: ShopRarity;
  price: number;
  description: string;
  note: string;
  icon: LucideIcon;
  heroClass: string;
  cardClass: string;
  accentClass: string;
  profileImage?: string;
}

interface ShopState {
  coins: number;
  ownedIds: string[];
  equippedThemeId: string | null;
  equippedAvatarId: string | null;
  equippedTitleId: string | null;
}

const LEVEL_SIZE = 100;

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "theme-midnight-vault",
    name: "Midnight Vault",
    category: "theme",
    rarity: "Rare",
    price: 65,
    description:
      "Deep navy glass panels with emerald accents and a sharp premium feel.",
    note: "Executive dark mode",
    icon: Palette,
    heroClass: "from-slate-950 via-blue-950 to-emerald-500",
    cardClass: "from-slate-200/80 via-blue-100/70 to-emerald-100/80",
    accentClass: "bg-emerald-400 text-emerald-950",
  },
  {
    id: "theme-emerald-surge",
    name: "Emerald Surge",
    category: "theme",
    rarity: "Epic",
    price: 110,
    description:
      "A bright high-energy recovery theme with rich green lighting and dark contrast.",
    note: "Momentum finish",
    icon: Sparkles,
    heroClass: "from-emerald-950 via-emerald-600 to-cyan-300",
    cardClass: "from-emerald-100/80 via-teal-100/80 to-cyan-100/80",
    accentClass: "bg-teal-400 text-teal-950",
  },
  {
    id: "theme-royal-gold",
    name: "Royal Gold",
    category: "theme",
    rarity: "Legendary",
    price: 220,
    description:
      "Black lacquer, gold glow, and polished luxury styling for top collectors.",
    note: "Top-tier prestige",
    icon: Crown,
    heroClass: "from-slate-950 via-amber-900 to-yellow-300",
    cardClass: "from-stone-200/90 via-amber-100/80 to-yellow-100/90",
    accentClass: "bg-amber-300 text-amber-950",
  },
  {
    id: "avatar-aurora-fox",
    name: "Aurora Fox",
    category: "avatar",
    rarity: "Rare",
    price: 55,
    description:
      "A clever AI fox companion with a pearlescent faceplate and aurora glow.",
    note: "AI animal profile",
    icon: Shield,
    heroClass: "from-indigo-950 via-violet-700 to-pink-300",
    cardClass: "from-violet-100/80 via-pink-100/70 to-sky-100/80",
    accentClass: "bg-pink-300 text-pink-950",
    profileImage: FoxAvatar,
  },
  {
    id: "avatar-neon-panther",
    name: "Neon Panther",
    category: "avatar",
    rarity: "Epic",
    price: 95,
    description:
      "A sleek cyber panther with neon edge treatment and a collector-grade frame.",
    note: "AI animal profile",
    icon: UserCircle2,
    heroClass: "from-slate-950 via-fuchsia-800 to-cyan-300",
    cardClass: "from-fuchsia-100/80 via-purple-100/70 to-cyan-100/80",
    accentClass: "bg-fuchsia-300 text-fuchsia-950",
    profileImage: PantherAvatar,
  },
  {
    id: "avatar-oracle-owl",
    name: "Oracle Owl",
    category: "avatar",
    rarity: "Epic",
    price: 120,
    description:
      "A wise AI owl with luminous optics, plated feathers, and a calm strategist feel.",
    note: "AI animal profile",
    icon: UserCircle2,
    heroClass: "from-blue-950 via-sky-700 to-amber-200",
    cardClass: "from-sky-100/80 via-blue-100/70 to-amber-100/80",
    accentClass: "bg-sky-300 text-sky-950",
    profileImage: OwlAvatar,
  },
  {
    id: "avatar-arctic-wolf",
    name: "Arctic Wolf",
    category: "avatar",
    rarity: "Legendary",
    price: 175,
    description:
      "A premium AI wolf avatar with chrome fur, frost particles, and alpha presence.",
    note: "AI animal profile",
    icon: UserCircle2,
    heroClass: "from-slate-950 via-cyan-800 to-white",
    cardClass: "from-cyan-100/80 via-slate-100/80 to-white/90",
    accentClass: "bg-cyan-200 text-cyan-950",
    profileImage: WolfAvatar,
  },
  {
    id: "title-executive-collector",
    name: "Executive Collector",
    category: "title",
    rarity: "Rare",
    price: 45,
    description:
      "A prestige title for collectors who want a sharper professional profile.",
    note: "Simple and polished",
    icon: BadgeCheck,
    heroClass: "from-slate-950 via-slate-700 to-slate-300",
    cardClass: "from-slate-100/90 via-zinc-100/80 to-stone-100/90",
    accentClass: "bg-slate-200 text-slate-950",
  },
  {
    id: "title-recovery-rainmaker",
    name: "Recovery Rainmaker",
    category: "title",
    rarity: "Epic",
    price: 100,
    description:
      "For collectors who consistently turn pressure into recoveries.",
    note: "Performance-led flex",
    icon: TrendingUp,
    heroClass: "from-emerald-950 via-green-700 to-lime-300",
    cardClass: "from-lime-100/80 via-emerald-100/70 to-green-100/80",
    accentClass: "bg-lime-300 text-lime-950",
  },
  {
    id: "title-vaultmaster",
    name: "Vaultmaster",
    category: "title",
    rarity: "Legendary",
    price: 180,
    description:
      "A legendary title for elite collectors with maximum presence.",
    note: "Elite collector energy",
    icon: Gem,
    heroClass: "from-slate-950 via-blue-950 to-amber-300",
    cardClass: "from-blue-100/80 via-slate-100/70 to-amber-100/90",
    accentClass: "bg-yellow-300 text-yellow-950",
  },
  {
    id: "badge-diamond-ring",
    name: "Diamond Ring",
    category: "badge",
    rarity: "Epic",
    price: 85,
    description:
      "A premium badge that signals consistency, pressure handling, and style.",
    note: "Bright premium badge",
    icon: Gem,
    heroClass: "from-slate-900 via-sky-700 to-white",
    cardClass: "from-sky-100/80 via-white/80 to-slate-100/90",
    accentClass: "bg-sky-200 text-sky-950",
  },
  {
    id: "badge-flame-streak",
    name: "Flame Streak",
    category: "badge",
    rarity: "Rare",
    price: 40,
    description:
      "A collector badge for active streaks and relentless movement.",
    note: "Daily streak energy",
    icon: Flame,
    heroClass: "from-orange-900 via-orange-500 to-yellow-300",
    cardClass: "from-orange-100/80 via-amber-100/80 to-yellow-100/90",
    accentClass: "bg-orange-300 text-orange-950",
  },
  {
    id: "effect-holo-frame",
    name: "Holo Frame",
    category: "effect",
    rarity: "Epic",
    price: 75,
    description:
      "Adds a glossy holographic edge treatment to premium profile surfaces.",
    note: "Iridescent glass edge",
    icon: Star,
    heroClass: "from-blue-950 via-cyan-600 to-fuchsia-400",
    cardClass: "from-cyan-100/80 via-purple-100/70 to-fuchsia-100/80",
    accentClass: "bg-cyan-300 text-cyan-950",
  },
  {
    id: "effect-gold-dust",
    name: "Gold Dust",
    category: "effect",
    rarity: "Legendary",
    price: 160,
    description:
      "A soft premium shimmer effect for a truly luxury profile finish.",
    note: "Subtle luxury shimmer",
    icon: Brush,
    heroClass: "from-slate-950 via-yellow-800 to-amber-200",
    cardClass: "from-yellow-100/80 via-stone-100/80 to-amber-100/90",
    accentClass: "bg-amber-300 text-amber-950",
  },
];

const CATEGORY_OPTIONS = ["all", "theme", "avatar", "title", "badge", "effect"] as const;
const RARITY_OPTIONS = ["all", "Rare", "Epic", "Legendary"] as const;

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

function parseInventoryIds(raw?: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "id" in item) {
          return String((item as { id: unknown }).id);
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

function getItemById(id?: string | null) {
  return SHOP_ITEMS.find((item) => item.id === id) ?? null;
}

function getCategoryLabel(category: ShopCategory | "all") {
  switch (category) {
    case "theme":
      return "Themes";
    case "avatar":
      return "Profile Pictures";
    case "title":
      return "Titles";
    case "badge":
      return "Badges";
    case "effect":
      return "Effects";
    default:
      return "Today";
  }
}

function getCategoryShortLabel(category: ShopCategory | "all") {
  switch (category) {
    case "theme":
      return "Theme";
    case "avatar":
      return "Profile Picture";
    case "title":
      return "Title";
    case "badge":
      return "Badge";
    case "effect":
      return "Effect";
    default:
      return "All";
  }
}

function getRarityClasses(rarity: ShopRarity) {
  switch (rarity) {
    case "Rare":
      return "bg-sky-100/85 text-sky-950 ring-sky-200/80";
    case "Epic":
      return "bg-fuchsia-100/85 text-fuchsia-950 ring-fuchsia-200/80";
    case "Legendary":
      return "bg-amber-100/90 text-amber-950 ring-amber-200/90";
    default:
      return "bg-white/80 text-slate-900 ring-white/60";
  }
}

function getCategorySurface(category: ShopCategory) {
  switch (category) {
    case "theme":
      return "border-blue-200/80 bg-blue-50/60 shadow-blue-950/10";
    case "avatar":
      return "border-fuchsia-200/80 bg-fuchsia-50/60 shadow-fuchsia-950/10";
    case "title":
      return "border-amber-200/80 bg-amber-50/65 shadow-amber-950/10";
    case "badge":
      return "border-sky-200/80 bg-sky-50/60 shadow-sky-950/10";
    case "effect":
      return "border-violet-200/80 bg-violet-50/60 shadow-violet-950/10";
    default:
      return "border-white/70 bg-white/55 shadow-slate-950/10";
  }
}

function getCategoryChip(category: ShopCategory) {
  switch (category) {
    case "theme":
      return "bg-blue-950 text-white";
    case "avatar":
      return "bg-fuchsia-950 text-white";
    case "title":
      return "bg-amber-500 text-amber-950";
    case "badge":
      return "bg-sky-600 text-white";
    case "effect":
      return "bg-violet-700 text-white";
    default:
      return "bg-slate-950 text-white";
  }
}

function isEquipable(category: ShopCategory) {
  return category === "theme" || category === "avatar" || category === "title";
}

function PriceChip({ price, compact = false }: { price: number; compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/72 shadow-sm shadow-slate-900/5 backdrop-blur-xl ${
        compact ? "px-2.5 py-1" : "px-3 py-1.5"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 shadow-inner">
        <Coins className="h-3 w-3 text-amber-950" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-slate-900">{price}</span>
    </div>
  );
}

function GlassBubble({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute rounded-full border border-white/55 bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_30px_80px_-48px_rgba(15,23,42,0.7)] backdrop-blur-3xl ${className}`}
    />
  );
}

function CategoryBadge({ category }: { category: ShopCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] shadow-sm ${getCategoryChip(
        category,
      )}`}
    >
      {getCategoryShortLabel(category)}
    </span>
  );
}

function ProfilePicturePreview({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  const isLarge = size === "large";

  return (
    <div
      className={`relative mx-auto flex items-center justify-center ${
        isLarge ? "h-64 w-64" : "h-36 w-36"
      }`}
      aria-label={`${item.name} profile picture preview`}
    >
      <div className="absolute inset-0 rounded-full bg-white/35 blur-2xl" />
      <div className="absolute inset-3 rounded-[2rem] bg-gradient-to-br from-white/70 via-white/20 to-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl" />

      {item.profileImage ? (
        <img
          src={item.profileImage}
          alt={`${item.name} profile picture`}
          className="relative h-full w-full rounded-[2rem] object-cover object-center shadow-[0_28px_70px_-38px_rgba(15,23,42,0.95)] ring-1 ring-white/70 transition duration-300 group-hover:scale-[1.025]"
          draggable={false}
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center rounded-[2rem] bg-white/55 ring-1 ring-white/70">
          <UserCircle2 className={isLarge ? "h-20 w-20 text-slate-400" : "h-12 w-12 text-slate-400"} />
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-800 shadow-sm backdrop-blur-xl">
        Profile
      </div>
    </div>
  );
}

function ThemePreview({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  const Icon = item.icon;
  const isLarge = size === "large";

  return (
    <div className={`relative ${isLarge ? "min-h-[260px]" : "min-h-[156px]"}`}>
      <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${item.heroClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_28px_65px_-36px_rgba(15,23,42,0.9)]`} />
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.55),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.26),transparent_18%),radial-gradient(circle_at_64%_82%,rgba(255,255,255,0.16),transparent_24%)]" />
      <div className="absolute inset-4 rounded-[1.35rem] border border-white/25 bg-white/10 backdrop-blur-sm" />
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-white/80" />
        <span className="h-3 w-3 rounded-full bg-white/45" />
        <span className="h-3 w-3 rounded-full bg-white/30" />
      </div>
      <div className="absolute bottom-8 left-8 right-8 space-y-2">
        <div className="h-3 w-2/3 rounded-full bg-white/70" />
        <div className="h-3 w-1/2 rounded-full bg-white/35" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <span className="h-10 rounded-xl bg-white/20" />
          <span className="h-10 rounded-xl bg-white/30" />
          <span className="h-10 rounded-xl bg-white/15" />
        </div>
      </div>
      <div className={`absolute right-6 top-6 flex items-center justify-center rounded-2xl border border-white/25 bg-white/20 text-white backdrop-blur-md ${isLarge ? "h-14 w-14" : "h-11 w-11"}`}>
        <Icon className={isLarge ? "h-7 w-7" : "h-5 w-5"} />
      </div>
    </div>
  );
}

function TitlePreview({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  const Icon = item.icon;
  const isLarge = size === "large";

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(254,243,199,0.72)_42%,rgba(255,255,255,0.78))] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_28px_65px_-42px_rgba(146,64,14,0.9)] ${isLarge ? "min-h-[260px] p-6" : "min-h-[156px] p-4"}`}>
      <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-amber-200/70 blur-3xl" />
      <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-white/80 blur-3xl" />
      <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
      <div className="absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

      <div className="relative flex h-full min-h-[inherit] flex-col items-center justify-center text-center">
        <div className={`mb-4 flex items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/20 ring-4 ring-white/65 ${isLarge ? "h-16 w-16" : "h-12 w-12"}`}>
          <Icon className={isLarge ? "h-8 w-8" : "h-6 w-6"} />
        </div>
        <div className="rounded-full border border-amber-300/70 bg-white/65 px-4 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-800 shadow-sm backdrop-blur-xl">
          Title Card
        </div>
        <p className={`mt-4 max-w-[12rem] font-black tracking-[-0.045em] text-slate-950 ${isLarge ? "text-4xl" : "text-2xl"}`}>
          {item.name}
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-700/80">
          Equipable title
        </p>
      </div>
    </div>
  );
}

function BadgePreview({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  const Icon = item.icon;
  const isLarge = size === "large";

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${item.heroClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_28px_65px_-36px_rgba(15,23,42,0.9)] ${isLarge ? "min-h-[260px] p-6" : "min-h-[156px] p-4"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.6),transparent_18%),radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.26),transparent_18%)]" />
      <div className="relative flex h-full min-h-[inherit] items-center justify-center">
        <div className={`relative flex items-center justify-center rounded-full border border-white/50 bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_26px_70px_-30px_rgba(15,23,42,0.85)] backdrop-blur-md ${isLarge ? "h-40 w-40" : "h-24 w-24"}`}>
          <div className="absolute inset-3 rounded-full border border-white/40" />
          <div className="absolute inset-7 rounded-full bg-white/15" />
          <Icon className={`relative text-white drop-shadow ${isLarge ? "h-16 w-16" : "h-10 w-10"}`} />
        </div>
      </div>
    </div>
  );
}

function EffectPreview({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  const Icon = item.icon;
  const isLarge = size === "large";

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_28px_65px_-36px_rgba(15,23,42,0.9)] ${isLarge ? "min-h-[260px] p-6" : "min-h-[156px] p-4"}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${item.heroClass} opacity-80`} />
      <div className="absolute inset-0 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(34,211,238,0.45),rgba(217,70,239,0.42),rgba(250,204,21,0.38),rgba(34,211,238,0.45))] opacity-75 blur-sm" />
      <div className="absolute inset-4 rounded-[1.45rem] border border-white/35 bg-black/20 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-2xl" />
      <div className="relative flex h-full min-h-[inherit] flex-col items-center justify-center text-center text-white">
        <div className={`flex items-center justify-center rounded-full border border-white/45 bg-white/20 shadow-[0_0_45px_rgba(255,255,255,0.28)] backdrop-blur-md ${isLarge ? "h-20 w-20" : "h-14 w-14"}`}>
          <Icon className={isLarge ? "h-9 w-9" : "h-6 w-6"} />
        </div>
        <p className={`mt-5 font-black tracking-tight ${isLarge ? "text-4xl" : "text-2xl"}`}>{item.name}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/70">Visual FX</p>
      </div>
    </div>
  );
}

function ItemVisual({ item, size = "large" }: { item: ShopItem; size?: "large" | "small" }) {
  if (item.category === "avatar") {
    return (
      <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${item.heroClass} ${size === "large" ? "min-h-[260px] p-5" : "min-h-[156px] p-3"} shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_28px_65px_-36px_rgba(15,23,42,0.9)]`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.48),transparent_18%),radial-gradient(circle_at_72%_18%,rgba(255,255,255,0.25),transparent_18%)]" />
        <div className="relative flex h-full min-h-[inherit] items-center justify-center">
          <ProfilePicturePreview item={item} size={size} />
        </div>
      </div>
    );
  }

  if (item.category === "title") return <TitlePreview item={item} size={size} />;
  if (item.category === "badge") return <BadgePreview item={item} size={size} />;
  if (item.category === "effect") return <EffectPreview item={item} size={size} />;
  return <ThemePreview item={item} size={size} />;
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.45rem] border border-white/55 bg-white/55 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-0.5 text-base font-bold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function ShopItemCard({
  item,
  owned,
  equipped,
  canAfford,
  selected,
  onPreview,
  onAction,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  selected: boolean;
  onPreview: () => void;
  onAction: () => void;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[2rem] border p-3 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.75)] backdrop-blur-3xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_95px_-52px_rgba(15,23,42,0.95)] ${getCategorySurface(
        item.category,
      )} ${selected ? "ring-2 ring-white/90" : ""}`}
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/65 blur-3xl transition duration-300 group-hover:scale-125" />
      <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.76),rgba(255,255,255,0.24)_42%,rgba(255,255,255,0.56))]" />

      <div className="relative rounded-[1.65rem] border border-white/70 bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl">
        <div className="relative">
          <ItemVisual item={item} size="small" />
          <div className="absolute left-3 top-3">
            <CategoryBadge category={item.category} />
          </div>
        </div>

        <div className="mt-4 space-y-4 px-1 pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {item.category === "avatar" ? "Collectible profile picture" : getCategoryShortLabel(item.category)}
              </p>
              <h3 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950">
                {item.name}
              </h3>
            </div>
            <PriceChip price={item.price} compact />
          </div>

          <p className="min-h-[48px] text-sm leading-6 text-slate-600">{item.description}</p>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getRarityClasses(item.rarity)}`}>
              {item.rarity}
            </span>
            {equipped ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                <Check className="h-3 w-3" /> Equipped
              </span>
            ) : owned ? (
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-white/80">
                Owned
              </span>
            ) : !canAfford ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/8 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-950/10">
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onPreview}
              className="h-11 rounded-2xl border-white/70 bg-white/55 text-slate-800 shadow-sm hover:bg-white/75"
            >
              Preview
            </Button>

            <Button
              type="button"
              onClick={onAction}
              disabled={!owned && !canAfford}
              className="h-11 rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {equipped
                ? "Equipped"
                : owned
                  ? isEquipable(item.category)
                    ? "Equip"
                    : "Owned"
                  : canAfford
                    ? "Unlock"
                    : "Locked"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ShopPage() {
  const { user, isLoading: authLoading } = useAuth();

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

  const profileQuery = useQuery({
    queryKey: ["debt-manager", "agents", currentAgentId],
    enabled: Number.isFinite(currentAgentId),
    queryFn: () =>
      apiRequest<ApiResponse<DebtCaseAgent>>(
        `/api/debt-manager/agents/${currentAgentId}`,
      ),
  });

  const profile = profileQuery.data?.data ?? currentAgent ?? null;

  const initialShopState = useMemo<ShopState>(() => {
    const ownedIds = profile ? parseInventoryIds(profile.InventoryJson) : [];

    const themeId = normalizeText(profile?.ProfileTheme)
      ? SHOP_ITEMS.find((item) => item.id === profile?.ProfileTheme)?.id ?? null
      : null;

    const avatarId = normalizeText(profile?.ProfileImageFileName)
      ? SHOP_ITEMS.find((item) => item.id === profile?.ProfileImageFileName)?.id ??
        null
      : null;

    const titleId = normalizeText(profile?.DisplayTitle)
      ? SHOP_ITEMS.find(
          (item) =>
            item.category === "title" &&
            normalizeText(item.name) === normalizeText(profile?.DisplayTitle),
        )?.id ?? null
      : null;

    const mergedOwned = Array.from(
      new Set(
        [
          ...ownedIds,
          ...(themeId ? [themeId] : []),
          ...(avatarId ? [avatarId] : []),
          ...(titleId ? [titleId] : []),
        ].filter(Boolean),
      ),
    ) as string[];

    return {
      coins: asNumber(profile?.ShopCoins, 0),
      ownedIds: mergedOwned,
      equippedThemeId: themeId,
      equippedAvatarId: avatarId,
      equippedTitleId: titleId,
    };
  }, [profile]);

  const [shopState, setShopState] = useState<ShopState>(initialShopState);
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory | "all">(
    "all",
  );
  const [selectedRarity, setSelectedRarity] = useState<ShopRarity | "all">("all");
  const [selectedItemId, setSelectedItemId] = useState<string>(SHOP_ITEMS[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setShopState(initialShopState);
  }, [initialShopState]);

  const collectorName =
    profile?.AgentName ??
    ((user as { username?: string | null } | null)?.username ?? "Collector");

  const currentXp = asNumber(profile?.ExperiencePoints, 0);
  const currentLevel = Math.max(
    1,
    asNumber(profile?.Level, Math.floor(currentXp / LEVEL_SIZE) + 1),
  );
  const currentStreak = asNumber(profile?.CurrentStreakDays, 0);
  const xpIntoCurrentLevel = currentXp - (currentLevel - 1) * LEVEL_SIZE;
  const xpProgress = Math.max(
    0,
    Math.min(100, Math.round((xpIntoCurrentLevel / LEVEL_SIZE) * 100)),
  );

  const visibleItems = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return SHOP_ITEMS.filter((item) => {
      const categoryMatch =
        selectedCategory === "all" || item.category === selectedCategory;
      const rarityMatch =
        selectedRarity === "all" || item.rarity === selectedRarity;
      const searchMatch =
        !normalizedSearch ||
        normalizeText(item.name).includes(normalizedSearch) ||
        normalizeText(item.description).includes(normalizedSearch) ||
        normalizeText(item.note).includes(normalizedSearch) ||
        normalizeText(getCategoryShortLabel(item.category)).includes(normalizedSearch);

      return categoryMatch && rarityMatch && searchMatch;
    });
  }, [selectedCategory, selectedRarity, searchTerm]);

  useEffect(() => {
    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleItems[0]?.id ?? SHOP_ITEMS[0].id);
    }
  }, [visibleItems, selectedItemId]);

  const selectedItem =
    visibleItems.find((item) => item.id === selectedItemId) ??
    SHOP_ITEMS.find((item) => item.id === selectedItemId) ??
    SHOP_ITEMS[0];

  const featuredItems = SHOP_ITEMS.filter(
    (item) => item.rarity === "Legendary" || item.rarity === "Epic",
  ).slice(0, 4);

  const ownedCount = shopState.ownedIds.length;
  const equippedTheme = getItemById(shopState.equippedThemeId);
  const equippedAvatar = getItemById(shopState.equippedAvatarId);
  const equippedTitle = getItemById(shopState.equippedTitleId);

  const isLoading =
    authLoading ||
    agentsQuery.isLoading ||
    (Number.isFinite(currentAgentId) && profileQuery.isLoading);

  const hasError = agentsQuery.isError || profileQuery.isError;

  const handleItemAction = (item: ShopItem) => {
    const alreadyOwned = shopState.ownedIds.includes(item.id);

    if (!alreadyOwned) {
      if (shopState.coins < item.price) {
        setMessage("Not enough shop coins for this unlock yet.");
        return;
      }

      setShopState((prev) => {
        const nextOwnedIds = Array.from(new Set([...prev.ownedIds, item.id]));
        const nextState: ShopState = {
          ...prev,
          coins: prev.coins - item.price,
          ownedIds: nextOwnedIds,
        };

        if (item.category === "theme") nextState.equippedThemeId = item.id;
        if (item.category === "avatar") nextState.equippedAvatarId = item.id;
        if (item.category === "title") nextState.equippedTitleId = item.id;

        return nextState;
      });

      setMessage(
        `${item.name} unlocked${isEquipable(item.category) ? " and equipped" : ""}.`,
      );
      return;
    }

    if (!isEquipable(item.category)) {
      setMessage(`${item.name} is already in your collection.`);
      return;
    }

    setShopState((prev) => {
      const nextState = { ...prev };
      if (item.category === "theme") nextState.equippedThemeId = item.id;
      if (item.category === "avatar") nextState.equippedAvatarId = item.id;
      if (item.category === "title") nextState.equippedTitleId = item.id;
      return nextState;
    });

    setMessage(`${item.name} equipped.`);
  };

  return (
    <DebtAppShell>
      <div className="relative isolate -mx-3 overflow-hidden rounded-[2.25rem] bg-[#edf0f5] px-3 py-4 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.96),transparent_20%),radial-gradient(circle_at_86%_14%,rgba(203,213,225,0.75),transparent_26%),radial-gradient(circle_at_22%_70%,rgba(186,230,253,0.45),transparent_28%),radial-gradient(circle_at_82%_76%,rgba(251,207,232,0.45),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#edf1f6_44%,#e3e8f0_100%)]" />
          <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.75)_1px,transparent_1px)] [background-size:44px_44px]" />
          <GlassBubble className="left-[7%] top-16 h-44 w-44" />
          <GlassBubble className="right-[8%] top-28 h-72 w-72" />
          <GlassBubble className="bottom-28 left-[28%] h-60 w-60" />
          <GlassBubble className="bottom-6 right-[24%] h-32 w-32" />
        </div>

        <div className="mx-auto max-w-[1500px] space-y-6">
          <DebtPageHeader
            badge="Collector shop"
            title="Shop"
            description="Browse premium themes, profile pictures, title cards, badges, and visual effects in a soft Apple-inspired collector store."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-white/70 bg-white/55 text-slate-800 shadow-sm backdrop-blur-xl hover:bg-white/75"
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Locker
                </Button>

                <Button className="rounded-full bg-slate-950 px-5 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800">
                  <Coins className="mr-2 h-4 w-4" />
                  {shopState.coins} coins
                </Button>
              </div>
            }
          />

          {isLoading ? (
            <section className="rounded-[2rem] border border-white/70 bg-white/55 p-10 text-center shadow-[0_24px_80px_-56px_rgba(15,23,42,0.7)] backdrop-blur-2xl">
              <p className="text-sm font-medium text-slate-600">Loading collector shop...</p>
            </section>
          ) : hasError ? (
            <section className="rounded-[2rem] border border-red-200/80 bg-red-50/75 p-10 text-center shadow-[0_24px_80px_-56px_rgba(15,23,42,0.7)] backdrop-blur-2xl">
              <p className="font-semibold text-red-700">Could not load the shop.</p>
              <p className="mt-2 text-sm text-red-600/80">
                Check the agent profile endpoint and refresh the page.
              </p>
            </section>
          ) : !profile ? (
            <section className="rounded-[2rem] border border-white/70 bg-white/55 p-10 text-center shadow-[0_24px_80px_-56px_rgba(15,23,42,0.7)] backdrop-blur-2xl">
              <p className="font-semibold text-slate-950">
                Could not match the logged-in user to a DebtCaseAgents profile.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Make sure the auth user matches an agent record by id, email, or name.
              </p>
            </section>
          ) : (
            <>
              <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/45 p-3 shadow-[0_34px_110px_-72px_rgba(15,23,42,0.9)] backdrop-blur-3xl">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.28)_42%,rgba(255,255,255,0.62))]" />
                <div className="absolute -left-20 top-4 h-64 w-64 rounded-full bg-sky-200/55 blur-3xl" />
                <div className="absolute -right-16 top-10 h-72 w-72 rounded-full bg-fuchsia-200/45 blur-3xl" />

                <div className="relative grid gap-3 xl:grid-cols-[1.45fr_0.75fr]">
                  <div className="rounded-[2.1rem] border border-white/70 bg-white/50 p-3 shadow-inner backdrop-blur-2xl">
                    <div className="grid gap-3 lg:grid-cols-[1fr_0.42fr]">
                      <div className="relative overflow-hidden rounded-[1.85rem] bg-gradient-to-br from-[#cdd5df] via-[#e9eef5] to-[#bfc7d3] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.82),transparent_19%),radial-gradient(circle_at_75%_16%,rgba(255,255,255,0.36),transparent_20%),radial-gradient(circle_at_72%_78%,rgba(255,255,255,0.32),transparent_24%)]" />
                        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-slate-500/10 blur-3xl" />

                        <div className="relative flex flex-col justify-between gap-8 sm:min-h-[430px]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-white/70 backdrop-blur-xl">
                                Today
                              </span>
                              <span className="rounded-full bg-white/45 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-white/60 backdrop-blur-xl">
                                {collectorName}
                              </span>
                            </div>
                            <PriceChip price={selectedItem.price} />
                          </div>

                          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                            <div className="space-y-5">
                              <div>
                                <div className="mb-4">
                                  <CategoryBadge category={selectedItem.category} />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-600/80">
                                  Explore new rewards
                                </p>
                                <h2 className="mt-3 max-w-xl text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
                                  {selectedItem.name}
                                </h2>
                                <p className="mt-4 max-w-xl text-base leading-7 text-slate-700">
                                  {selectedItem.description}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${getRarityClasses(selectedItem.rarity)}`}>
                                  {selectedItem.rarity}
                                </span>
                                <span className="rounded-full bg-white/55 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-white/60 backdrop-blur-xl">
                                  {selectedItem.category === "avatar" ? "Rendered profile picture" : selectedItem.note}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <Button
                                  type="button"
                                  onClick={() => handleItemAction(selectedItem)}
                                  disabled={
                                    !shopState.ownedIds.includes(selectedItem.id) &&
                                    shopState.coins < selectedItem.price
                                  }
                                  className="h-12 rounded-full bg-slate-950 px-6 text-white shadow-xl shadow-slate-950/18 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500"
                                >
                                  {shopState.ownedIds.includes(selectedItem.id)
                                    ? isEquipable(selectedItem.category)
                                      ? "Equip item"
                                      : "Already owned"
                                    : "Get"}
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-12 rounded-full border-white/70 bg-white/55 px-6 text-slate-800 shadow-sm backdrop-blur-xl hover:bg-white/75"
                                >
                                  Preview
                                </Button>
                              </div>
                            </div>

                            <div className="relative">
                              <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
                              <ItemVisual item={selectedItem} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {featuredItems.slice(0, 2).map((item) => {
                          const owned = shopState.ownedIds.includes(item.id);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedItemId(item.id)}
                              className={`group relative overflow-hidden rounded-[1.85rem] border p-3 text-left shadow-sm backdrop-blur-2xl transition duration-300 hover:-translate-y-1 ${getCategorySurface(
                                item.category,
                              )}`}
                            >
                              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/70 blur-3xl" />
                              <div className="relative">
                                <div className="relative">
                                  <ItemVisual item={item} size="small" />
                                  <div className="absolute left-3 top-3">
                                    <CategoryBadge category={item.category} />
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3 px-1">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                                      {owned ? "Unlocked" : `${item.price} coins`}
                                    </p>
                                  </div>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-950/15 transition group-hover:translate-x-0.5">
                                    <ChevronRight className="h-4 w-4" />
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <aside className="grid gap-3">
                    <div className="rounded-[2.1rem] border border-white/70 bg-white/55 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Wallet</p>
                          <p className="mt-1 text-4xl font-black tracking-tight text-slate-950">
                            {shopState.coins}
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-500">available coins</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 shadow-lg shadow-amber-500/20">
                          <Coins className="h-6 w-6 text-amber-950" />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>Level {currentLevel} progress</span>
                          <span>{xpProgress}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-950 via-blue-700 to-cyan-300 shadow-sm transition-all duration-500"
                            style={{ width: `${xpProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-white/65 p-3 text-center ring-1 ring-white/70">
                          <p className="text-xs font-bold text-slate-500">Level</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{currentLevel}</p>
                        </div>
                        <div className="rounded-2xl bg-white/65 p-3 text-center ring-1 ring-white/70">
                          <p className="text-xs font-bold text-slate-500">Streak</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{currentStreak}</p>
                        </div>
                        <div className="rounded-2xl bg-white/65 p-3 text-center ring-1 ring-white/70">
                          <p className="text-xs font-bold text-slate-500">Owned</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{ownedCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[2.1rem] border border-white/70 bg-white/55 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loadout</p>
                          <p className="mt-1 text-lg font-black text-slate-950">Currently equipped</p>
                        </div>
                        <Crown className="h-5 w-5 text-amber-500" />
                      </div>

                      <div className="space-y-2.5">
                        {[
                          {
                            label: "Theme",
                            value: equippedTheme?.name ?? "Core Protea theme",
                            icon: Palette,
                          },
                          {
                            label: "Profile picture",
                            value: equippedAvatar?.name ?? "Default collector avatar",
                            icon: UserCircle2,
                          },
                          {
                            label: "Title",
                            value: equippedTitle?.name ?? profile.DisplayTitle ?? "Collector",
                            icon: Trophy,
                          },
                        ].map((slot) => {
                          const Icon = slot.icon;
                          return (
                            <div
                              key={slot.label}
                              className="flex items-center gap-3 rounded-2xl bg-white/65 p-3 ring-1 ring-white/70"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                  {slot.label}
                                </p>
                                <p className="mt-0.5 truncate text-sm font-bold text-slate-950">
                                  {slot.value}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </aside>
                </div>
              </section>

              {message ? (
                <div className="rounded-[1.5rem] border border-white/70 bg-white/60 px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-2xl">
                  {message}
                </div>
              ) : null}

              <section className="grid gap-3 md:grid-cols-3">
                <StatPill icon={Sparkles} label="Premium picks" value={`${featuredItems.length} rewards`} />
                <StatPill icon={Zap} label="Collection" value={`${ownedCount} owned`} />
                <StatPill icon={Trophy} label="Progress" value={`Level ${currentLevel}`} />
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Premium showcase</p>
                    <h3 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950">
                      Featured collection
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-white/70 bg-white/55 text-slate-800 shadow-sm backdrop-blur-xl hover:bg-white/75"
                  >
                    View all
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {featuredItems.map((item) => {
                    const owned = shopState.ownedIds.includes(item.id);
                    const canAfford = shopState.coins >= item.price;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={`group relative overflow-hidden rounded-[2rem] border p-3 text-left shadow-[0_24px_70px_-50px_rgba(15,23,42,0.8)] transition duration-300 hover:-translate-y-1 ${getCategorySurface(
                          item.category,
                        )} ${selectedItemId === item.id ? "ring-2 ring-white/90" : ""}`}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(255,255,255,0.24)_46%,rgba(255,255,255,0.56))]" />
                        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/70 blur-3xl" />
                        <div className="relative">
                          <div className="relative">
                            <ItemVisual item={item} size="small" />
                            <div className="absolute left-3 top-3">
                              <CategoryBadge category={item.category} />
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 px-1 pb-1">
                            <div>
                              <p className="text-sm font-black text-slate-950">{item.name}</p>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">
                                {owned ? "Unlocked" : canAfford ? "Ready to unlock" : "Earn more coins"}
                              </p>
                            </div>
                            <PriceChip price={item.price} compact />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Catalogue</p>
                    <h3 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950">
                      Browse rewards
                    </h3>
                  </div>

                  <div className="relative w-full sm:w-[320px]">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search the shop"
                      className="h-12 w-full rounded-full border border-white/70 bg-white/55 pl-11 pr-4 text-sm font-medium text-slate-800 shadow-sm outline-none backdrop-blur-xl placeholder:text-slate-400 focus:border-white focus:bg-white/75 focus:ring-2 focus:ring-white/80"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto rounded-full border border-white/70 bg-white/45 p-1.5 shadow-sm backdrop-blur-2xl">
                  {CATEGORY_OPTIONS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                        selectedCategory === category
                          ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                      }`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {RARITY_OPTIONS.map((rarity) => (
                    <button
                      key={rarity}
                      type="button"
                      onClick={() => setSelectedRarity(rarity)}
                      className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                        selectedRarity === rarity
                          ? "bg-white text-slate-950 shadow-sm ring-1 ring-white/80"
                          : "bg-white/35 text-slate-600 ring-1 ring-white/60 hover:bg-white/65"
                      }`}
                    >
                      {rarity === "all" ? "All rarities" : rarity}
                    </button>
                  ))}
                </div>

                {visibleItems.length ? (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleItems.map((item) => {
                      const owned = shopState.ownedIds.includes(item.id);
                      const equipped =
                        (item.category === "theme" &&
                          shopState.equippedThemeId === item.id) ||
                        (item.category === "avatar" &&
                          shopState.equippedAvatarId === item.id) ||
                        (item.category === "title" &&
                          shopState.equippedTitleId === item.id);

                      return (
                        <ShopItemCard
                          key={item.id}
                          item={item}
                          owned={owned}
                          equipped={equipped}
                          canAfford={shopState.coins >= item.price}
                          selected={selectedItemId === item.id}
                          onPreview={() => setSelectedItemId(item.id)}
                          onAction={() => handleItemAction(item)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-white/70 bg-white/55 p-10 text-center shadow-sm backdrop-blur-2xl">
                    <p className="font-bold text-slate-950">No shop items found.</p>
                    <p className="mt-2 text-sm text-slate-500">Try another category, rarity, or search term.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </DebtAppShell>
  );
}
