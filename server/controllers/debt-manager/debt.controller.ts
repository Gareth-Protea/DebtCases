import type { Request, Response } from "express";
import { storage } from "../../storage";
// Import SQL helper and write function to update legacy DebtCollector
import { toSqlNVarChar, soapWrite } from "../../lib/debt-case-soap";

// ── Debt Manager Controllers ──────────────────────────────────
// Add controller functions for debt features here.
// Each function handles the business logic for one route.

export async function getDebtRecords(req: Request, res: Response) {
  try {
    const data = await storage.getDebtRecords();
    // Wrap the result in a success/data envelope so the client can
    // uniformly parse ApiResponse objects (similar to listDebtCases).
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Assign a legacy debt record to a collector.  This updates the
// AgentID column on the DebtCollector table.  The ID is the
// CAccountNo of the record.  AgentID must be provided in the
// request body.
export async function assignDebtRecord(req: Request, res: Response) {
  const recordId = String(req.params.id ?? "").trim();
  const agentId = Number(req.body?.agentId);
  if (!recordId) {
    return res.status(400).json({ success: false, message: "Invalid record id" });
  }
  if (!Number.isFinite(agentId)) {
    return res.status(400).json({ success: false, message: "Invalid agent id" });
  }
  try {
    const sql = `
      UPDATE [TestMetermisDB].[dbo].[DebtCollector]
      SET AgentID = ${agentId}
      WHERE CAccountNo = ${toSqlNVarChar(recordId)};
    `;
    await soapWrite(sql);
    res.json({ success: true });
  } catch (err: any) {
    console.error("assignDebtRecord error:", err);
    res.status(500).json({ success: false, message: err.message ?? "Failed to assign debt record" });
  }
}

// Add more debt controller functions below
