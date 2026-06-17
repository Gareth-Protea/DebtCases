import type { Request, Response } from "express";
import { soapSelect, toSqlDateTime } from "../../lib/debt-case-soap";

type NumericRow = Record<string, string | number | null | undefined>;

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asPercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function normalizeKey(value: unknown, fallback = "UNKNOWN") {
  const text = String(value ?? fallback).trim();
  return text ? text.toUpperCase() : fallback;
}

function rowsToCountMap(rows: Array<Record<string, unknown>>, keyField: string, valueField = "Count") {
  const result: Record<string, number> = {};
  for (const row of rows) result[normalizeKey(row[keyField])] = asNumber(row[valueField]);
  return result;
}

function rowsToChart(rows: Array<Record<string, unknown>>, nameField: string, valueField = "Count", valueName = "count") {
  return rows.map((row) => ({
    name: String(row[nameField] ?? "Unknown"),
    [valueName]: asNumber(row[valueField]),
  }));
}

function parseDateRange(req: Request) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const startParam = typeof req.query.start === "string" ? req.query.start : undefined;
  const endParam = typeof req.query.end === "string" ? req.query.end : undefined;
  const parsedStart = startParam ? new Date(startParam) : defaultStart;
  const parsedEnd = endParam ? new Date(endParam) : now;
  const startDate = Number.isNaN(parsedStart.getTime()) ? defaultStart : parsedStart;
  const rawEndDate = Number.isNaN(parsedEnd.getTime()) ? now : parsedEnd;
  const endDate = endParam
    ? new Date(rawEndDate.getFullYear(), rawEndDate.getMonth(), rawEndDate.getDate(), 23, 59, 59, 999)
    : rawEndDate;

  if (startDate > endDate) {
    return {
      startDate: endDate,
      endDate: startDate,
      startSql: toSqlDateTime(endDate),
      endSql: toSqlDateTime(startDate),
    };
  }

  return {
    startDate,
    endDate,
    startSql: toSqlDateTime(startDate),
    endSql: toSqlDateTime(endDate),
  };
}

/**
 * IMPORTANT MONEY NOTE:
 * Verified income is intentionally not calculated from DebtCase.PaymentReceived.
 * That field is user-marked and can be wrong. When you provide the real company
 * transaction query, replace this function only; the reports page already reads
 * from income.verifiedIncome.
 */
async function getVerifiedDebtCollectionIncome(startSql: string, endSql: string) {
  return {
    verifiedIncome: 0,
    transactionCount: 0,
    source: "PENDING_TRANSACTION_QUERY",
    note:
      "Verified income is waiting for the company transaction query. User-marked payment flags are excluded from income.",
    startSql,
    endSql,
  };
}

