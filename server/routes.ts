import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { soapClient } from "./soap-client";
import { verifyAdminPassword, getFixedSalt, parseDbBinary } from "./admin-auth";
import { registerArrearsRoutes } from "./routes/arrears-manager";
import { registerDebtRoutes } from "./routes/debt-manager";

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session?.adminUserId) {
    res.status(401).json({ message: "Admin authentication required." });
    return false;
  }
  return true;
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Admin Auth ──────────────────────────────────────────────
  app.post(`/api/admin/login`, async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const safeUser = username.replace(/'/g, "''");

    const rows = await soapClient.queryMetermis(
      `SELECT PersonID, TechID, AccessLevel, Username, PasswordHash, IsActive ` +
      `FROM MM_Logins WHERE Username = '${safeUser}' AND IsActive = 1`
    );

    if (!rows?.length) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const user = rows[0];
    const storedHash = parseDbBinary(user.PasswordHash);
    const salt = getFixedSalt();

    if (!storedHash || !verifyAdminPassword(password, salt, storedHash)) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const accessLevel = Number(user.AccessLevel ?? 0);
    if (accessLevel < 2) {
      return res
        .status(403)
        .json({ message: "Insufficient access level." });
    }

    req.session.adminUserId = Number(user.PersonID);
    req.session.adminUsername = String(user.Username ?? "").trim();
    req.session.adminAccessLevel = accessLevel;

    // Fire-and-forget: update last login timestamp
    soapClient.queryMetermis(
      `UPDATE MM_Logins SET LastLoginUtc = GETUTCDATE() WHERE PersonID = ${Number(user.PersonID)}`
    ).catch(() => {});

    res.json({
      personId: req.session.adminUserId,
      username: req.session.adminUsername,
      accessLevel: req.session.adminAccessLevel,
    });
  });

  app.post(`/api/admin/logout`, (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get(`/api/admin/me`, (req, res) => {
    if (!req.session?.adminUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({
      personId: req.session.adminUserId,
      username: req.session.adminUsername,
      accessLevel: req.session.adminAccessLevel,
    });
  });

  // ── Arrears Manager Routes ─────────────────────────────────
  registerArrearsRoutes(app, requireAdmin);

  // ── Debt Manager Routes ────────────────────────────────────
  registerDebtRoutes(app, requireAdmin);

  return httpServer;
}
