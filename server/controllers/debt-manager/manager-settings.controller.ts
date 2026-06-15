import type { Request, Response } from "express";
import {
  getSettings,
  updateSettings,
  ensureStatusExists,
} from "../../config/managerSettings";
import fs from "fs";
import path from "path";
import { soapWrite } from "../../lib/debt-case-soap";

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
      // Read the T‑SQL import script from the repository. This file is
      // provided by the user (Big Query.txt) and contains a stored procedure
      // like query for inserting daily cases. We perform lightweight
      // substitutions for the variable declarations at the top of the file.
      const scriptPath = path.join(
        process.cwd(),
        "Big Query.txt",
      );
      let script = fs.readFileSync(scriptPath, "utf8");
      // Replace the declared defaults with our current settings using a
      // regular expression. This is fragile if the file format changes but
      // suffices for this exercise. If the file is not found the read will
      // throw and be caught below.
      script = script.replace(/@DailyTargetPerAgent int = \d+/i, `@DailyTargetPerAgent int = ${settings.dailyTargetPerAgent}`);
      script = script.replace(/@MaxOpenCasesPerAgent int = \d+/i, `@MaxOpenCasesPerAgent int = ${settings.maxOpenCasesPerAgent}`);
      script = script.replace(/@TargetUnassignedPool int = \d+/i, `@TargetUnassignedPool int = ${settings.targetUnassignedPool}`);
      // Execute the script via soap. The response is ignored; any errors
      // thrown by the database will propagate as thrown promises.
      await soapWrite(script);
      return res.json({ success: true, message: "Daily import completed" });
    } catch (error) {
      console.error("runImport error:", error);
      return res.status(500).json({ success: false, message: "Failed to run import" });
    }
  }
}