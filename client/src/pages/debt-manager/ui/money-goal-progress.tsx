import { ArrowUpRight, Coins, Target, TrendingUp } from "lucide-react";

interface MoneyGoalProgressProps {
  currentAmount: number;
  monthlyTarget: number;
  nextGoalAmount: number;
  queueCount: number;
  streakDays: number;
}

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function getProgressTheme(progress: number) {
  if (progress < 34) {
    return {
      color: "rgb(237, 59, 59)",
      border: "rgba(237, 59, 59, 0.85)",
      water: "rgba(237, 59, 59, 0.88)",
      glow: "0 0 22px rgba(237, 59, 59, 0.28)",
      soft: "rgba(237, 59, 59, 0.12)",
    };
  }

  if (progress < 67) {
    return {
      color: "rgb(240, 124, 62)",
      border: "rgba(240, 124, 62, 0.85)",
      water: "rgba(240, 124, 62, 0.88)",
      glow: "0 0 22px rgba(240, 124, 62, 0.28)",
      soft: "rgba(240, 124, 62, 0.12)",
    };
  }

  return {
    color: "rgb(83, 252, 83)",
    border: "rgba(83, 252, 83, 0.85)",
    water: "rgba(83, 252, 83, 0.88)",
    glow: "0 0 22px rgba(83, 252, 83, 0.28)",
    soft: "rgba(83, 252, 83, 0.12)",
  };
}

export function MoneyGoalProgress({
  currentAmount,
  monthlyTarget,
  nextGoalAmount,
  queueCount,
  streakDays,
}: MoneyGoalProgressProps) {
  const progress = Math.max(
    0,
    Math.min((currentAmount / monthlyTarget) * 100, 100),
  );

  const amountLeftToTarget = Math.max(monthlyTarget - currentAmount, 0);
  const amountLeftToMilestone = Math.max(nextGoalAmount - currentAmount, 0);

  const theme = getProgressTheme(progress);
  const waterTop = `${100 - progress}%`;

  return (
    <>
      <style>{`
        @keyframes debt-liquid-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes debt-meter-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>

      <div className="rounded-[28px] bg-white/8 p-4 backdrop-blur-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/80">Recovery goal</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {currency.format(currentAmount)}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {amountLeftToMilestone === 0
                ? "Milestone reached"
                : `${currency.format(amountLeftToMilestone)} to next milestone`}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              Monthly target
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {currency.format(monthlyTarget)}
            </p>
          </div>
        </div>

        <div className="grid items-center gap-4 md:grid-cols-[190px_1fr]">
          <div className="mx-auto flex w-full justify-center">
            <div
              className="relative h-[180px] w-[180px]"
              style={{ animation: "debt-meter-float 4s ease-in-out infinite" }}
            >
              <div
                className="absolute inset-0 rounded-full border"
                style={{
                  borderColor: theme.border,
                  boxShadow: theme.glow,
                }}
              />

              <div
                className="absolute inset-[10px] rounded-full border"
                style={{
                  borderColor: "rgba(255,255,255,0.16)",
                  background:
                    "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.01) 100%)",
                }}
              />

              <div className="absolute inset-[16px] overflow-hidden rounded-full border border-white/70 bg-[rgba(255,255,255,0.08)]">
                <div
                  className="absolute z-10 h-[200%] w-[200%] -left-1/2 rounded-[40%] transition-all duration-1000 ease-in-out"
                  style={{
                    top: waterTop,
                    background: theme.water,
                    boxShadow: theme.glow,
                    animation: "debt-liquid-spin 10s linear infinite",
                  }}
                />

                <div className="absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_36%,rgba(255,255,255,0)_100%)]" />

                <div className="absolute -left-[120%] -top-[120%] z-30 h-[200%] w-[200%] rotate-45 rounded-full bg-white/12" />
              </div>

              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 drop-shadow-[0_1px_6px_rgba(0,0,0,0.22)]">
                  Progress
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.24)]">
                  {Math.round(progress)}%
                </p>
                <p className="mt-1 text-xs text-white/82 drop-shadow-[0_1px_8px_rgba(0,0,0,0.2)]">
                  {currency.format(currentAmount)}
                </p>
              </div>

              <div
                className="absolute left-1/2 top-[18px] h-6 w-20 -translate-x-1/2 rounded-full blur-md"
                style={{ background: theme.soft }}
              />
            </div>
          </div>

          <div className="space-y-4">
            

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/7 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Target className="h-4 w-4 text-secondary" />
                  <span className="text-xs">Still to target</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {currency.format(amountLeftToTarget)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/7 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Coins className="h-4 w-4 text-[hsl(45,96%,58%)]" />
                  <span className="text-xs">Ready to action</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {queueCount} accounts
                </p>
              </div>

              <div className="rounded-2xl bg-white/7 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <TrendingUp className="h-4 w-4 text-secondary" />
                  <span className="text-xs">Momentum</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {streakDays}-day streak
                </p>
              </div>

              <div className="rounded-2xl bg-white/7 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <ArrowUpRight className="h-4 w-4 text-accent" />
                  <span className="text-xs">Next milestone</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {currency.format(nextGoalAmount)}
                </p>
              </div>
            </div>

            
          </div>
        </div>
      </div>
    </>
  );
}