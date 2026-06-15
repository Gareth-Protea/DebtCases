import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  Trophy,
  UserCircle2,
  Settings,
} from "lucide-react";
import { useLocation } from "wouter";
import mainLogo from "@assets/White Logo.png";
import { Button } from "@/components/ui/button";

interface DebtSidebarProps {
  username: string;
  onLogout: () => void | Promise<void>;
}

const navItems = [
  {
    label: "Action Page",
    description: "Daily workspace",
    href: "/debt-manager",
    icon: Sparkles,
  },
  {
    label: "Master List",
    description: "All debtors",
    href: "/debt-manager/master-list",
    icon: FileSpreadsheet,
  },
  {
    label: "Agent List",
    description: "My assigned debtors",
    href: "/debt-manager/agent-list",
    icon: ClipboardList,
  },
  {
    label: "Reports",
    description: "Targets and analytics",
    href: "/debt-manager/reports",
    icon: BarChart3,
  },
  {
    label: "Objectives",
    description: "XP, levels and daily quests",
    href: "/debt-manager/objectives",
    icon: Trophy,
  },
  {
    label: "Settings",
    description: "Manager limits & import",
    href: "/debt-manager/manager-settings",
    icon: Settings,
  },
];

export function DebtSidebar({ username, onLogout }: DebtSidebarProps) {
  const [location, setLocation] = useLocation();

  const isActive = (href: string) => {
    if (href === "/debt-manager") {
      return location === "/debt-manager";
    }

    return location.startsWith(href);
  };

  const isProfileActive = location.startsWith("/debt-manager/profile");

  return (
    <aside className="sticky top-0 hidden h-screen w-[290px] shrink-0 bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(220,100%,17%)_100%)] text-white lg:flex lg:flex-col">
      <div className="flex h-full flex-col px-5 py-6">
        <div className="mb-8 px-2">
          <img src={mainLogo} alt="Protea Metering" className="h-9 w-auto" />
        </div>

        <div className="mb-8 px-2">
          <button
            type="button"
            onClick={() => setLocation("/debt-manager/profile")}
            className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 ${
              isProfileActive
                ? "bg-white/12 text-white shadow-[0_10px_30px_-18px_rgba(255,255,255,0.35)]"
                : "text-white/80 hover:bg-white/6 hover:text-white"
            }`}
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                isProfileActive
                  ? "bg-white/14 text-secondary"
                  : "bg-white/10 text-white/85 group-hover:bg-white/[0.14]"
              }`}
            >
              <UserCircle2 className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Signed in as
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {username}
              </p>
              <p
                className={`text-xs ${
                  isProfileActive
                    ? "text-white/70"
                    : "text-white/55 group-hover:text-white/70"
                }`}
              >
                Debt Collections
              </p>
            </div>
          </button>
        </div>

        <div className="mb-3 px-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            Workspace
          </p>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setLocation(item.href)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 ${
                  active
                    ? "bg-white/12 text-white shadow-[0_10px_30px_-18px_rgba(255,255,255,0.35)]"
                    : "text-white/72 hover:bg-white/6 hover:text-white"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    active
                      ? "bg-white/14 text-secondary"
                      : "bg-white/[0.04] text-white/70 group-hover:bg-white/[0.07] group-hover:text-white"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p
                    className={`truncate text-xs ${
                      active
                        ? "text-white/60"
                        : "text-white/42 group-hover:text-white/55"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 px-2">
          <div className="rounded-3xl bg-white/[0.045] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/15">
                <CheckSquare className="h-4 w-4 text-secondary" />
              </div>

              <div>
                <p className="text-sm font-medium text-white">Today’s focus</p>
                <p className="mt-1 text-xs leading-5 text-white/58">
                  Start with newly qualified debtors, assign fast, and keep the
                  momentum visible.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Button
            variant="ghost"
            onClick={onLogout}
            className="h-12 w-full justify-start rounded-2xl px-3 text-white/65 hover:bg-white/6 hover:text-white"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    </aside>
  );
}