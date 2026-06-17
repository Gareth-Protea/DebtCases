import type { Request, Response } from "express";
import {
  getSettings,
  updateSettings,
  ensureStatusExists,
} from "../../config/managerSettings";
import { soapWrite, soapSelect, toSqlNVarChar, toSqlDateTime, toSqlInt, toSqlDecimal, toSqlBit } from "../../lib/debt-case-soap";

/*
 * NOTE: The SQL import logic previously used a single monolithic T‑SQL script
 * containing variable declarations, CTEs and a transaction block. However,
 * the SOAP service hosting Metermis imposes strict safety rules: only
 * standalone INSERT/UPDATE/DELETE statements are permitted and most other
 * SQL verbs (e.g. DECLARE, BEGIN, TRY/CATCH) are rejected as unsafe.
 *
 * To work within these constraints, we implement the import logic in
 * JavaScript. We first calculate how many cases need to be imported for
 * each agent and the unassigned pool. We then issue a SELECT query to
 * calculate and rank eligible cases using CTEs (which are safe in SELECT
 * statements). Finally, for each selected case we construct an individual
 * INSERT statement and send it to the SOAP service using soapWrite().
 *
 * This approach avoids any dangerous SQL verbs while preserving the
 * business logic of the original stored procedure. It may involve more
 * round‑trip calls but ensures compatibility with the SOAP safety checks.
 */

/**
 * Controller to expose and modify the manager‑configurable settings. These
 * settings determine how many new cases are imported per day, how many open
 * cases an agent may hold and how large the unassigned pool should be. The
 * endpoints are namespaced under /api/debt-manager for consistency with
 * existing routes.
 */
