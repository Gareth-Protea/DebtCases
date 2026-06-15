import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Flame,
  Plus,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FocusTask } from "@/pages/debt-manager/types";

interface DailyObjectivesBoardProps {
  tasks: FocusTask[];
  baseXp: number;
  streakDays: number;
  levelSize?: number;
}

type FilterType = "all" | "active" | "completed" | "high";

type QuestTask = FocusTask & {
  progressCurrent: number;
  progressTarget: number;
  xpReward: number;
  completed: boolean;
  objectiveType: string;
};

function normalizeTasks(tasks: FocusTask[]): QuestTask[] {
  return tasks.map((task) => {
    const progressTarget = task.progressTarget ?? 1;
    const progressCurrent = task.completed
      ? progressTarget
      : Math.min(task.progressCurrent ?? 0, progressTarget);

    return {
      ...task,
      progressCurrent,
      progressTarget,
      xpReward: task.xpReward ?? 50,
      objectiveType: task.objectiveType ?? "Objective",
      completed: task.completed || progressCurrent >= progressTarget,
    };
  });
}

const priorityStyles = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
  Low: "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
};

export function DailyObjectivesBoard({
  tasks,
  baseXp,
  streakDays,
  levelSize = 300,
}: DailyObjectivesBoardProps) {
  const [questTasks, setQuestTasks] = useState<QuestTask[]>(() =>
    normalizeTasks(tasks),
  );
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    setQuestTasks(normalizeTasks(tasks));
  }, [tasks]);

  const updateProgress = (taskId: string) => {
    setQuestTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId || task.completed) return task;

        const nextValue = Math.min(task.progressCurrent + 1, task.progressTarget);
        const completed = nextValue >= task.progressTarget;

        return {
          ...task,
          progressCurrent: nextValue,
          completed,
        };
      }),
    );
  };

  const completeTask = (taskId: string) => {
    setQuestTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        return {
          ...task,
          progressCurrent: task.progressTarget,
          completed: true,
        };
      }),
    );
  };

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "active":
        return questTasks.filter((task) => !task.completed);
      case "completed":
        return questTasks.filter((task) => task.completed);
      case "high":
        return questTasks.filter((task) => task.priority === "High");
      default:
        return questTasks;
    }
  }, [filter, questTasks]);

  const completedCount = questTasks.filter((task) => task.completed).length;
  const totalTasks = questTasks.length;
  const totalXpAvailable = questTasks.reduce(
    (sum, task) => sum + task.xpReward,
    0,
  );

  const earnedXpToday = questTasks.reduce((sum, task) => {
    const portion = task.progressCurrent / task.progressTarget;
    return sum + Math.round(task.xpReward * portion);
  }, 0);

  const totalXp = baseXp + earnedXpToday;
  const currentLevel = Math.floor(totalXp / levelSize) + 1;
  const xpIntoLevel = totalXp % levelSize;
  const xpToNextLevel = levelSize - xpIntoLevel;
  const overallProgress = Math.round((completedCount / totalTasks) * 100);
  const highPriorityLeft = questTasks.filter(
    (task) => task.priority === "High" && !task.completed,
  ).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All objectives" },
            { key: "active", label: "Active" },
            { key: "completed", label: "Completed" },
            { key: "high", label: "High priority" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key as FilterType)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredTasks.map((task) => {
          const taskPercent = Math.round(
            (task.progressCurrent / task.progressTarget) * 100,
          );

          return (
            <Card
              key={task.id}
              className={`rounded-[26px] border shadow-sm transition-all ${
                task.completed
                  ? "border-secondary/20 bg-secondary/5"
                  : "border-border/70 bg-card"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-secondary" />
                      ) : (
                        <Target className="h-5 w-5 text-primary" />
                      )}

                      <p className="font-semibold text-foreground">{task.title}</p>

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[task.priority]}`}
                      >
                        {task.priority}
                      </span>

                      <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                        {task.objectiveType}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-[hsl(45,96%,58%)]/15 px-2.5 py-1 text-xs font-medium text-[hsl(40,90%,38%)]">
                        <Star className="mr-1 h-3 w-3" />
                        +{task.xpReward} XP
                      </span>
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                      {task.description}
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Objective progress
                        </span>
                        <span className="font-medium text-foreground">
                          {task.progressCurrent}/{task.progressTarget} • {taskPercent}%
                        </span>
                      </div>

                      <div className="h-2.5 rounded-full bg-muted">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            task.completed
                              ? "bg-secondary"
                              : "bg-[linear-gradient(90deg,hsl(220,100%,15%)_0%,hsl(142,100%,44%)_100%)]"
                          }`}
                          style={{ width: `${taskPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-primary/5 px-3 py-1 font-medium text-primary">
                        {task.dueLabel}
                      </span>
                      <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
                        {task.impactLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    <Button
                      onClick={() => updateProgress(task.id)}
                      disabled={task.completed}
                      variant="outline"
                      className="justify-start rounded-xl"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add progress
                    </Button>

                    <Button
                      onClick={() => completeTask(task.id)}
                      disabled={task.completed}
                      className="justify-start rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      {task.completed ? "Completed" : "Complete objective"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_100%)] text-white shadow-[0_24px_60px_-30px_rgba(8,38,84,0.6)]">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                Collector level
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                  <Trophy className="h-7 w-7 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">Level {currentLevel}</p>
                  <p className="text-xs text-white/65">{xpToNextLevel} XP to next level</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span>XP progress</span>
                <span>{xpIntoLevel}/{levelSize} XP</span>
              </div>

              <div className="h-2.5 rounded-full bg-white/10">
                <div
                  className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(142,100%,50%)_0%,hsl(45,96%,58%)_100%)] transition-all duration-500"
                  style={{ width: `${(xpIntoLevel / levelSize) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Sparkles className="h-4 w-4 text-secondary" />
                  <span className="text-xs">Earned today</span>
                </div>
                <p className="text-xl font-semibold">{earnedXpToday} XP</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Flame className="h-4 w-4 text-secondary" />
                  <span className="text-xs">Streak</span>
                </div>
                <p className="text-xl font-semibold">{streakDays} days</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <BadgeCheck className="h-4 w-4 text-secondary" />
                  <span className="text-xs">Completed</span>
                </div>
                <p className="text-xl font-semibold">
                  {completedCount}/{totalTasks}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Zap className="h-4 w-4 text-accent" />
                  <span className="text-xs">High priority left</span>
                </div>
                <p className="text-xl font-semibold">{highPriorityLeft}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-secondary/20 bg-secondary/10 p-4">
              <div className="flex items-start gap-3">
                <Swords className="mt-0.5 h-4 w-4 text-secondary" />
                <div>
                  <p className="text-sm font-medium text-white">Progression system</p>
                  <p className="mt-1 text-xs leading-5 text-white/72">
                    Level benefits can come later. For now this gives the user a sense
                    of growth, momentum, and visible daily achievement.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Daily mission status
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            <div className="rounded-2xl bg-muted/35 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Completion</span>
                <span className="text-muted-foreground">{overallProgress}%</span>
              </div>

              <div className="h-2.5 rounded-full bg-border/70">
                <div
                  className="h-2.5 rounded-full bg-[linear-gradient(90deg,hsl(220,100%,15%)_0%,hsl(142,100%,44%)_100%)]"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-muted/35 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Daily XP pool
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {earnedXpToday}/{totalXpAvailable}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total XP available from today’s objectives
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 