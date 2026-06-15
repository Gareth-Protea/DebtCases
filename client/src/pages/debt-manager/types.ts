export type DebtorPriority = "High" | "Medium" | "Low";
export type TaskPriority = "High" | "Medium" | "Low";
export type AchievementIcon = "flame" | "target" | "sparkles";

export interface DebtorLead {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  email: string;
  area: string;
  daysSinceTermination: number;
  outstandingBalance: number;
  meterReference: string;
  priority: DebtorPriority;
  note: string;
}

export interface FocusTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueLabel: string;
  impactLabel: string;
  completed: boolean;

  // New optional game-like fields
  progressCurrent?: number;
  progressTarget?: number;
  xpReward?: number;
  objectiveType?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  tag: string;
}