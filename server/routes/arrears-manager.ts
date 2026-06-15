import type { Express, Request, Response } from "express";
import { getArrearsRecords } from "../controllers/arrears-manager/arrears.controller";

export function registerArrearsRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response) => boolean
) {
  // ── Arrears Manager API Routes ──────────────────────────────
  // All routes prefixed with /api/arrears-manager/

  app.get(`/api/arrears-manager/records`, (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    getArrearsRecords(req, res);
  });

  // Add more arrears manager routes below
}
