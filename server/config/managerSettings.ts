import { soapSelect, soapWrite } from "../lib/debt-case-soap";

/**
 * Manager‑configurable settings for the daily import and workload distribution.
 * These settings live in memory but can easily be persisted in the database in
 * future iterations. A simple interface provides strong typing and a default
 * baseline. In future you could extend this module to store the values in
 * a dedicated table or config file. For now, the values reset when the
 * server restarts.
 */
export interface ManagerSettings {
  /**
   * How many new cases each agent should receive per day. This value is fed
   * directly into the daily import T‑SQL. Defaults to 5.
   */
  dailyTargetPerAgent: number;
  /**
   * The maximum number of open cases an agent may carry at a time. If an
   * agent already has this number of active cases the import will skip
   * assigning further work to them. Defaults to 10.
   */
  maxOpenCasesPerAgent: number;
  /**
   * How many records the unassigned pool should maintain. Any shortfall
   * triggers the import to top up the pool. Defaults to 5.
   */
  targetUnassignedPool: number;
}

// In‑memory cache of the current settings. These defaults mirror the ones
// described by the user in the Big Query script. See Big Query.txt for
// reference. Should the user change these values via the API the object is
// updated accordingly.
let currentSettings: ManagerSettings = {
  dailyTargetPerAgent: 5,
  maxOpenCasesPerAgent: 10,
  targetUnassignedPool: 5,
};

export function getSettings(): ManagerSettings {
  return { ...currentSettings };
}

export function updateSettings(partial: Partial<ManagerSettings>): ManagerSettings {
  currentSettings = { ...currentSettings, ...partial };
  return getSettings();
}

/**
 * Ensure that a workflow status exists in the database. If a row with the
 * provided statusName cannot be found then a new one is inserted. The
 * operation is idempotent: calling it repeatedly with the same name will
 * result in a single record. This helper should be called during server
 * startup to create any new statuses required by the front end (for example
 * FOLLOW_UP_7D). It utilises the soap service to avoid any direct database
 * connections.
 */
export async function ensureStatusExists(statusName: string, description: string): Promise<void> {
  const normalized = statusName.trim().toUpperCase();
  // Look up existing status. TOP 1 is sufficient.
  const rows = await soapSelect<{
    StatusID?: string | number;
  }>(
    `SELECT TOP 1 StatusID FROM [TestMetermisDB].[dbo].[DebtCaseStatus] WHERE UPPER(StatusName) = '${normalized.replace(/'/g, "''")}'`,
  );
  if (rows.length > 0) return;
  // Insert new status. Default creation timestamp is now.
  // We must supply a StatusID because the column is not identity. Calculate the next available ID.
  const maxRows = await soapSelect<{ MaxID?: string | number }>(
    `SELECT ISNULL(MAX(StatusID),0) AS MaxID FROM [TestMetermisDB].[dbo].[DebtCaseStatus]`,
  );
  const nextId = Number(maxRows[0]?.MaxID ?? 0) + 1;
  await soapWrite(
    `INSERT INTO [TestMetermisDB].[dbo].[DebtCaseStatus] (StatusID, StatusName, Description, CreatedAt) VALUES (${nextId}, N'${normalized.replace(/'/g, "''")}', N'${description.replace(/'/g, "''")}', GETDATE());`,
  );
}