export class StatsController {
  /**
   * GET /api/debt-manager/stats?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  static async getSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate, startSql, endSql } = parseDateRange(req);
      const verifiedIncome = await getVerifiedDebtCollectionIncome(startSql, endSql);

      const overviewRows = await soapSelect<NumericRow>(`
        SELECT
          COUNT(*) AS TotalCases,
          SUM(CASE WHEN ClosedAt IS NULL THEN 1 ELSE 0 END) AS ActiveCases,
          SUM(CASE WHEN ClosedAt IS NOT NULL THEN 1 ELSE 0 END) AS ClosedCases,
          SUM(CASE WHEN ISNULL(PaymentReceived,0) = 0 AND ClosedAt IS NULL THEN 1 ELSE 0 END) AS OpenDebtors,
          SUM(ISNULL(TotalOutstanding,0)) AS TotalOutstandingValue,
          AVG(CAST(ISNULL(TotalOutstanding,0) AS FLOAT)) AS AverageOutstandingValue,
          SUM(CASE WHEN ISNULL(TotalOutstanding,0) >= 50000 THEN 1 ELSE 0 END) AS HighValueCases,
          SUM(CASE WHEN CurrentOwnerAgentID IS NULL AND ClosedAt IS NULL THEN 1 ELSE 0 END) AS UnassignedOpenCases,
          SUM(CASE WHEN ArrangementActive = 1 AND ClosedAt IS NULL THEN 1 ELSE 0 END) AS ActiveArrangements,
          SUM(CASE WHEN EscalatedToSuperior = 1 AND ClosedAt IS NULL THEN 1 ELSE 0 END) AS EscalatedOpenCases
        FROM [TestMetermisDB].[dbo].[DebtCase]
      `);
      const o = overviewRows[0] ?? {};
      const totalCases = asNumber(o.TotalCases);
      const activeCases = asNumber(o.ActiveCases);
      const closedCases = asNumber(o.ClosedCases);
      const openDebtors = asNumber(o.OpenDebtors);
      const totalOutstandingValue = asNumber(o.TotalOutstandingValue);
      const averageOutstandingValue = asNumber(o.AverageOutstandingValue);
      const highValueCases = asNumber(o.HighValueCases);
      const unassignedOpenCases = asNumber(o.UnassignedOpenCases);
      const activeArrangements = asNumber(o.ActiveArrangements);
      const escalatedOpenCases = asNumber(o.EscalatedOpenCases);

      const newCaseRows = await soapSelect<NumericRow>(`
        SELECT COUNT(*) AS NewCases, SUM(ISNULL(TotalOutstanding,0)) AS NewCaseValue
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE CreatedAt >= ${startSql} AND CreatedAt <= ${endSql}
      `);
      const newCasesInRange = asNumber(newCaseRows[0]?.NewCases);
      const newCaseValueInRange = asNumber(newCaseRows[0]?.NewCaseValue);

      const actionRows = await soapSelect<NumericRow>(`
        SELECT
          SUM(CASE WHEN InvoiceSentAt >= ${startSql} AND InvoiceSentAt <= ${endSql} THEN 1 ELSE 0 END) AS InvoicesSent,
          SUM(CASE WHEN FinalDemandSentAt >= ${startSql} AND FinalDemandSentAt <= ${endSql} THEN 1 ELSE 0 END) AS FinalDemandsSent,
          SUM(CASE WHEN EscalatedToSuperiorAt >= ${startSql} AND EscalatedToSuperiorAt <= ${endSql} THEN 1 ELSE 0 END) AS SuperiorEscalations,
          SUM(CASE WHEN ResolutionChosenAt >= ${startSql} AND ResolutionChosenAt <= ${endSql} THEN 1 ELSE 0 END) AS ResolutionsChosen,
          SUM(CASE WHEN PaymentReceivedAt >= ${startSql} AND PaymentReceivedAt <= ${endSql} THEN 1 ELSE 0 END) AS PaymentMarkers
        FROM [TestMetermisDB].[dbo].[DebtCase]
      `);
      const operationalActions = {
        invoicesSent: asNumber(actionRows[0]?.InvoicesSent),
        finalDemandsSent: asNumber(actionRows[0]?.FinalDemandsSent),
        superiorEscalations: asNumber(actionRows[0]?.SuperiorEscalations),
        resolutionsChosen: asNumber(actionRows[0]?.ResolutionsChosen),
        paymentMarkers: asNumber(actionRows[0]?.PaymentMarkers),
      };

      const unverifiedPaymentRows = await soapSelect<NumericRow>(`
        SELECT COUNT(*) AS MarkerCount, SUM(ISNULL(TotalOutstanding,0)) AS MarkerValue
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE PaymentReceived = 1 AND PaymentReceivedAt >= ${startSql} AND PaymentReceivedAt <= ${endSql}
      `);
      const unverifiedPaymentMarkers = {
        count: asNumber(unverifiedPaymentRows[0]?.MarkerCount),
        value: asNumber(unverifiedPaymentRows[0]?.MarkerValue),
        includedInIncome: false,
      };

      const taskRows = await soapSelect<NumericRow>(`
        SELECT
          COUNT(*) AS TotalTasks,
          SUM(CASE WHEN TaskStatus = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedTasks,
          SUM(CASE WHEN TaskStatus = 'OPEN' THEN 1 ELSE 0 END) AS OpenTasks,
          SUM(CASE WHEN DueAt IS NOT NULL AND CompletedAt IS NULL AND DueAt < SYSUTCDATETIME() THEN 1 ELSE 0 END) AS OverdueTasks
        FROM [TestMetermisDB].[dbo].[DebtCaseEvent]
        WHERE TaskStatus IS NOT NULL
      `);
      const totalTasks = asNumber(taskRows[0]?.TotalTasks);
      const completedTasks = asNumber(taskRows[0]?.CompletedTasks);
      const openTasks = asNumber(taskRows[0]?.OpenTasks);
      const overdueTasks = asNumber(taskRows[0]?.OverdueTasks);
      const taskCompletionRate = asPercent(completedTasks, totalTasks);

      const statusRows = await soapSelect<{ StatusName: string; Count: string | number }>(`
        SELECT UPPER(ISNULL(s.StatusName,'UNASSIGNED')) AS StatusName, COUNT(*) AS Count
        FROM [TestMetermisDB].[dbo].[DebtCase] c
        LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseStatus] s ON s.StatusID = c.CurrentStatusID
        WHERE c.ClosedAt IS NULL
        GROUP BY UPPER(ISNULL(s.StatusName,'UNASSIGNED'))
      `);
      const statusCounts = rowsToCountMap(statusRows, "StatusName");
      const statusDistribution = rowsToChart(statusRows, "StatusName");

      const statusValueRows = await soapSelect<{ StatusName: string; TotalValue: string | number; Count: string | number }>(`
        SELECT UPPER(ISNULL(s.StatusName,'UNASSIGNED')) AS StatusName, COUNT(*) AS Count, SUM(ISNULL(c.TotalOutstanding,0)) AS TotalValue
        FROM [TestMetermisDB].[dbo].[DebtCase] c
        LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseStatus] s ON s.StatusID = c.CurrentStatusID
        WHERE c.ClosedAt IS NULL
        GROUP BY UPPER(ISNULL(s.StatusName,'UNASSIGNED'))
      `);
      const statusValueDistribution = statusValueRows.map((row) => ({
        name: String(row.StatusName ?? "UNKNOWN"),
        count: asNumber(row.Count),
        value: asNumber(row.TotalValue),
      }));

      const waitingRows = await soapSelect<{ StatusName: string; Count: string | number; TotalValue: string | number }>(`
        SELECT UPPER(ISNULL(s.StatusName,'UNKNOWN')) AS StatusName, COUNT(*) AS Count, SUM(ISNULL(c.TotalOutstanding,0)) AS TotalValue
        FROM [TestMetermisDB].[dbo].[DebtCase] c
        JOIN [TestMetermisDB].[dbo].[DebtCaseStatus] s ON s.StatusID = c.CurrentStatusID
        WHERE s.StatusName IN ('REMINDER_7D','FOLLOW_UP_7D','REMINDER_14D') AND c.ClosedAt IS NULL
        GROUP BY UPPER(ISNULL(s.StatusName,'UNKNOWN'))
      `);
      const waitingBreakdown = waitingRows.map((row) => ({
        name: String(row.StatusName ?? "UNKNOWN"),
        count: asNumber(row.Count),
        value: asNumber(row.TotalValue),
      }));
      const waitingCount = waitingBreakdown.reduce((sum, item) => sum + item.count, 0);
      const waitingValue = waitingBreakdown.reduce((sum, item) => sum + item.value, 0);

      const contactRows = await soapSelect<{ CommType: string; Count: string | number }>(`
        SELECT UPPER(ISNULL(CommunicationType,'UNKNOWN')) AS CommType, COUNT(*) AS Count
        FROM [TestMetermisDB].[dbo].[DebtCaseEvent]
        WHERE EventTypeID = 4 AND CreatedAt >= ${startSql} AND CreatedAt <= ${endSql}
        GROUP BY UPPER(ISNULL(CommunicationType,'UNKNOWN'))
      `);
      const contactCounts = rowsToCountMap(contactRows, "CommType");
      const contactAttemptsByType = rowsToChart(contactRows, "CommType");
      const totalContactAttempts = contactAttemptsByType.reduce((sum, item: any) => sum + asNumber(item.count), 0);

      const contactOutcomeRows = await soapSelect<{ Outcome: string; Count: string | number }>(`
        SELECT CASE WHEN SuccessFlag = 1 THEN 'SUCCESS' WHEN SuccessFlag = 0 THEN 'FAILED' ELSE 'UNKNOWN' END AS Outcome, COUNT(*) AS Count
        FROM [TestMetermisDB].[dbo].[DebtCaseEvent]
        WHERE EventTypeID = 4 AND CreatedAt >= ${startSql} AND CreatedAt <= ${endSql}
        GROUP BY CASE WHEN SuccessFlag = 1 THEN 'SUCCESS' WHEN SuccessFlag = 0 THEN 'FAILED' ELSE 'UNKNOWN' END
      `);
      const contactOutcomes = rowsToChart(contactOutcomeRows, "Outcome");
      const successfulContacts = contactOutcomeRows.filter((r) => String(r.Outcome).toUpperCase() === "SUCCESS").reduce((sum, r) => sum + asNumber(r.Count), 0);
      const failedContacts = contactOutcomeRows.filter((r) => String(r.Outcome).toUpperCase() === "FAILED").reduce((sum, r) => sum + asNumber(r.Count), 0);
      const contactSuccessRate = asPercent(successfulContacts, successfulContacts + failedContacts);

      const dailyContactRows = await soapSelect<{ Day: string; Count: string | number }>(`
        SELECT CONVERT(varchar(10), CreatedAt, 120) AS Day, COUNT(*) AS Count
        FROM [TestMetermisDB].[dbo].[DebtCaseEvent]
        WHERE EventTypeID = 4 AND CreatedAt >= ${startSql} AND CreatedAt <= ${endSql}
        GROUP BY CONVERT(varchar(10), CreatedAt, 120)
        ORDER BY Day
      `);
      const dailyContactTrend = dailyContactRows.map((row) => ({ day: String(row.Day), count: asNumber(row.Count) }));

      const priorityRows = await soapSelect<{ Priority: string; Count: string | number; TotalValue: string | number }>(`
        SELECT ISNULL(Priority,'Unknown') AS Priority, COUNT(*) AS Count, SUM(ISNULL(TotalOutstanding,0)) AS TotalValue
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE ClosedAt IS NULL
        GROUP BY ISNULL(Priority,'Unknown')
      `);
      const priorityDistribution = priorityRows.map((row) => ({ name: String(row.Priority ?? "Unknown"), count: asNumber(row.Count), value: asNumber(row.TotalValue) }));

      const pathRows = await soapSelect<{ RecommendedPath: string; Count: string | number; TotalValue: string | number }>(`
        SELECT ISNULL(RecommendedPath,'Unknown') AS RecommendedPath, COUNT(*) AS Count, SUM(ISNULL(TotalOutstanding,0)) AS TotalValue
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE ClosedAt IS NULL
        GROUP BY ISNULL(RecommendedPath,'Unknown')
      `);
      const recommendedPathDistribution = pathRows.map((row) => ({ name: String(row.RecommendedPath ?? "Unknown"), count: asNumber(row.Count), value: asNumber(row.TotalValue) }));

      const ageBucketRows = await soapSelect<{ Bucket: string; Count: string | number; TotalValue: string | number }>(`
        SELECT CASE
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 30 THEN '0-29 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 60 THEN '30-59 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 90 THEN '60-89 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 180 THEN '90-179 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 365 THEN '180-364 days'
            ELSE '365+ days'
          END AS Bucket, COUNT(*) AS Count, SUM(ISNULL(TotalOutstanding,0)) AS TotalValue
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE ClosedAt IS NULL AND TerminationDate IS NOT NULL
        GROUP BY CASE
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 30 THEN '0-29 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 60 THEN '30-59 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 90 THEN '60-89 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 180 THEN '90-179 days'
            WHEN DATEDIFF(DAY, TerminationDate, SYSUTCDATETIME()) < 365 THEN '180-364 days'
            ELSE '365+ days'
          END
      `);
      const ageBuckets = ageBucketRows.map((row) => ({ name: String(row.Bucket ?? "Unknown"), count: asNumber(row.Count), value: asNumber(row.TotalValue) }));

      const resolutionRows = await soapSelect<{ ResolutionType: string; Count: string | number }>(`
        SELECT ISNULL(ResolutionType,'Unknown') AS ResolutionType, COUNT(*) AS Count
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE ResolutionChosenAt >= ${startSql} AND ResolutionChosenAt <= ${endSql}
        GROUP BY ISNULL(ResolutionType,'Unknown')
      `);
      const resolutionDistribution = rowsToChart(resolutionRows, "ResolutionType");

      const agentWorkloadRows = await soapSelect<{ AgentName: string; OpenCases: string | number; OpenValue: string | number }>(`
        SELECT ISNULL(a.AgentName,'Unassigned') AS AgentName, COUNT(c.DebtCaseID) AS OpenCases, SUM(ISNULL(c.TotalOutstanding,0)) AS OpenValue
        FROM [TestMetermisDB].[dbo].[DebtCase] c
        LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseAgents] a ON a.ID = c.CurrentOwnerAgentID
        WHERE c.ClosedAt IS NULL
        GROUP BY ISNULL(a.AgentName,'Unassigned')
        ORDER BY OpenValue DESC
      `);
      const agentWorkload = agentWorkloadRows.map((row) => ({ agent: String(row.AgentName ?? "Unassigned"), openCases: asNumber(row.OpenCases), value: asNumber(row.OpenValue) }));

      const agentPerformanceRows = await soapSelect<{ AgentName: string; Events: string | number; Contacts: string | number; SuccessfulContacts: string | number; FailedContacts: string | number; CompletedTasks: string | number }>(`
        SELECT ISNULL(a.AgentName,'Unknown') AS AgentName, COUNT(e.DebtCaseEventID) AS Events,
          SUM(CASE WHEN e.EventTypeID = 4 THEN 1 ELSE 0 END) AS Contacts,
          SUM(CASE WHEN e.EventTypeID = 4 AND e.SuccessFlag = 1 THEN 1 ELSE 0 END) AS SuccessfulContacts,
          SUM(CASE WHEN e.EventTypeID = 4 AND e.SuccessFlag = 0 THEN 1 ELSE 0 END) AS FailedContacts,
          SUM(CASE WHEN e.TaskStatus = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedTasks
        FROM [TestMetermisDB].[dbo].[DebtCaseAgents] a
        LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseEvent] e ON e.TriggeredByAgentID = a.ID AND e.CreatedAt >= ${startSql} AND e.CreatedAt <= ${endSql}
        GROUP BY ISNULL(a.AgentName,'Unknown')
        ORDER BY Contacts DESC
      `);
      const agentPerformance = agentPerformanceRows.map((row) => ({
        agent: String(row.AgentName ?? "Unknown"),
        events: asNumber(row.Events),
        contacts: asNumber(row.Contacts),
        successfulContacts: asNumber(row.SuccessfulContacts),
        failedContacts: asNumber(row.FailedContacts),
        completedTasks: asNumber(row.CompletedTasks),
        successRate: asPercent(asNumber(row.SuccessfulContacts), asNumber(row.SuccessfulContacts) + asNumber(row.FailedContacts)),
      }));

      const firstResponseCaseRows = await soapSelect<{ DebtCaseID: string | number; CreatedAt: string }>(`
        SELECT DebtCaseID, CreatedAt FROM [TestMetermisDB].[dbo].[DebtCase] WHERE CreatedAt IS NOT NULL
      `);
      const firstResponseEventRows = await soapSelect<{ DebtCaseID: string | number; CreatedAt: string }>(`
        SELECT DebtCaseID, CreatedAt FROM [TestMetermisDB].[dbo].[DebtCaseEvent] WHERE EventTypeID = 4 AND CreatedAt IS NOT NULL
      `);
      const caseCreatedAt = new Map<string, Date>();
      for (const row of firstResponseCaseRows) {
        const date = new Date(row.CreatedAt);
        if (!Number.isNaN(date.getTime())) caseCreatedAt.set(String(row.DebtCaseID), date);
      }
      const firstContactAt = new Map<string, Date>();
      for (const row of firstResponseEventRows) {
        const date = new Date(row.CreatedAt);
        const key = String(row.DebtCaseID);
        if (Number.isNaN(date.getTime())) continue;
        const existing = firstContactAt.get(key);
        if (!existing || date < existing) firstContactAt.set(key, date);
      }
      const responseHours: number[] = [];
      let responsesWithin24h = 0;
      for (const [caseId, createdAt] of caseCreatedAt.entries()) {
        const contactAt = firstContactAt.get(caseId);
        if (!contactAt) continue;
        const hours = (contactAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hours >= 0) {
          responseHours.push(hours);
          if (hours <= 24) responsesWithin24h += 1;
        }
      }
      const avgFirstResponseHours = responseHours.length ? responseHours.reduce((sum, value) => sum + value, 0) / responseHours.length : 0;
      const responseWithin24hRate = asPercent(responsesWithin24h, responseHours.length);

      const closureRows = await soapSelect<{ ClosedAt: string; PaymentReceivedAt: string; TerminationDate: string }>(`
        SELECT ClosedAt, PaymentReceivedAt, TerminationDate FROM [TestMetermisDB].[dbo].[DebtCase] WHERE TerminationDate IS NOT NULL
      `);
      const closeDays: number[] = [];
      const markedPaymentDays: number[] = [];
      for (const row of closureRows) {
        const terminated = new Date(row.TerminationDate);
        if (Number.isNaN(terminated.getTime())) continue;
        if (row.ClosedAt) {
          const closed = new Date(row.ClosedAt);
          if (!Number.isNaN(closed.getTime())) {
            const days = (closed.getTime() - terminated.getTime()) / (1000 * 60 * 60 * 24);
            if (days >= 0) closeDays.push(days);
          }
        }
        if (row.PaymentReceivedAt) {
          const paid = new Date(row.PaymentReceivedAt);
          if (!Number.isNaN(paid.getTime())) {
            const days = (paid.getTime() - terminated.getTime()) / (1000 * 60 * 60 * 24);
            if (days >= 0) markedPaymentDays.push(days);
          }
        }
      }
      const avgDaysToClose = closeDays.length ? closeDays.reduce((sum, value) => sum + value, 0) / closeDays.length : 0;
      const avgDaysToMarkedPayment = markedPaymentDays.length ? markedPaymentDays.reduce((sum, value) => sum + value, 0) / markedPaymentDays.length : 0;
      const targetAttainment = totalOutstandingValue > 0 ? Math.round((verifiedIncome.verifiedIncome / totalOutstandingValue) * 100) : 0;

      return res.json({
        success: true,
        data: {
          dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          collectedIncome: verifiedIncome.verifiedIncome,
          income: {
            verifiedIncome: verifiedIncome.verifiedIncome,
            transactionCount: verifiedIncome.transactionCount,
            source: verifiedIncome.source,
            note: verifiedIncome.note,
            unverifiedPaymentMarkers,
          },
          openDebtors,
          taskCompletionRate,
          targetAttainment,
          statusCounts,
          contactCounts,
          avgPaidDays: avgDaysToMarkedPayment,
          avgClosedDays: avgDaysToClose,
          waitingCount,
          overview: {
            totalCases,
            activeCases,
            closedCases,
            openDebtors,
            totalOutstandingValue,
            averageOutstandingValue,
            highValueCases,
            unassignedOpenCases,
            activeArrangements,
            escalatedOpenCases,
            newCasesInRange,
            newCaseValueInRange,
          },
          productivity: {
            totalTasks,
            completedTasks,
            openTasks,
            overdueTasks,
            taskCompletionRate,
            totalContactAttempts,
            successfulContacts,
            failedContacts,
            contactSuccessRate,
            avgFirstResponseHours,
            responseWithin24hRate,
            avgDaysToClose,
            avgDaysToMarkedPayment,
          },
          operationalActions,
          workflow: {
            statusDistribution,
            statusValueDistribution,
            waitingBreakdown,
            waitingValue,
            priorityDistribution,
            recommendedPathDistribution,
            ageBuckets,
            resolutionDistribution,
          },
          charts: {
            statusDistribution,
            statusValueDistribution,
            waitingBreakdown,
            contactAttemptsByType,
            contactOutcomes,
            dailyContactTrend,
            priorityDistribution,
            recommendedPathDistribution,
            ageBuckets,
            resolutionDistribution,
            agentWorkload,
            agentPerformance,
          },
        },
      });
    } catch (error) {
      console.error("getSummary error:", error);
      return res.status(500).json({ success: false, message: "Failed to compute stats" });
    }
  }

  /**
   * GET /api/debt-manager/agent-stats/:id?
   * Returns experience, level and shop coin information for a given agent. If
   * the id param is omitted this falls back to the logged in user id (if
   * provided via req.user). The shape matches the front end expectations.
   */
  static async getAgentStats(req: Request, res: Response) {
    try {
      const agentIdParam = Number(req.params.id ?? req.query.id ?? NaN);
      const agentId = Number.isFinite(agentIdParam) ? agentIdParam : Number((req as any).user?.id ?? NaN);
      if (!Number.isFinite(agentId)) {
        return res.status(400).json({ success: false, message: "Agent id required" });
      }
      const rows = await soapSelect<{ ExperiencePoints: string | number; Level: string | number; ShopCoins: string | number }>(
        `SELECT ISNULL(ExperiencePoints,0) AS ExperiencePoints, ISNULL(Level,1) AS Level, ISNULL(ShopCoins,0) AS ShopCoins FROM [TestMetermisDB].[dbo].[DebtCaseAgents] WHERE ID = ${agentId}`,
      );
      if (!rows.length) return res.status(404).json({ success: false, message: "Agent not found" });
      const row = rows[0];
      return res.json({
        success: true,
        data: {
          experiencePoints: Number(row.ExperiencePoints ?? 0),
          level: Number(row.Level ?? 1),
          shopCoins: Number(row.ShopCoins ?? 0),
        },
      });
    } catch (error) {
      console.error("getAgentStats error:", error);
      return res.status(500).json({ success: false, message: "Failed to load agent stats" });
    }
  }
}
