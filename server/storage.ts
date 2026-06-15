import { soapClient } from "./soap-client";
// Import the SOAP select helper for performing select queries.
import { soapSelect } from "./lib/debt-case-soap";
import type { ArrearsRecord, DebtRecord } from "@shared/schema";

export interface IStorage {
  // Arrears Manager methods
  getArrearsRecords(): Promise<ArrearsRecord[]>;

  // Debt Manager methods
  getDebtRecords(): Promise<DebtRecord[]>;
}

export class SOAPStorage implements IStorage {
  private escapeString(s: string): string {
    return String(s ?? "").replace(/'/g, "''");
  }

  // ── Arrears Manager ─────────────────────────────────────────
  async getArrearsRecords(): Promise<ArrearsRecord[]> {
    // TODO: Implement actual SOAP query for arrears data
    return [];
  }

  // ── Debt Manager ────────────────────────────────────────────
  async getDebtRecords(): Promise<DebtRecord[]> {
    // Query the legacy DebtCollector table and alias columns to match
    // the DebtCaseRow shape expected by the UI. We join the
    // DebtCaseStatus table to retrieve the status name, and
    // DebtCaseAgents to get the assigned agent name. DaysSinceTermination
    // is computed on the fly.
    const sql = `
      SELECT
        dc.CAccountNo AS DebtCaseID,
        dc.CAccountNo AS AccountNo,
        dc.ComplexID,
        dc.ComplexName,
        dc.BPName AS DebtorName,
        NULL AS ContactPhone,
        NULL AS ContactEmail,
        dc.ProteaTotal AS ProteaAmount,
        dc.LandlordTotal AS LandlordAmount,
        dc.Total AS TotalOutstanding,
        dc.TerminationDate,
        NULL AS DebtorQualifiedDate,
        dc.StatusID AS CurrentStatusID,
        s.StatusName AS CurrentStatusName,
        dc.StatusStartDate AS StatusStartedAt,
        dc.AgentID AS CurrentOwnerAgentID,
        a.AgentName AS CurrentOwnerName,
        dc.Priority,
        CASE
          WHEN dc.ITC = 1 THEN 'ITC'
          WHEN dc.Legal = 1 THEN 'LEGAL'
          ELSE NULL
        END AS RecommendedPath,
        dc.InvoiceSent,
        dc.InvoiceSentDate AS InvoiceSentAt,
        dc.FinalDemandSent,
        dc.FinalDemandSentDate AS FinalDemandSentAt,
        NULL AS Reminder7DueAt,
        NULL AS Reminder14DueAt,
        NULL AS ResolutionType,
        dc.Arrangement AS ArrangementActive,
        dc.PaymentReceived,
        NULL AS EscalatedToSuperior,
        dc.CreatedAt,
        NULL AS UpdatedAt,
        DATEDIFF(DAY, dc.TerminationDate, GETDATE()) AS DaysSinceTermination
      FROM [TestMetermisDB].[dbo].[DebtCollector] dc
      LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseStatus] s ON s.StatusID = dc.StatusID
      LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseAgents] a ON a.ID = dc.AgentID
      ORDER BY dc.CAccountNo DESC;
    `;

    const rows = await soapSelect(sql);
    // Cast to any[] since the DebtRecord interface is minimal.  The
    // controller will wrap the rows in an ApiResponse.
    return rows as any;
  }
}

export const storage = new SOAPStorage();
