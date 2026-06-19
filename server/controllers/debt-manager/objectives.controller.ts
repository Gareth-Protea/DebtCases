import type { Request, Response } from "express";
import { soapSelect, soapWrite } from "../../lib/debt-case-soap";

const DB_NAME = process.env.DEBT_CASE_DB_NAME ?? "TestMetermisDB";
const DB_SCHEMA = `[${DB_NAME}].[dbo]`;
const LEVEL_SIZE = Number(process.env.DEBT_OBJECTIVE_LEVEL_SIZE || 100);

const TABLES = {
  agents: `${DB_SCHEMA}.[DebtCaseAgents]`,
  cases: `${DB_SCHEMA}.[DebtCase]`,
  events: `${DB_SCHEMA}.[DebtCaseEvent]`,
  weeklyObjectives: `${DB_SCHEMA}.[DebtAgentWeeklyObjective]`,
};

type NumericRow = Record<string, string | number | null | undefined>;

type ObjectiveMetricType =
  | "OWNED_ACTIVE_CASES"
  | "WEEKLY_CASE_TOUCHES"
  | "WEEKLY_COMMUNICATIONS"
  | "WEEKLY_INVOICES"
  | "WEEKLY_FINAL_DEMANDS"
  | "WEEKLY_RESOLUTIONS"
  | "WEEKLY_ESCALATIONS"
  | "MONTHLY_RECOVERY_VALUE"
  | "CURRENT_STREAK";

type ObjectiveDefinition = {
  code: string;
  title: string;
  description: string;
  metricType: ObjectiveMetricType;
  targetValue: number;
  xpReward: number;
  shopCoinReward: number;
  priority: "Low" | "Medium" | "High";
  objectiveType: string;
  metricNote: string;
};

type WeeklyObjectiveRow = {
  AgentWeeklyObjectiveID: string | number;
  AgentID: string | number;
  WeekKey: string;
  ObjectiveCode: string;
  Title: string;
  Description: string;
  MetricType: ObjectiveMetricType;
  TargetValue: string | number;
  XPReward: string | number;
  ShopCoinReward: string | number;
  Priority: string;
  ObjectiveType: string;
  MetricNote: string;
  CurrentValue: string | number | null;
  CompletedAt: string | null;
  XPAwarded: string | number | boolean | null;
  AwardedAt: string | null;
};

type AgentRow = {
  ID: string | number;
  AgentName: string;
  Email?: string | null;
  ExperiencePoints?: string | number | null;
  Level?: string | number | null;
  ShopCoins?: string | number | null;
  CoinsEarnedLifetime?: string | number | null;
  CurrentStreakDays?: string | number | null;
  LongestStreakDays?: string | number | null;
  ObjectivesCompleted?: string | number | null;
};

