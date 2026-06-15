import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Flame,
  Plus,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FocusTask } from "@/pages/debt-manager/types";

interface TodayFocusPanelProps {
  tasks: FocusTask[];
}

type QuestTask = FocusTask & {
  progressCurrent: number;
  progressTarget: number;
  xpReward: number;
  completed: boolean;
  objectiveType: string;
};

const priorityStyles = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
  Low: "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
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
      xpReward: task.xpReward ?? 60,
      objectiveType: task.objectiveType ?? "Objective",
      completed: task.completed || progressCurrent >= progressTarget,
    };
  });
}

export function TodayFocusPanel({ tasks }: TodayFocusPanelProps) {
  const [questTasks, setQuestTasks] = useState<QuestTask[]>(() =>
    normalizeTasks(tasks),
  );

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

  const completedCount = questTasks.filter((task) => task.completed).length;
  const totalTasks = questTasks.length;
  const overallProgress = totalTasks
    ? Math.round((completedCount / totalTasks) * 100)
    : 0;

  const totalXpAvailable = questTasks.reduce(
    (sum, task) => sum + task.xpReward,
    0,
  );

  const totalXpEarned = questTasks.reduce((sum, task) => {
    const portion = task.progressTarget
      ? task.progressCurrent / task.progressTarget
      : 0;

    return sum + Math.round(task.xpReward * portion);
  }, 0);

  const levelSize = 250;
  const currentLevel = Math.floor(totalXpEarned / levelSize) + 1;
  const xpIntoLevel = totalXpEarned % levelSize;
  const xpToNextLevel = levelSize - xpIntoLevel;

  const highPriorityLeft = questTasks.filter(
    (task) => task.priority === "High" && !task.completed,
  ).length;

  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-[hsl(142,100%,26%)]">
          <Sparkles className="h-3.5 w-3.5" />
          Daily objectives
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Your action list
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Turn today’s work into a visible progression system. Complete
              objectives, earn XP, and push your collector level up.
            </p>

            <div className="rounded-[24px] border border-primary/10 bg-[linear-gradient(135deg,hsl(220,100%,15%)_0%,hsl(220,100%,18%)_60%,hsl(220,90%,24%)_100%)] p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                    Collector level
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      <Trophy className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">Level {currentLevel}</p>
                      <p className="text-xs text-white/70">
                        {xpToNextLevel} XP to next level
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-wide text-white/55">
                    XP earned
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {totalXpEarned}/{totalXpAvailable}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-white/70">
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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-secondary" />
                Daily completion
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {completedCount}/{totalTasks}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {overallProgress}% of today’s objectives cleared
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-accent" />
                High-priority left
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {highPriorityLeft}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your hardest-hitting work still in queue
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-secondary" />
                Momentum
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {totalXpEarned >= totalXpAvailable * 0.6 ? "Hot" : "Building"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                XP makes the day feel more alive
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-6 pb-6">
        {questTasks.map((task) => {
          const taskPercent = Math.round(
            (task.progressCurrent / task.progressTarget) * 100,
          );

          return (
            <div
              key={task.id}
              className={`rounded-[22px] border p-4 transition-all ${
                task.completed
                  ? "border-secondary/20 bg-secondary/5"
                  : "border-border/80 bg-[linear-gradient(180deg,hsl(0,0%,100%)_0%,hsl(220,14%,99%)_100%)]"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                    ) : (
                      <Target className="h-5 w-5 text-primary" />
                    )}

                    <p className="font-medium text-foreground">{task.title}</p>

                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[task.priority]}`}
                    >
                      {task.priority}
                    </span>

                    <span className="inline-flex items-center rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                      <Star className="mr-1 h-3 w-3" />
                      +{task.xpReward} XP
                    </span>

                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {task.objectiveType}
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

                <div className="flex min-w-[200px] flex-col gap-2">
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}