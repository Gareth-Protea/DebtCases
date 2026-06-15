import { ArrowUpRight, CheckCircle2, Sparkles, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FocusTask } from "@/pages/debt-manager/types";

interface ObjectivesSummaryCardProps {
  tasks: FocusTask[];
  baseXp: number;
  streakDays: number;
  levelSize?: number;
  onOpenObjectives: () => void;
}

export function ObjectivesSummaryCard({
  tasks,
  baseXp,
  streakDays,
  levelSize = 300,
  onOpenObjectives,
}: ObjectivesSummaryCardProps) {
  const normalizedTasks = tasks.map((task) => {
    const progressTarget = task.progressTarget ?? 1;
    const progressCurrent = task.completed
      ? progressTarget
      : Math.min(task.progressCurrent ?? 0, progressTarget);

    return {
      ...task,
      progressTarget,
      progressCurrent,
      xpReward: task.xpReward ?? 50,
      completed: task.completed || progressCurrent >= progressTarget,
    };
  });

  const completedCount = normalizedTasks.filter((task) => task.completed).length;

  const earnedXp = normalizedTasks.reduce((sum, task) => {
    const portion = task.progressCurrent / task.progressTarget;
    return sum + Math.round((task.xpReward ?? 50) * portion);
  }, 0);

  const totalXp = baseXp + earnedXp;
  const currentLevel = Math.floor(totalXp / levelSize) + 1;
  const xpIntoLevel = totalXp % levelSize;
  const nextLevelXp = levelSize - xpIntoLevel;

  const topObjectives = normalizedTasks
    .filter((task) => !task.completed)
    .sort((a, b) => (b.priority === "High" ? 1 : 0) - (a.priority === "High" ? 1 : 0))
    .slice(0, 3);

  return (
    <Card className="overflow-hidden rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_100%)] text-white shadow-[0_24px_60px_-30px_rgba(8,38,84,0.6)]">
      <CardHeader className="space-y-4 p-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
          <Sparkles className="h-3.5 w-3.5 text-secondary" />
          Daily objectives
        </div>

        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight text-white">
            Objectives
          </CardTitle>
        
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <Trophy className="h-4 w-4 text-secondary" />
              <span className="text-xs">Current level</span>
            </div>
            <p className="text-2xl font-semibold text-white">Level {currentLevel}</p>
            <p className="mt-1 text-xs text-white/60">{nextLevelXp} XP to next level</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span className="text-xs">Completed today</span>
            </div>
            <p className="text-2xl font-semibold text-white">
              {completedCount}/{normalizedTasks.length}
            </p>
            <p className="mt-1 text-xs text-white/60">Daily objective completion</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <Star className="h-4 w-4 text-[hsl(45,96%,58%)]" />
              <span className="text-xs">Current streak</span>
            </div>
            <p className="text-2xl font-semibold text-white">{streakDays} days</p>
            <p className="mt-1 text-xs text-white/60">Consistency keeps momentum up</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/68">
            <span>Level progress</span>
            <span>{xpIntoLevel}/{levelSize} XP</span>
          </div>

          <div className="h-2.5 rounded-full bg-white/10">
            <div
              className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(142,100%,50%)_0%,hsl(45,96%,58%)_100%)] transition-all duration-500"
              style={{ width: `${(xpIntoLevel / levelSize) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white/84">Top objectives</p>

          {topObjectives.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{task.title}</p>
                <p className="text-xs text-white/60">
                  {task.progressCurrent}/{task.progressTarget} complete
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/78">
                +{task.xpReward ?? 50} XP
              </span>
            </div>
          ))}
        </div>

        <Button
          onClick={onOpenObjectives}
          className="w-full rounded-2xl bg-white text-primary hover:bg-white/90"
        >
          Open daily objectives
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}