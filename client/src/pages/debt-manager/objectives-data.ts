import type { FocusTask } from "./types";

export const dailyObjectives: FocusTask[] = [
  {
    id: "task-001",
    title: "Assign 5 newly qualified debtors",
    description:
      "Prioritise accounts terminated for more than 30 days with verified balances.",
    priority: "High",
    dueLabel: "Start now",
    impactLabel: "Creates collector ownership",
    completed: false,
    progressCurrent: 2,
    progressTarget: 5,
    xpReward: 90,
    objectiveType: "Assignment quest",
  },
  {
    id: "task-002",
    title: "Follow up on 3 promises-to-pay",
    description:
      "Confirm payment receipts and update the status before end of day.",
    priority: "High",
    dueLabel: "Due today",
    impactLabel: "Potential recovery: R31 500",
    completed: false,
    progressCurrent: 1,
    progressTarget: 3,
    xpReward: 80,
    objectiveType: "Recovery quest",
  },
  {
    id: "task-003",
    title: "Review contactability gaps",
    description:
      "Flag accounts missing valid phone or email details for tracing.",
    priority: "Medium",
    dueLabel: "This afternoon",
    impactLabel: "Improves call success rate",
    completed: true,
    progressCurrent: 4,
    progressTarget: 4,
    xpReward: 55,
    objectiveType: "Data cleanup",
  },
  {
    id: "task-004",
    title: "Prepare tomorrow’s high-value queue",
    description: "Create a focused list for balances above R25 000.",
    priority: "Low",
    dueLabel: "Before sign-off",
    impactLabel: "Speeds up tomorrow’s outreach",
    completed: false,
    progressCurrent: 1,
    progressTarget: 2,
    xpReward: 45,
    objectiveType: "Prep objective",
  },
  {
    id: "task-005",
    title: "Log collector notes on 6 active accounts",
    description:
      "Make sure contact attempts and next steps are clearly recorded for the next shift.",
    priority: "Medium",
    dueLabel: "Before sign-off",
    impactLabel: "Improves handover quality",
    completed: false,
    progressCurrent: 3,
    progressTarget: 6,
    xpReward: 60,
    objectiveType: "Ops discipline",
  },
];

export const objectiveProfile = {
  baseXp: 1280,
  streakDays: 8,
  levelSize: 300,
  rankLabel: "Collector Progression",
};