export class ManagerSettingsController {
  /**
   * GET /api/debt-manager/settings
   * Return the current settings to the client. Useful for populating a
   * management UI. Response format mirrors the ManagerSettings type.
   */
  static async getSettings(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: getSettings() });
    } catch (error) {
      console.error("getSettings error:", error);
      return res.status(500).json({ success: false, message: "Failed to load settings" });
    }
  }

  /**
   * POST /api/debt-manager/settings
   * Update one or more settings. The request body may include any subset of
   * ManagerSettings properties. The response returns the updated settings.
   */
  static async updateSettings(req: Request, res: Response) {
    try {
      const partial: any = {};
      if (req.body.dailyTargetPerAgent !== undefined) {
        const n = Number(req.body.dailyTargetPerAgent);
        if (Number.isFinite(n) && n >= 0) partial.dailyTargetPerAgent = n;
      }
      if (req.body.maxOpenCasesPerAgent !== undefined) {
        const n = Number(req.body.maxOpenCasesPerAgent);
        if (Number.isFinite(n) && n >= 0) partial.maxOpenCasesPerAgent = n;
      }
      if (req.body.targetUnassignedPool !== undefined) {
        const n = Number(req.body.targetUnassignedPool);
        if (Number.isFinite(n) && n >= 0) partial.targetUnassignedPool = n;
      }
      const updated = updateSettings(partial);
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error("updateSettings error:", error);
      return res.status(500).json({ success: false, message: "Failed to update settings" });
    }
  }

  /**
   * POST /api/debt-manager/import
   * Trigger the daily import logic. Reads the Big Query script, substitutes
   * the manager settings and executes it via the soap service. The script is
   * idempotent and will assign new cases according to the configured limits.
   */
  static async runImport(req: Request, res: Response) {
    try {
      // Ensure the custom follow up status exists before importing. This
      // call is a no‑op if the status already exists.
      await ensureStatusExists("FOLLOW_UP_7D", "7 day follow up wait");
      const settings = getSettings();
      // Read settings into local variables
      const dailyTarget = Number(settings.dailyTargetPerAgent) || 0;
      const maxOpen = Number(settings.maxOpenCasesPerAgent) || 0;
      const targetUnassigned = Number(settings.targetUnassignedPool) || 0;

      // Determine current open case counts for Agent 1, Agent 4 and Unassigned.
      // If the counts cannot be retrieved for any reason, default to zero so
      // that the import does not create excessive cases. These queries are
      // read‑only and therefore safe for the SOAP service.
      const agent1OpenRows = await soapSelect<{ count: number }>(
        `SELECT COUNT(*) AS count FROM [TestMetermisDB].[dbo].[DebtCase] WHERE CurrentOwnerAgentID = 1 AND ClosedAt IS NULL`);
      const agent4OpenRows = await soapSelect<{ count: number }>(
        `SELECT COUNT(*) AS count FROM [TestMetermisDB].[dbo].[DebtCase] WHERE CurrentOwnerAgentID = 4 AND ClosedAt IS NULL`);
      const unassignedOpenRows = await soapSelect<{ count: number }>(
        `SELECT COUNT(*) AS count FROM [TestMetermisDB].[dbo].[DebtCase] WHERE CurrentOwnerAgentID IS NULL AND ClosedAt IS NULL`);

      const agent1CurrentOpen = agent1OpenRows[0]?.count ?? 0;
      const agent4CurrentOpen = agent4OpenRows[0]?.count ?? 0;
      const currentUnassignedOpen = unassignedOpenRows[0]?.count ?? 0;

      // Compute how many cases to add for each bucket based on manager settings
      const agent1ToAdd = agent1CurrentOpen >= maxOpen ? 0 : Math.min(dailyTarget, Math.max(maxOpen - agent1CurrentOpen, 0));
      const agent4ToAdd = agent4CurrentOpen >= maxOpen ? 0 : Math.min(dailyTarget, Math.max(maxOpen - agent4CurrentOpen, 0));
      const unassignedToAdd = currentUnassignedOpen >= targetUnassigned ? 0 : Math.max(targetUnassigned - currentUnassignedOpen, 0);

      const dailyImportCount = agent1ToAdd + agent4ToAdd + unassignedToAdd;

      if (dailyImportCount <= 0) {
        return res.json({ success: true, message: "No cases imported: targets already met" });
      }

      // Fetch all potential cases from the DebtCollector table. We avoid any
      // functions or joins in the SQL to stay within the SOAP safety rules.
      const collectorRows: any[] = await soapSelect<any>(
        `SELECT CAccountNo, ComplexID, ComplexName, BPName, ProteaTotal, LandlordTotal, Total, TerminationDate, SuccessAttempts, FailedAttempts, EmailLog, CallLog, Priority, InvoiceSent, InvoiceSentDate, FinalDemandSent, FinalDemandSentDate, ITC, Legal, PaymentReceived, Arrangement, StatusEndDate
         FROM [TestMetermisDB].[dbo].[DebtCollector]`
      );

      // Fetch existing account numbers from the DebtCase table to avoid duplicates
      const existingRows: any[] = await soapSelect<any>(
        `SELECT AccountNo FROM [TestMetermisDB].[dbo].[DebtCase]`
      );
      const existingAccounts = new Set(existingRows.map(r => String(r.AccountNo)));

      const nowDate = new Date();
      const threeYearsAgo = new Date(nowDate);
      threeYearsAgo.setFullYear(nowDate.getFullYear() - 3);

      // Filter and compute scores in JS
      type CaseWithScore = { row: any; amountScore: number; ageScore: number; contactScore: number; attemptScore: number; workflowScore: number; oldPriorityScore: number; pathScore: number; recoveryScore: number; daysSince: number; };
      const eligible: CaseWithScore[] = [];
      for (const r of collectorRows) {
        // Basic eligibility checks
        const total = Number(r.Total) || 0;
        const paymentReceived = Number(r.PaymentReceived) || 0;
        const termDate = r.TerminationDate ? new Date(r.TerminationDate) : null;
        if (total <= 300) continue;
        if (paymentReceived !== 0) continue;
        if (!termDate) continue;
        if (termDate > nowDate) continue;
        if (termDate < threeYearsAgo) continue;
        const arrangement = r.Arrangement ? String(r.Arrangement).trim() : '';
        if (arrangement !== '') continue;
        if (r.StatusEndDate) continue;
        const accNo = String(r.CAccountNo ?? '');
        if (existingAccounts.has(accNo)) continue;

        const daysSince = Math.floor((nowDate.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
        // Compute scores
        let amountScore;
        if (total < 300) amountScore = 0;
        else if (total < 1000) amountScore = 20;
        else if (total < 5000) amountScore = 55;
        else if (total < 25000) amountScore = 100;
        else if (total < 100000) amountScore = 90;
        else if (total < 250000) amountScore = 70;
        else if (total < 1000000) amountScore = 50;
        else amountScore = 35;

        let ageScore;
        if (daysSince < 7) ageScore = 20;
        else if (daysSince <= 30) ageScore = 80;
        else if (daysSince <= 120) ageScore = 100;
        else if (daysSince <= 365) ageScore = 70;
        else if (daysSince <= 730) ageScore = 35;
        else ageScore = 15;

        const emailLog = r.EmailLog ? String(r.EmailLog) : '';
        const callLog = r.CallLog ? String(r.CallLog) : '';
        const emailSuccess = emailLog.includes('SUCCESS | Email');
        const callSuccess = callLog.includes('SUCCESS');
        let contactScore;
        if (emailSuccess && callSuccess) contactScore = 100;
        else if (emailSuccess) contactScore = 80;
        else if (callSuccess) contactScore = 70;
        else if (emailLog || callLog) contactScore = 40;
        else contactScore = 10;

        const successAttempts = Number(r.SuccessAttempts) || 0;
        const failedAttempts = Number(r.FailedAttempts) || 0;
        let attemptScore;
        if (successAttempts > failedAttempts) attemptScore = 100;
        else if (successAttempts > 0) attemptScore = 75;
        else if (failedAttempts >= 1 && failedAttempts <= 3) attemptScore = 45;
        else if (failedAttempts > 3) attemptScore = 20;
        else attemptScore = 50;

        const workflowScore = Number(r.FinalDemandSent) === 1 ? 100 : Number(r.InvoiceSent) === 1 ? 70 : 40;

        const prio = r.Priority ? String(r.Priority) : '';
        let oldPriorityScore;
        if (prio === 'Critical') oldPriorityScore = 100;
        else if (prio === 'High') oldPriorityScore = 80;
        else if (prio === 'Medium') oldPriorityScore = 50;
        else if (prio === 'Low') oldPriorityScore = 25;
        else oldPriorityScore = 40;

        const pathScore = Number(r.Legal) === 1 ? 90 : Number(r.ITC) === 1 ? 75 : 50;

        const deduction = (failedAttempts >= 5 && successAttempts === 0) ? 15 : 0;
        const recoveryScore = (amountScore * 0.35 + ageScore * 0.20 + contactScore * 0.15 + attemptScore * 0.10 + workflowScore * 0.10 + oldPriorityScore * 0.05 + pathScore * 0.05) - deduction;

        eligible.push({ row: r, amountScore, ageScore, contactScore, attemptScore, workflowScore, oldPriorityScore, pathScore, recoveryScore, daysSince });
      }

      if (eligible.length === 0) {
        return res.json({ success: true, message: "No eligible cases found for import" });
      }

      // Sort by recoveryScore desc, then Total desc, then TerminationDate desc
      eligible.sort((a, b) => {
        if (b.recoveryScore !== a.recoveryScore) return b.recoveryScore - a.recoveryScore;
        const tA = Number(a.row.Total) || 0;
        const tB = Number(b.row.Total) || 0;
        if (tB !== tA) return tB - tA;
        const dateA = a.row.TerminationDate ? new Date(a.row.TerminationDate) : new Date(0);
        const dateB = b.row.TerminationDate ? new Date(b.row.TerminationDate) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      // Take top N cases based on dailyImportCount
      const selected = eligible.slice(0, dailyImportCount);

      // Prepare assignments pattern
      const assignments: (number | null)[] = [];
      let a1Left2 = agent1ToAdd;
      let a4Left2 = agent4ToAdd;
      let toggleAssign = true;
      for (let i = 0; i < selected.length; i++) {
        if (a1Left2 > 0 && (toggleAssign || a4Left2 === 0)) {
          assignments.push(1);
          a1Left2--;
          toggleAssign = false;
        } else if (a4Left2 > 0) {
          assignments.push(4);
          a4Left2--;
          toggleAssign = true;
        } else {
          assignments.push(null);
        }
      }

      // Dynamically determine the columns present in the DebtCase table. This ensures
      // that the number of values we provide matches the number of columns. If the
      // schema evolves (e.g. columns are added or removed), this logic will adapt
      // automatically by filling unknown columns with NULL. We exclude the
      // identity column DebtCaseID since it auto‑increments.
      const sampleRows = await soapSelect<any>(
        `SELECT TOP 1 * FROM [TestMetermisDB].[dbo].[DebtCase]`
      );
      if (!sampleRows || sampleRows.length === 0) {
        throw new Error("Unable to retrieve column metadata from DebtCase table");
      }
      const tableColumns: string[] = Object.keys(sampleRows[0]).filter((c) => c.toLowerCase() !== 'debtcaseid');

      const nowIso2 = new Date().toISOString();
      const nowSql2 = `CAST(N'${nowIso2}' AS DATETIME2)`;
      let insertedCount = 0;
      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        const r = item.row;
        const assignedOwnerId = assignments[i] ?? null;
        const recScore = item.recoveryScore;
        const priorityLabel = recScore >= 80 ? 'High' : recScore >= 55 ? 'Medium' : 'Low';
        const recommended = (Number(r.Legal) === 1 || Number(r.Total) >= 100000) ? 'Legal' : 'ITC';
        const accountNo = toSqlNVarChar(String(r.CAccountNo ?? ''));
        const complexID = toSqlNVarChar(String(r.ComplexID ?? ''));
        const complexName = toSqlNVarChar(String(r.ComplexName ?? ''));
        const debtorName = toSqlNVarChar(String(r.BPName ?? ''));
        // No contact details available in DebtCollector; leave null
        const contactPhone = 'NULL';
        const contactEmail = 'NULL';
        const proteaAmount = toSqlDecimal(r.ProteaTotal);
        const landlordAmount = toSqlDecimal(r.LandlordTotal);
        const totalOut = toSqlDecimal(r.Total);
        const termination = toSqlDateTime(r.TerminationDate);
        const currentStatusID = '1';
        const ownerIdSql = toSqlInt(assignedOwnerId);
        const prioSql = toSqlNVarChar(priorityLabel);
        const recommendedSql = toSqlNVarChar(recommended);
        const invoiceSent = toSqlBit(r.InvoiceSent);
        const invoiceSentAt = toSqlDateTime(r.InvoiceSentDate);
        const finalDemandSent = toSqlBit(r.FinalDemandSent);
        const finalDemandSentAt = toSqlDateTime(r.FinalDemandSentDate);
        const internalNotes = toSqlNVarChar(
          `Auto-imported from DebtCollector. Assignment: ${assignedOwnerId === 1 ? 'Assigned to Agent 1' : assignedOwnerId === 4 ? 'Assigned to Agent 4' : 'Shared Unassigned Pool'}. ` +
          `Agent 1 open before import: ${agent1CurrentOpen}. Agent 1 added today: ${agent1ToAdd}. ` +
          `Agent 4 open before import: ${agent4CurrentOpen}. Agent 4 added today: ${agent4ToAdd}. ` +
          `Current unassigned before import: ${currentUnassignedOpen}. Unassigned added today: ${unassignedToAdd}. ` +
          `RecoveryScore: ${recScore}. AmountScore: ${item.amountScore}. AgeScore: ${item.ageScore}. ` +
          `ContactScore: ${item.contactScore}. AttemptScore: ${item.attemptScore}. WorkflowScore: ${item.workflowScore}. ` +
          `OldPriorityScore: ${item.oldPriorityScore}. PathScore: ${item.pathScore}. ` +
          `Old Priority: ${r.Priority ?? 'None'}. Old Account: ${r.CAccountNo}.`
        );

        // Map each column to an appropriate value or NULL. If the column is not
        // recognized, default to NULL. Note that all values must be provided in
        // the same order as the column list to avoid mismatches.
        const valueByColumn: Record<string, string> = {
          AccountNo: accountNo,
          ComplexID: complexID,
          ComplexName: complexName,
          DebtorName: debtorName,
          ContactPhone: contactPhone,
          ContactEmail: contactEmail,
          ProteaAmount: proteaAmount,
          LandlordAmount: landlordAmount,
          TotalOutstanding: totalOut,
          TerminationDate: termination,
          DebtorQualifiedDate: nowSql2,
          CurrentStatusID: currentStatusID,
          StatusStartedAt: nowSql2,
          CurrentOwnerAgentID: ownerIdSql,
          Priority: prioSql,
          RecommendedPath: recommendedSql,
          InvoiceSent: invoiceSent,
          InvoiceSentAt: invoiceSentAt,
          InvoiceFileName: 'NULL',
          FinalDemandSent: finalDemandSent,
          FinalDemandSentAt: finalDemandSentAt,
          FinalDemandFileName: 'NULL',
          Reminder7DueAt: 'NULL',
          Reminder14DueAt: 'NULL',
          ResolutionType: 'NULL',
          ResolutionChosenAt: 'NULL',
          ResolutionChosenByAgentID: 'NULL',
          EscalatedToSuperior: '0',
          EscalatedToSuperiorAt: 'NULL',
          EscalatedToSuperiorByAgentID: 'NULL',
          SuperiorAgentID: 'NULL',
          ArrangementActive: '0',
          ArrangementReference: 'NULL',
          PaymentReceived: '0',
          PaymentReceivedAt: 'NULL',
          LastExternalPaymentAt: 'NULL',
          LastExternalPaymentAmount: 'NULL',
          ExternalBalanceCheckedAt: 'NULL',
          InternalNotes: internalNotes,
          DocumentFileName: 'NULL',
          CreatedAt: nowSql2,
          UpdatedAt: nowSql2,
          ClosedAt: 'NULL',
        };

        const columnsList = tableColumns.map((col) => `[${col}]`).join(', ');
        const valuesList = tableColumns.map((col) => {
          const val = valueByColumn[col as keyof typeof valueByColumn];
          return val !== undefined ? val : 'NULL';
        }).join(', ');

        const insertSql = `INSERT INTO [TestMetermisDB].[dbo].[DebtCase] (${columnsList}) VALUES (${valuesList});`;
        await soapWrite(insertSql);
        insertedCount++;
      }

      return res.json({ success: true, message: `Daily import completed. Imported ${insertedCount} cases.` });
    } catch (error) {
      console.error("runImport error:", error);
      return res.status(500).json({ success: false, message: "Failed to run import" });
    }
  }
}