import { ReactNode } from "react";

interface DebtPageHeaderProps {
  badge: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function DebtPageHeader({
  badge,
  title,
  description,
  actions,
}: DebtPageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_58%,hsl(142,100%,34%)_140%)] p-6 text-white shadow-[0_24px_60px_-28px_rgba(8,38,84,0.55)] sm:p-8">
      <div className="absolute -right-16 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-0 right-20 h-28 w-28 rounded-full bg-[hsl(341,72%,74%)]/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90">
            {badge}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/78 sm:text-base">
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}