const OBJECTIVE_POOLS: ObjectiveDefinition[][] = [
  [
    {
      code: "OWN_QUEUE_8",
      title: "Own your active queue",
      description: "Keep a healthy book of active debtor cases assigned to you.",
      metricType: "OWNED_ACTIVE_CASES",
      targetValue: 8,
      xpReward: 25,
      shopCoinReward: 8,
      priority: "High",
      objectiveType: "Assignment quest",
      metricNote: "Counts active unpaid cases currently assigned to you.",
    },
    {
      code: "WEEK_TOUCH_10",
      title: "Touch 10 cases this week",
      description: "Move cases forward by recording real activity during this week.",
      metricType: "WEEKLY_CASE_TOUCHES",
      targetValue: 10,
      xpReward: 35,
      shopCoinReward: 12,
      priority: "High",
      objectiveType: "Activity quest",
      metricNote: "Counts distinct debt cases with events triggered by you this week.",
    },
    {
      code: "WEEK_COMMS_8",
      title: "Send 8 debtor communications",
      description: "Use email, WhatsApp, or call logging to keep contact activity moving.",
      metricType: "WEEKLY_COMMUNICATIONS",
      targetValue: 8,
      xpReward: 35,
      shopCoinReward: 12,
      priority: "High",
      objectiveType: "Contact quest",
      metricNote: "Counts DebtCaseEvent rows where CommunicationType is populated this week.",
    },
    {
      code: "WEEK_INVOICE_3",
      title: "Send 3 invoice communications",
      description: "Push first-contact cases by sending invoice communications.",
      metricType: "WEEKLY_INVOICES",
      targetValue: 3,
      xpReward: 20,
      shopCoinReward: 7,
      priority: "Medium",
      objectiveType: "Invoice quest",
      metricNote: "Counts this week's communication events with IncludesInvoice = 1.",
    },
    {
      code: "STREAK_5",
      title: "Maintain a 5 day activity streak",
      description: "Stay consistent and keep your collector streak alive.",
      metricType: "CURRENT_STREAK",
      targetValue: 5,
      xpReward: 15,
      shopCoinReward: 5,
      priority: "Medium",
      objectiveType: "Consistency quest",
      metricNote: "Uses CurrentStreakDays on your DebtCaseAgents profile.",
    },
    {
      code: "ESCALATE_1",
      title: "Escalate one stuck case",
      description: "Keep difficult accounts visible instead of letting them stall.",
      metricType: "WEEKLY_ESCALATIONS",
      targetValue: 1,
      xpReward: 15,
      shopCoinReward: 5,
      priority: "Low",
      objectiveType: "Visibility quest",
      metricNote: "Counts this week's events that look like superior escalations.",
    },
  ],
  [
    {
      code: "WEEK_COMMS_12",
      title: "Complete 12 contact attempts",
      description: "Drive weekly outreach through logged communications.",
      metricType: "WEEKLY_COMMUNICATIONS",
      targetValue: 12,
      xpReward: 45,
      shopCoinReward: 15,
      priority: "High",
      objectiveType: "Contact quest",
      metricNote: "Counts DebtCaseEvent rows where CommunicationType is populated this week.",
    },
    {
      code: "FINAL_DEMAND_2",
      title: "Send 2 final demands",
      description: "Move overdue accounts into the final demand process.",
      metricType: "WEEKLY_FINAL_DEMANDS",
      targetValue: 2,
      xpReward: 30,
      shopCoinReward: 10,
      priority: "High",
      objectiveType: "Final demand quest",
      metricNote: "Counts this week's communication events with IncludesFinalDemand = 1.",
    },
    {
      code: "RESOLVE_2",
      title: "Confirm 2 case outcomes",
      description: "Select final outcomes for cases that have reached decision point.",
      metricType: "WEEKLY_RESOLUTIONS",
      targetValue: 2,
      xpReward: 35,
      shopCoinReward: 12,
      priority: "High",
      objectiveType: "Resolution quest",
      metricNote: "Counts this week's events where ResolutionType is populated.",
    },
    {
      code: "WEEK_TOUCH_8",
      title: "Work 8 unique cases",
      description: "Spread activity across your queue instead of only one account.",
      metricType: "WEEKLY_CASE_TOUCHES",
      targetValue: 8,
      xpReward: 30,
      shopCoinReward: 10,
      priority: "Medium",
      objectiveType: "Activity quest",
      metricNote: "Counts distinct debt cases with events triggered by you this week.",
    },
    {
      code: "RECOVER_25000",
      title: "Build R25 000 recovery value",
      description: "Grow monthly recovered value from accounts in your queue.",
      metricType: "MONTHLY_RECOVERY_VALUE",
      targetValue: 25000,
      xpReward: 50,
      shopCoinReward: 20,
      priority: "High",
      objectiveType: "Recovery quest",
      metricNote: "Uses paid cases in your queue for the current month.",
    },
    {
      code: "OWN_QUEUE_6",
      title: "Keep 6 active cases moving",
      description: "Maintain a focused active book of collector-owned cases.",
      metricType: "OWNED_ACTIVE_CASES",
      targetValue: 6,
      xpReward: 20,
      shopCoinReward: 7,
      priority: "Medium",
      objectiveType: "Queue quest",
      metricNote: "Counts active unpaid cases currently assigned to you.",
    },
  ],
  [
    {
      code: "WEEK_INVOICE_5",
      title: "Send 5 invoice communications",
      description: "Push newly qualified cases into the first communication stage.",
      metricType: "WEEKLY_INVOICES",
      targetValue: 5,
      xpReward: 35,
      shopCoinReward: 12,
      priority: "High",
      objectiveType: "Invoice quest",
      metricNote: "Counts this week's communication events with IncludesInvoice = 1.",
    },
    {
      code: "WEEK_COMMS_10",
      title: "Send 10 debtor communications",
      description: "Keep account contact activity visible and auditable.",
      metricType: "WEEKLY_COMMUNICATIONS",
      targetValue: 10,
      xpReward: 40,
      shopCoinReward: 14,
      priority: "High",
      objectiveType: "Contact quest",
      metricNote: "Counts DebtCaseEvent rows where CommunicationType is populated this week.",
    },
    {
      code: "STREAK_7",
      title: "Hit a 7 day streak",
      description: "Build consistency through daily collector activity.",
      metricType: "CURRENT_STREAK",
      targetValue: 7,
      xpReward: 25,
      shopCoinReward: 9,
      priority: "Medium",
      objectiveType: "Consistency quest",
      metricNote: "Uses CurrentStreakDays on your DebtCaseAgents profile.",
    },
    {
      code: "WEEK_TOUCH_12",
      title: "Work 12 unique cases",
      description: "Spread this week's effort across a wider debtor queue.",
      metricType: "WEEKLY_CASE_TOUCHES",
      targetValue: 12,
      xpReward: 40,
      shopCoinReward: 14,
      priority: "High",
      objectiveType: "Activity quest",
      metricNote: "Counts distinct debt cases with events triggered by you this week.",
    },
    {
      code: "RESOLVE_1",
      title: "Confirm one final outcome",
      description: "Close the loop on an account ready for decision.",
      metricType: "WEEKLY_RESOLUTIONS",
      targetValue: 1,
      xpReward: 20,
      shopCoinReward: 7,
      priority: "Medium",
      objectiveType: "Resolution quest",
      metricNote: "Counts this week's events where ResolutionType is populated.",
    },
    {
      code: "RECOVER_15000",
      title: "Record R15 000 recovery value",
      description: "Build monthly recovery value on accounts assigned to you.",
      metricType: "MONTHLY_RECOVERY_VALUE",
      targetValue: 15000,
      xpReward: 35,
      shopCoinReward: 12,
      priority: "Medium",
      objectiveType: "Recovery quest",
      metricNote: "Uses paid cases in your queue for the current month.",
    },
  ],
];

