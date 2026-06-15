import type { Request, Response } from "express";
import { storage } from "../../storage";

// ── Arrears Manager Controllers ───────────────────────────────
// Add controller functions for arrears features here.
// Each function handles the business logic for one route.

export async function getArrearsRecords(req: Request, res: Response) {
  try {
    const data = await storage.getArrearsRecords();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// Add more arrears controller functions below
