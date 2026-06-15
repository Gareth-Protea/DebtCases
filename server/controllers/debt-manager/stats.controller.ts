import type { Request, Response } from "express";
import { soapSelect } from "../../lib/debt-case-soap";

/**
 * Statistics controller gathers aggregate information about the debt collection
 * operation. It powers the redesigned reports page and provides data for
 * summary cards on the master list page. The queries here are simplified
 * snapshots and could be refined to match business requirements.
 */
export class StatsController {
  /**
   * GET /api/debt-manager/stats
   * Returns high level metrics used by the reports page. Values include:
   * - collectedThisMonth: total amount recovered in the current month
   * - openDebtors: number of open cases (unpaid and not closed)
   * - taskCompletionRate: percentage of completed tasks out of all tasks
   * - targetAttainment: ratio of collected amount to outstanding amount
   * - statusCounts: dictionary of workflow status names to counts
   */
  static async getSummary(req: Request, res: Response) {
    try {
      // Compute the start of the current month for filtering.
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthStartIso = monthStart.toISOString();

      // Total amount recovered this month.
      const collectedRows = await soapSelect<{ SumTotal: string | number }>(
        `SELECT SUM(ISNULL(TotalOutstanding,0)) AS SumTotal FROM [TestMetermisDB].[dbo].[DebtCase] WHERE PaymentReceived = 1 AND PaymentReceivedAt >= CAST(N'${monthStartIso}' AS DATETIME2)`,
      );
      const collectedThisMonth = Number(collectedRows[0]?.SumTotal ?? 0);

      // Number of open debtors: cases not paid and not closed.
      const openRows = await soapSelect<{ Count: string | number }>(
        `SELECT COUNT(*) AS Count FROM [TestMetermisDB].[dbo].[DebtCase] WHERE ISNULL(PaymentReceived,0) = 0 AND ClosedAt IS NULL`,
      );
      const openDebtors = Number(openRows[0]?.Count ?? 0);

      // Task completion: ratio of completed tasks to all tasks in DebtCaseEvent where IsTaskType = 1.
      const taskRows = await soapSelect<{ Total: string | number; Completed: string | number }>(
        `SELECT COUNT(*) AS Total, SUM(CASE WHEN TaskStatus = 'COMPLETED' THEN 1 ELSE 0 END) AS Completed FROM [TestMetermisDB].[dbo].[DebtCaseEvent] WHERE TaskStatus IS NOT NULL`,
      );
      const totalTasks = Number(taskRows[0]?.Total ?? 0);
      const completedTasks = Number(taskRows[0]?.Completed ?? 0);
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Target attainment: total recovered vs total outstanding across all cases. Guard against division by zero.
      const outstandingRows = await soapSelect<{ SumOutstanding: string | number; SumRecovered: string | number }>(
        `SELECT SUM(ISNULL(TotalOutstanding,0)) AS SumOutstanding, SUM(CASE WHEN PaymentReceived = 1 THEN ISNULL(TotalOutstanding,0) ELSE 0 END) AS SumRecovered FROM [TestMetermisDB].[dbo].[DebtCase]`,
      );
      const sumOutstanding = Number(outstandingRows[0]?.SumOutstanding ?? 0);
      const sumRecovered = Number(outstandingRows[0]?.SumRecovered ?? 0);
      const targetAttainment = sumOutstanding > 0 ? Math.round((sumRecovered / sumOutstanding) * 100) : 0;

      // Count cases by workflow status. We normalise names to uppercase for consistency.
      const statusRows = await soapSelect<{ StatusName: string; Count: string | number }>(
        `SELECT UPPER(ISNULL(s.StatusName,'UNASSIGNED')) AS StatusName, COUNT(*) AS Count FROM [TestMetermisDB].[dbo].[DebtCase] c LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseStatus] s ON s.StatusID = c.CurrentStatusID WHERE ClosedAt IS NULL GROUP BY UPPER(ISNULL(s.StatusName,'UNASSIGNED'))`,
      );
      const statusCounts: Record<string, number> = {};
      statusRows.forEach((row) => {
        const name = String(row.StatusName || "UNASSIGNED").trim().toUpperCase();
        statusCounts[name] = Number(row.Count ?? 0);
      });

      return res.json({
        success: true,
        data: {
          collectedThisMonth,
          openDebtors,
          taskCompletionRate,
          targetAttainment,
          statusCounts,
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
      const agentId = Number.isFinite(agentIdParam)
        ? agentIdParam
        : Number((req as any).user?.id ?? NaN);
      if (!Number.isFinite(agentId)) {
        return res.status(400).json({ success: false, message: "Agent id required" });
      }
      const rows = await soapSelect<{ ExperiencePoints: string | number; Level: string | number; ShopCoins: string | number }>(
        `SELECT ISNULL(ExperiencePoints,0) AS ExperiencePoints, ISNULL(Level,1) AS Level, ISNULL(ShopCoins,0) AS ShopCoins FROM [TestMetermisDB].[dbo].[DebtCaseAgents] WHERE ID = ${agentId}`,
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: "Agent not found" });
      }
      const row = rows[0];
      const experiencePoints = Number(row.ExperiencePoints ?? 0);
      const level = Number(row.Level ?? 1);
      const shopCoins = Number(row.ShopCoins ?? 0);
      return res.json({ success: true, data: { experiencePoints, level, shopCoins } });
    } catch (error) {
      console.error("getAgentStats error:", error);
      return res.status(500).json({ success: false, message: "Failed to load agent stats" });
    }
  }
}