function sqlString(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  return `N'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : String(fallback);
}

function sqlDecimal(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(fallback);
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return false;
}

function calculateLevel(totalXp: number, levelSize = LEVEL_SIZE) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const safeLevelSize = Math.max(1, Math.floor(levelSize));
  const level = Math.floor(safeXp / safeLevelSize) + 1;
  const xpIntoLevel = safeXp % safeLevelSize;
  const xpToNext = safeLevelSize - xpIntoLevel;
  const xpProgress = Math.max(
    0,
    Math.min(100, Math.round((xpIntoLevel / safeLevelSize) * 100)),
  );

  return {
    level,
    xpIntoLevel,
    xpToNext,
    xpProgress,
    levelSize: safeLevelSize,
  };
}

function startOfIsoWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toSqlDate(date: Date) {
  return `'${date.toISOString().slice(0, 19).replace("T", " ")}'`;
}

function getIsoWeekYear(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  return copy.getUTCFullYear();
}

function getIsoWeekNumber(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekKey(date = new Date()) {
  const year = getIsoWeekYear(date);
  const week = getIsoWeekNumber(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getObjectivePoolForWeek(weekKey: string) {
  const weekNumber = Number(weekKey.split("-W")[1] || 1);
  return OBJECTIVE_POOLS[Math.abs(weekNumber) % OBJECTIVE_POOLS.length];
}

function progressPercent(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function currentLabel(metricType: ObjectiveMetricType, value: number) {
  if (metricType === "MONTHLY_RECOVERY_VALUE") return formatCurrency(value);
  if (metricType === "CURRENT_STREAK") return `${Math.floor(value)} days`;
  return String(Math.floor(value));
}

function targetLabel(metricType: ObjectiveMetricType, value: number) {
  if (metricType === "MONTHLY_RECOVERY_VALUE") return formatCurrency(value);
  if (metricType === "CURRENT_STREAK") return `${Math.floor(value)} days`;
  if (metricType === "WEEKLY_CASE_TOUCHES") return `${Math.floor(value)} cases`;
  if (metricType === "WEEKLY_COMMUNICATIONS") return `${Math.floor(value)} contacts`;
  return String(Math.floor(value));
}

async function ensureObjectiveTable() {
  /*
   * IMPORTANT:
   * Your soapWrite/writeMetermis layer only allows INSERT/UPDATE/DELETE.
   * It rejects IF/CREATE statements, so this controller cannot create tables
   * automatically through SOAP.
   *
   * Run the companion SQL script once in SSMS:
   *   create-debt-agent-weekly-objective.sql
   */
  const rows = await soapSelect<{ TableExists: string | number }>(`
    SELECT CASE
      WHEN OBJECT_ID('${DB_NAME}.dbo.DebtAgentWeeklyObjective', 'U') IS NULL THEN 0
      ELSE 1
    END AS TableExists;
  `);

  if (asNumber(rows[0]?.TableExists) !== 1) {
    throw new Error(
      "Missing table DebtAgentWeeklyObjective. Run create-debt-agent-weekly-objective.sql once in SSMS, then refresh objectives.",
    );
  }
}

async function getAgent(agentId: number) {
  const rows = await soapSelect<AgentRow>(`
    SELECT TOP 1
      ID,
      AgentName,
      Email,
      ISNULL(ExperiencePoints, 0) AS ExperiencePoints,
      ISNULL(Level, 1) AS Level,
      ISNULL(ShopCoins, 0) AS ShopCoins,
      ISNULL(CoinsEarnedLifetime, 0) AS CoinsEarnedLifetime,
      ISNULL(CurrentStreakDays, 0) AS CurrentStreakDays,
      ISNULL(LongestStreakDays, 0) AS LongestStreakDays,
      ISNULL(ObjectivesCompleted, 0) AS ObjectivesCompleted
    FROM ${TABLES.agents}
    WHERE ID = ${sqlNumber(agentId)};
  `);

  return rows[0] ?? null;
}

async function ensureWeeklyObjectives(agentId: number, weekKey: string) {
  const existing = await soapSelect<{ Count: string | number }>(`
    SELECT COUNT(*) AS Count
    FROM ${TABLES.weeklyObjectives}
    WHERE AgentID = ${sqlNumber(agentId)}
      AND WeekKey = ${sqlString(weekKey)};
  `);

  if (asNumber(existing[0]?.Count) > 0) return;

  const pool = getObjectivePoolForWeek(weekKey);

  for (const objective of pool) {
    await soapWrite(`
      INSERT INTO ${TABLES.weeklyObjectives} (
        AgentID,
        WeekKey,
        ObjectiveCode,
        Title,
        Description,
        MetricType,
        TargetValue,
        XPReward,
        ShopCoinReward,
        Priority,
        ObjectiveType,
        MetricNote,
        CurrentValue,
        CreatedAt,
        UpdatedAt
      )
      VALUES (
        ${sqlNumber(agentId)},
        ${sqlString(weekKey)},
        ${sqlString(objective.code)},
        ${sqlString(objective.title)},
        ${sqlString(objective.description)},
        ${sqlString(objective.metricType)},
        ${sqlNumber(objective.targetValue)},
        ${sqlNumber(objective.xpReward)},
        ${sqlNumber(objective.shopCoinReward)},
        ${sqlString(objective.priority)},
        ${sqlString(objective.objectiveType)},
        ${sqlString(objective.metricNote)},
        0,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
      );
    `);
  }
}

async function loadWeeklyObjectives(agentId: number, weekKey: string) {
  return soapSelect<WeeklyObjectiveRow>(`
    SELECT
      AgentWeeklyObjectiveID,
      AgentID,
      WeekKey,
      ObjectiveCode,
      Title,
      Description,
      MetricType,
      TargetValue,
      XPReward,
      ShopCoinReward,
      Priority,
      ObjectiveType,
      MetricNote,
      CurrentValue,
      CompletedAt,
      XPAwarded,
      AwardedAt
    FROM ${TABLES.weeklyObjectives}
    WHERE AgentID = ${sqlNumber(agentId)}
      AND WeekKey = ${sqlString(weekKey)}
    ORDER BY AgentWeeklyObjectiveID;
  `);
}

async function loadMetricValues(agentId: number, weekStart: Date, weekEnd: Date, monthStart: Date, monthEnd: Date, currentStreak: number) {
  const weekStartSql = toSqlDate(weekStart);
  const weekEndSql = toSqlDate(weekEnd);
  const monthStartSql = toSqlDate(monthStart);
  const monthEndSql = toSqlDate(monthEnd);

  const rows = await soapSelect<NumericRow>(`
    SELECT
      (
        SELECT COUNT(*)
        FROM ${TABLES.cases} c
        WHERE c.CurrentOwnerAgentID = ${sqlNumber(agentId)}
          AND ISNULL(c.PaymentReceived, 0) = 0
      ) AS OwnedActiveCases,

      (
        SELECT COUNT(DISTINCT e.DebtCaseID)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyCaseTouches,

      (
        SELECT COUNT(*)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND e.CommunicationType IS NOT NULL
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyCommunications,

      (
        SELECT COUNT(*)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND ISNULL(e.IncludesInvoice, 0) = 1
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyInvoices,

      (
        SELECT COUNT(*)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND ISNULL(e.IncludesFinalDemand, 0) = 1
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyFinalDemands,

      (
        SELECT COUNT(*)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND e.ResolutionType IS NOT NULL
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyResolutions,

      (
        SELECT COUNT(*)
        FROM ${TABLES.events} e
        WHERE e.TriggeredByAgentID = ${sqlNumber(agentId)}
          AND (
            e.Title LIKE '%Escalat%'
            OR e.EventText LIKE '%Escalat%'
            OR e.Reason LIKE '%Escalat%'
          )
          AND e.CreatedAt >= ${weekStartSql}
          AND e.CreatedAt < ${weekEndSql}
      ) AS WeeklyEscalations,

      (
        SELECT SUM(ISNULL(c.TotalOutstanding, 0))
        FROM ${TABLES.cases} c
        WHERE c.CurrentOwnerAgentID = ${sqlNumber(agentId)}
          AND ISNULL(c.PaymentReceived, 0) = 1
          AND c.PaymentReceivedAt >= ${monthStartSql}
          AND c.PaymentReceivedAt < ${monthEndSql}
      ) AS MonthlyRecoveryValue;
  `);

  const row = rows[0] ?? {};

  return {
    OWNED_ACTIVE_CASES: asNumber(row.OwnedActiveCases),
    WEEKLY_CASE_TOUCHES: asNumber(row.WeeklyCaseTouches),
    WEEKLY_COMMUNICATIONS: asNumber(row.WeeklyCommunications),
    WEEKLY_INVOICES: asNumber(row.WeeklyInvoices),
    WEEKLY_FINAL_DEMANDS: asNumber(row.WeeklyFinalDemands),
    WEEKLY_RESOLUTIONS: asNumber(row.WeeklyResolutions),
    WEEKLY_ESCALATIONS: asNumber(row.WeeklyEscalations),
    MONTHLY_RECOVERY_VALUE: asNumber(row.MonthlyRecoveryValue),
    CURRENT_STREAK: currentStreak,
  } satisfies Record<ObjectiveMetricType, number>;
}

async function updateObjectiveProgress(row: WeeklyObjectiveRow, current: number) {
  const target = asNumber(row.TargetValue);
  const isCompleted = current >= target;
  const wasCompleted = Boolean(row.CompletedAt);

  await soapWrite(`
    UPDATE ${TABLES.weeklyObjectives}
    SET
      CurrentValue = ${sqlDecimal(current)},
      CompletedAt = CASE
        WHEN ${isCompleted ? "1" : "0"} = 1 AND CompletedAt IS NULL THEN SYSUTCDATETIME()
        ELSE CompletedAt
      END,
      UpdatedAt = SYSUTCDATETIME()
    WHERE AgentWeeklyObjectiveID = ${sqlNumber(row.AgentWeeklyObjectiveID)};
  `);

  return {
    isCompleted,
    newlyCompleted: isCompleted && !wasCompleted && !asBool(row.XPAwarded),
  };
}

async function markObjectiveAwarded(row: WeeklyObjectiveRow) {
  await soapWrite(`
    UPDATE ${TABLES.weeklyObjectives}
    SET
      XPAwarded = 1,
      AwardedAt = COALESCE(AwardedAt, SYSUTCDATETIME()),
      UpdatedAt = SYSUTCDATETIME()
    WHERE AgentWeeklyObjectiveID = ${sqlNumber(row.AgentWeeklyObjectiveID)};
  `);
}

async function updateAgentProgress(
  agentId: number,
  totalXp: number,
  totalCoins: number,
  awardedCoins: number,
  completedIncrement: number,
) {
  const levelInfo = calculateLevel(totalXp);

  await soapWrite(`
    UPDATE ${TABLES.agents}
    SET
      ExperiencePoints = ${sqlNumber(totalXp)},
      Level = ${sqlNumber(levelInfo.level)},
      ShopCoins = ${sqlNumber(totalCoins)},
      CoinsEarnedLifetime = ISNULL(CoinsEarnedLifetime, 0) + ${sqlNumber(awardedCoins)},
      ObjectivesCompleted = ISNULL(ObjectivesCompleted, 0) + ${sqlNumber(completedIncrement)},
      UpdatedAt = SYSUTCDATETIME()
    WHERE ID = ${sqlNumber(agentId)};
  `);

  return levelInfo;
}

async function buildObjectivePayload(agentId: number) {
  await ensureObjectiveTable();

  const now = new Date();
  const weekKey = getWeekKey(now);
  const weekStart = startOfIsoWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const agentBefore = await getAgent(agentId);
  if (!agentBefore) {
    throw new Error("Agent not found");
  }

  await ensureWeeklyObjectives(agentId, weekKey);

  let weeklyRows = await loadWeeklyObjectives(agentId, weekKey);
  const currentStreak = asNumber(agentBefore.CurrentStreakDays);
  const metricValues = await loadMetricValues(agentId, weekStart, weekEnd, monthStart, monthEnd, currentStreak);

  let awardedXp = 0;
  let awardedCoins = 0;
  let completedIncrement = 0;
  const justCompletedCodes: string[] = [];

  for (const objective of weeklyRows) {
    const metricType = objective.MetricType;
    const current = metricValues[metricType] ?? 0;
    const result = await updateObjectiveProgress(objective, current);

    if (result.newlyCompleted) {
      awardedXp += asNumber(objective.XPReward);
      awardedCoins += asNumber(objective.ShopCoinReward);
      completedIncrement += 1;
      justCompletedCodes.push(String(objective.ObjectiveCode));
      await markObjectiveAwarded(objective);
    }
  }

  const oldXp = asNumber(agentBefore.ExperiencePoints);
  const oldCoins = asNumber(agentBefore.ShopCoins);
  const newXp = oldXp + awardedXp;
  const newCoins = oldCoins + awardedCoins;

  const levelBefore = calculateLevel(oldXp);
  const levelAfter = await updateAgentProgress(agentId, newXp, newCoins, awardedCoins, completedIncrement);
  const agentAfter = await getAgent(agentId);
  weeklyRows = await loadWeeklyObjectives(agentId, weekKey);

  const objectives = weeklyRows.map((row) => {
    const metricType = row.MetricType;
    const current = metricValues[metricType] ?? asNumber(row.CurrentValue);
    const target = asNumber(row.TargetValue);
    const completed = current >= target || Boolean(row.CompletedAt);

    return {
      id: String(row.AgentWeeklyObjectiveID),
      code: String(row.ObjectiveCode),
      title: String(row.Title),
      description: String(row.Description),
      priority: String(row.Priority),
      objectiveType: String(row.ObjectiveType),
      metricType,
      current,
      target,
      progress: progressPercent(current, target),
      xpReward: asNumber(row.XPReward),
      shopCoinReward: asNumber(row.ShopCoinReward),
      completed,
      xpAwarded: asBool(row.XPAwarded),
      completedAt: row.CompletedAt,
      awardedAt: row.AwardedAt,
      currentLabel: currentLabel(metricType, current),
      targetLabel: targetLabel(metricType, target),
      metricNote: String(row.MetricNote ?? ""),
    };
  });

  const profile = {
    agentId,
    agentName: agentAfter?.AgentName ?? agentBefore.AgentName,
    experiencePoints: asNumber(agentAfter?.ExperiencePoints, newXp),
    level: asNumber(agentAfter?.Level, levelAfter.level),
    xpIntoLevel: levelAfter.xpIntoLevel,
    xpToNext: levelAfter.xpToNext,
    xpProgress: levelAfter.xpProgress,
    levelSize: levelAfter.levelSize,
    shopCoins: asNumber(agentAfter?.ShopCoins, newCoins),
    currentStreakDays: asNumber(agentAfter?.CurrentStreakDays, currentStreak),
    longestStreakDays: asNumber(agentAfter?.LongestStreakDays),
    objectivesCompleted: asNumber(agentAfter?.ObjectivesCompleted),
  };

  return {
    profile,
    week: {
      weekKey,
      startsAt: weekStart.toISOString(),
      endsAt: weekEnd.toISOString(),
      objectivePoolIndex: Math.abs(Number(weekKey.split("-W")[1] || 1)) % OBJECTIVE_POOLS.length,
    },
    awards: {
      xpAwarded: awardedXp,
      shopCoinsAwarded: awardedCoins,
      completedCount: completedIncrement,
      justCompletedCodes,
      leveledUp: levelAfter.level > levelBefore.level,
      previousLevel: levelBefore.level,
      currentLevel: levelAfter.level,
    },
    metrics: metricValues,
    objectives,
    summary: {
      completedObjectivesCount: objectives.filter((item) => item.completed).length,
      totalObjectivesCount: objectives.length,
      possibleXpRemaining: objectives
        .filter((item) => !item.completed)
        .reduce((sum, item) => sum + item.xpReward, 0),
      possibleCoinsRemaining: objectives
        .filter((item) => !item.completed)
        .reduce((sum, item) => sum + item.shopCoinReward, 0),
    },
  };
}

function parseAgentId(req: Request) {
  const raw = req.params.agentId ?? req.query.agentId ?? (req as any).user?.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export class ObjectivesController {
  /**
   * GET /api/debt-manager/objectives/:agentId
   *
   * Creates this week's objectives if missing, recalculates live progress,
   * awards newly completed objectives once, and recalculates level from total XP.
   */
  static async getAgentObjectives(req: Request, res: Response) {
    try {
      const agentId = parseAgentId(req);

      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: "Agent id required",
        });
      }

      const data = await buildObjectivePayload(agentId);

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("getAgentObjectives error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load objectives",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * POST /api/debt-manager/objectives/:agentId/refresh
   *
   * Same calculation as GET. Kept as an explicit button endpoint for the frontend.
   */
  static async refreshAgentObjectives(req: Request, res: Response) {
    return ObjectivesController.getAgentObjectives(req, res);
  }
}
