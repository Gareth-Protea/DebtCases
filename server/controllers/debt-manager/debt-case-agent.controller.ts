import { Request, Response } from "express";
import {
  TABLES,
  asInt,
  soapSelect,
  soapWrite,
  toSqlInt,
  toSqlNVarChar,
} from "../../lib/debt-case-soap";

export async function listDebtCaseAgents(_req: Request, res: Response) {
  try {
    const sql = `
      SELECT
        ID,
        AgentName,
        Email,
        Phone,
        AccessLevel,
        DisplayTitle,
        ProfileImageFileName,
        Bio,
        ProfileTheme,
        ProfileAccentColor,
        ExperiencePoints,
        [Level],
        ShopCoins,
        CoinsEarnedLifetime,
        CoinsSpentLifetime,
        CurrentStreakDays,
        LongestStreakDays,
        ObjectivesCompleted,
        LastLoginAt,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM ${TABLES.agents}
      ORDER BY AgentName;
    `;

    const rows = await soapSelect(sql);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listDebtCaseAgents error:", error);
    return res.status(500).json({ success: false, message: "Failed to load agents" });
  }
}

export async function getDebtCaseAgentProfile(req: Request, res: Response) {
  const agentId = asInt(req.params.id);
  if (!agentId) {
    return res.status(400).json({ success: false, message: "Invalid agent id" });
  }

  try {
    const sql = `
      SELECT TOP 1
        ID,
        AgentName,
        Email,
        Phone,
        AccessLevel,
        DisplayTitle,
        ProfileImageFileName,
        Bio,
        ProfileTheme,
        ProfileAccentColor,
        ExperiencePoints,
        [Level],
        ShopCoins,
        CoinsEarnedLifetime,
        CoinsSpentLifetime,
        CurrentStreakDays,
        LongestStreakDays,
        ObjectivesCompleted,
        AchievementsJson,
        InventoryJson,
        LastLoginAt,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM ${TABLES.agents}
      WHERE ID = ${agentId};
    `;

    const rows = await soapSelect(sql);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("getDebtCaseAgentProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to load agent profile" });
  }
}

export async function updateDebtCaseAgentProfile(req: Request, res: Response) {
  const agentId = asInt(req.params.id);
  if (!agentId) {
    return res.status(400).json({ success: false, message: "Invalid agent id" });
  }

  try {
    const body = req.body ?? {};
    const updates: string[] = [];

    if (body.agentName !== undefined) updates.push(`AgentName = ${toSqlNVarChar(body.agentName)}`);
    if (body.phone !== undefined) updates.push(`Phone = ${toSqlNVarChar(body.phone)}`);
    if (body.displayTitle !== undefined) updates.push(`DisplayTitle = ${toSqlNVarChar(body.displayTitle)}`);
    if (body.profileImageFileName !== undefined) {
      updates.push(`ProfileImageFileName = ${toSqlNVarChar(body.profileImageFileName)}`);
    }
    if (body.bio !== undefined) updates.push(`Bio = ${toSqlNVarChar(body.bio)}`);
    if (body.profileTheme !== undefined) updates.push(`ProfileTheme = ${toSqlNVarChar(body.profileTheme)}`);
    if (body.profileAccentColor !== undefined) {
      updates.push(`ProfileAccentColor = ${toSqlNVarChar(body.profileAccentColor)}`);
    }
    if (body.achievementsJson !== undefined) {
      updates.push(`AchievementsJson = ${toSqlNVarChar(JSON.stringify(body.achievementsJson))}`);
    }
    if (body.inventoryJson !== undefined) {
      updates.push(`InventoryJson = ${toSqlNVarChar(JSON.stringify(body.inventoryJson))}`);
    }
    if (body.isActive !== undefined) updates.push(`IsActive = ${body.isActive ? 1 : 0}`);

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No profile fields supplied" });
    }

    updates.push(`UpdatedAt = SYSUTCDATETIME()`);

    const sql = `
      UPDATE ${TABLES.agents}
      SET ${updates.join(", ")}
      WHERE ID = ${agentId};
    `;

    const { rowsAffected } = await soapWrite(sql);
    if (rowsAffected !== null && rowsAffected <= 0) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("updateDebtCaseAgentProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update agent profile" });
  }
}

export async function awardDebtCaseAgentProgress(req: Request, res: Response) {
  const agentId = asInt(req.params.id);
  if (!agentId) {
    return res.status(400).json({ success: false, message: "Invalid agent id" });
  }

  try {
    const xpDelta = Math.max(0, asInt(req.body?.experiencePointsDelta) ?? 0);
    const shopCoinsDelta = asInt(req.body?.shopCoinsDelta) ?? 0;
    const objectivesDelta = Math.max(0, asInt(req.body?.objectivesDelta) ?? 0);
    const streakDays = req.body?.currentStreakDays !== undefined ? Math.max(0, asInt(req.body.currentStreakDays) ?? 0) : null;

    if (xpDelta === 0 && shopCoinsDelta === 0 && objectivesDelta === 0 && streakDays === null) {
      return res.status(400).json({ success: false, message: "No progress values supplied" });
    }

    const positiveCoins = shopCoinsDelta > 0 ? shopCoinsDelta : 0;
    const spentCoins = shopCoinsDelta < 0 ? Math.abs(shopCoinsDelta) : 0;

    const updates: string[] = [
      `ExperiencePoints = ISNULL(ExperiencePoints, 0) + ${xpDelta}`,
      `ShopCoins = ISNULL(ShopCoins, 0) + ${shopCoinsDelta}`,
      `CoinsEarnedLifetime = ISNULL(CoinsEarnedLifetime, 0) + ${positiveCoins}`,
      `CoinsSpentLifetime = ISNULL(CoinsSpentLifetime, 0) + ${spentCoins}`,
      `ObjectivesCompleted = ISNULL(ObjectivesCompleted, 0) + ${objectivesDelta}`,
      `UpdatedAt = SYSUTCDATETIME()`,
      `Level = ((ISNULL(ExperiencePoints, 0) + ${xpDelta}) / 100) + 1`,
    ];

    if (streakDays !== null) {
      updates.push(`CurrentStreakDays = ${streakDays}`);
      updates.push(`
        LongestStreakDays = CASE
          WHEN ISNULL(LongestStreakDays, 0) < ${streakDays} THEN ${streakDays}
          ELSE ISNULL(LongestStreakDays, 0)
        END
      `);
    }

    const sql = `
      UPDATE ${TABLES.agents}
      SET ${updates.join(", ")}
      WHERE ID = ${agentId};
    `;

    const { rowsAffected } = await soapWrite(sql);
    if (rowsAffected !== null && rowsAffected <= 0) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    const readBackSql = `
      SELECT TOP 1
        ID,
        AgentName,
        ExperiencePoints,
        [Level],
        ShopCoins,
        CoinsEarnedLifetime,
        CoinsSpentLifetime,
        CurrentStreakDays,
        LongestStreakDays,
        ObjectivesCompleted
      FROM ${TABLES.agents}
      WHERE ID = ${agentId};
    `;

    const rows = await soapSelect(readBackSql);
    return res.json({ success: true, data: rows[0] ?? null });
  } catch (error) {
    console.error("awardDebtCaseAgentProgress error:", error);
    return res.status(500).json({ success: false, message: "Failed to update agent progress" });
  }
}