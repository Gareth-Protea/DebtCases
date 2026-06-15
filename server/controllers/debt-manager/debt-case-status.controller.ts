import { Request, Response } from "express";
import { TABLES, soapSelect } from "../../lib/debt-case-soap";

export async function listDebtCaseStatuses(_req: Request, res: Response) {
  try {
    const sql = `
      SELECT
        StatusID,
        StatusName,
        [Description],
        CreatedAt
      FROM ${TABLES.statuses}
      ORDER BY StatusID;
    `;

    const rows = await soapSelect(sql);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listDebtCaseStatuses error:", error);
    return res.status(500).json({ success: false, message: "Failed to load case statuses" });
  }
}