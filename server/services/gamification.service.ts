import { soapSelect, soapWrite } from "../lib/debt-case-soap";

/**
 * Simple gamification service. It tracks experience points and shop coins
 * awarded to collectors for completing tasks and progressing cases through the
 * workflow. This function can be expanded to handle levels and streaks but
 * currently just increments the counters on the DebtCaseAgents table. It
 * performs safe updates via the soap service to ensure the database is
 * accessed consistently.
 */
export async function awardExperiencePoints(
  agentId: number | null | undefined,
  xp: number,
  coins: number,
): Promise<void> {
  if (!agentId || xp <= 0) return;
  // Look up current totals. Use ISNULL to handle null fields. We use
  // parentheses around the expressions to appease the T‑SQL parser.
  const rows = await soapSelect<{
    ExperiencePoints?: string | number;
    ShopCoins?: string | number;
  }>(
    `SELECT ISNULL(ExperiencePoints,0) AS ExperiencePoints, ISNULL(ShopCoins,0) AS ShopCoins FROM [TestMetermisDB].[dbo].[DebtCaseAgents] WHERE ID = ${agentId}`,
  );
  if (!rows.length) return;
  const currentXp = Number(rows[0].ExperiencePoints ?? 0);
  const currentCoins = Number(rows[0].ShopCoins ?? 0);
  const newXp = currentXp + xp;
  const newCoins = currentCoins + coins;
  await soapWrite(
    `UPDATE [TestMetermisDB].[dbo].[DebtCaseAgents] SET ExperiencePoints = ${newXp}, ShopCoins = ${newCoins} WHERE ID = ${agentId}`,
  );
}