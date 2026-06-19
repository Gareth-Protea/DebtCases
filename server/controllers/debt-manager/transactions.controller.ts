import type { Request, Response } from "express";
import { soapSelect, toSqlNVarChar } from "../../lib/debt-case-soap";

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseYmd(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const parsed = new Date(`${trimmed}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function defaultTransactionStartDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setFullYear(today.getFullYear() - 3);

  return start;
}

function normalizeEndOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Journals.TranDate is stored as an OLE Automation date number.
 * SQL Server's matching date epoch is 1899-12-30.
 */
function toOleDateOnly(date: Date): number {
  const oleEpoch = Date.UTC(1899, 11, 30);
  const dateOnly = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.floor((dateOnly - oleEpoch) / 86400000);
}

function parseTransactionDateRange(req: Request) {
  const startFromQuery =
    parseYmd(req.query.start) ??
    parseYmd(req.query.startDate) ??
    defaultTransactionStartDate();

  const endFromQuery =
    parseYmd(req.query.end) ??
    parseYmd(req.query.endDate) ??
    new Date();

  let startDate = new Date(startFromQuery);
  startDate.setHours(0, 0, 0, 0);

  let endDate = normalizeEndOfDay(endFromQuery);

  if (startDate > endDate) {
    const temp = startDate;
    startDate = new Date(endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = normalizeEndOfDay(temp);
  }

  const endExclusive = new Date(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);

  return {
    startDate,
    endDate,
    startOle: toOleDateOnly(startDate),
    endOle: toOleDateOnly(endExclusive),
  };
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 ? int : null;
}

/**
 * Converts Journals.TranDate from OLE number into a SQL datetime.
 */
const TRAN_DATE_SQL = `
  DATEADD(
    SECOND,
    CONVERT(int, ROUND((j.TranDate - FLOOR(j.TranDate)) * 86400.0, 0)),
    DATEADD(DAY, CONVERT(int, FLOOR(j.TranDate)), '1899-12-30')
  )
`;

function buildPaymentBaseQuery(options: {
  startOle: number;
  endOle: number;
  agentId?: number | null;
  accountNo?: string | null;
}) {
  const agentId = asPositiveInt(options.agentId);
  const agentFilter = agentId !== null ? `AND dcse.CurrentOwnerAgentID = ${agentId}` : "";
  const accountFilter = options.accountNo
    ? `AND CAST(jt.CAccountNo AS nvarchar(50)) = ${toSqlNVarChar(String(options.accountNo))}`
    : "";

  /*
   * IMPORTANT:
   * Transactions still come from real accounting data:
   * JournalTrans + Journals + CAccounts.
   *
   * App/case matching uses ONLY the new debt app tables:
   * DebtCase + DebtCaseAgents.
   *
   * Do not join DebtCollector or DebtCollectAgents here. Their legacy AgentID
   * values do not reliably match DebtCaseAgents.ID in the new app.
   */
  return `
    SELECT
      CAST(jt.CAccountNo AS nvarchar(50)) AS AccountNo,
      jt.Credit AS Amount,
      j.JournalNo,
      j.Description,
      ${TRAN_DATE_SQL} AS TranDate,
      dcse.DebtCaseID,
      dcse.DebtorName AS BPName,
      dcse.TotalOutstanding,
      dcse.CurrentOwnerAgentID AS AgentID,
      dcse.TerminationDate,
      COALESCE(dca.AgentName, 'Unassigned') AS AgentName,
      dcse.PaymentReceived,
      dcse.PaymentReceivedAt
    FROM [TestMetermisDB].[dbo].[JournalTrans] jt
    INNER JOIN [TestMetermisDB].[dbo].[Journals] j
      ON j.JournalNo = jt.JournalNo
    INNER JOIN [TestMetermisDB].[dbo].[CAccounts] ca
      ON ca.CAccountNo = jt.CAccountNo
    INNER JOIN [TestMetermisDB].[dbo].[DebtCase] dcse
      ON CAST(dcse.AccountNo AS nvarchar(50)) = CAST(jt.CAccountNo AS nvarchar(50))
    LEFT JOIN [TestMetermisDB].[dbo].[DebtCaseAgents] dca
      ON dca.ID = dcse.CurrentOwnerAgentID
    WHERE ca.IsCreditor = 0
      AND jt.GLAccountNo = 1070
      AND jt.Credit > 0
      AND UPPER(ISNULL(j.Description, '')) NOT LIKE '%REVERSE%'
      AND j.TranDate >= ${options.startOle}
      AND j.TranDate < ${options.endOle}
      AND dcse.TerminationDate IS NOT NULL
      ${agentFilter}
      ${accountFilter}
  `;
}

function buildVerifiedPaymentQuery(options: {
  startOle: number;
  endOle: number;
  agentId?: number | null;
  accountNo?: string | null;
}) {
  const baseQuery = buildPaymentBaseQuery(options);

  return `
    SELECT *
    FROM (${baseQuery}) p
    WHERE p.TranDate >= DATEADD(DAY, 30, p.TerminationDate)
  `;
}

function shortSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

async function buildTransactionDebugPayload(options: {
  startDate: Date;
  endDate: Date;
  startOle: number;
  endOle: number;
  agentId?: number | null;
  accountNo?: string | null;
  basePaymentsQuery: string;
  verifiedPaymentsQuery: string;
}) {
  const agentId = asInt(options.agentId);
  const agentFilter = agentId !== null ? `AND dcse.CurrentOwnerAgentID = ${agentId}` : "";
  const accountFilter = options.accountNo
    ? `AND CAST(dcse.AccountNo AS nvarchar(50)) = ${toSqlNVarChar(String(options.accountNo))}`
    : "";

  const debtCaseRows = await soapSelect<{
    DebtCaseCount: string | number;
    TerminatedDebtCaseCount: string | number;
    OpenAgentCaseCount: string | number;
  }>(`
    SELECT
      COUNT(*) AS DebtCaseCount,
      SUM(CASE WHEN dcse.TerminationDate IS NOT NULL THEN 1 ELSE 0 END) AS TerminatedDebtCaseCount,
      SUM(CASE WHEN dcse.CurrentOwnerAgentID IS NOT NULL THEN 1 ELSE 0 END) AS OpenAgentCaseCount
    FROM [TestMetermisDB].[dbo].[DebtCase] dcse
    WHERE 1 = 1
      ${agentFilter}
      ${accountFilter}
  `);

  const baseRows = await soapSelect<{
    BaseIncome: string | number;
    BaseTransactionCount: string | number;
  }>(`
    SELECT
      SUM(p.Amount) AS BaseIncome,
      COUNT(*) AS BaseTransactionCount
    FROM (${options.basePaymentsQuery}) p
  `);

  const verifiedRows = await soapSelect<{
    VerifiedIncome: string | number;
    VerifiedTransactionCount: string | number;
  }>(`
    SELECT
      SUM(p.Amount) AS VerifiedIncome,
      COUNT(*) AS VerifiedTransactionCount
    FROM (${options.verifiedPaymentsQuery}) p
  `);

  const sampleRows = await soapSelect<{
    AccountNo: string;
    DebtCaseID: string | number | null;
    BPName: string | null;
    AgentID: string | number | null;
    AgentName: string | null;
    Amount: string | number;
    TranDate: string | null;
    TerminationDate: string | null;
    DaysAfterTermination: string | number | null;
    Eligibility: string;
    JournalNo: string | number | null;
    Description: string | null;
  }>(`
    SELECT TOP 25
      p.AccountNo,
      p.DebtCaseID,
      p.BPName,
      p.AgentID,
      p.AgentName,
      p.Amount,
      CONVERT(varchar(19), p.TranDate, 120) AS TranDate,
      CONVERT(varchar(19), p.TerminationDate, 120) AS TerminationDate,
      DATEDIFF(DAY, p.TerminationDate, p.TranDate) AS DaysAfterTermination,
      CASE
        WHEN p.TranDate >= DATEADD(DAY, 30, p.TerminationDate) THEN 'COUNTABLE'
        ELSE 'BEFORE 30 DAY RULE'
      END AS Eligibility,
      p.JournalNo,
      p.Description
    FROM (${options.basePaymentsQuery}) p
    ORDER BY p.TranDate DESC
  `);

  const agentRows = await soapSelect<{
    AgentID: string | number | null;
    AgentName: string | null;
    Value: string | number;
    Count: string | number;
  }>(`
    SELECT
      p.AgentID,
      p.AgentName,
      SUM(p.Amount) AS Value,
      COUNT(*) AS Count
    FROM (${options.verifiedPaymentsQuery}) p
    GROUP BY p.AgentID, p.AgentName
    ORDER BY SUM(p.Amount) DESC
  `);

  return {
    request: {
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      startOle: options.startOle,
      endOle: options.endOle,
      agentId: agentId,
      accountNo: options.accountNo ?? null,
    },
    stageCounts: {
      debtCaseCount: asNumber(debtCaseRows[0]?.DebtCaseCount),
      terminatedDebtCaseCount: asNumber(debtCaseRows[0]?.TerminatedDebtCaseCount),
      debtCasesWithOwnerAgent: asNumber(debtCaseRows[0]?.OpenAgentCaseCount),
      baseIncomeBefore30DayRule: asNumber(baseRows[0]?.BaseIncome),
      baseTransactionsBefore30DayRule: asNumber(baseRows[0]?.BaseTransactionCount),
      verifiedIncomeAfter30DayRule: asNumber(verifiedRows[0]?.VerifiedIncome),
      verifiedTransactionsAfter30DayRule: asNumber(verifiedRows[0]?.VerifiedTransactionCount),
    },
    sampleRows: sampleRows.map((row) => ({
      accountNo: String(row.AccountNo ?? ""),
      debtCaseId: row.DebtCaseID ?? null,
      debtorName: row.BPName ? String(row.BPName) : null,
      agentId: row.AgentID ?? null,
      agentName: row.AgentName ? String(row.AgentName) : null,
      amount: asNumber(row.Amount),
      tranDate: row.TranDate ? String(row.TranDate) : null,
      terminationDate: row.TerminationDate ? String(row.TerminationDate) : null,
      daysAfterTermination: row.DaysAfterTermination ?? null,
      eligibility: String(row.Eligibility ?? ""),
      journalNo: row.JournalNo ?? null,
      description: row.Description ? String(row.Description) : null,
    })),
    verifiedByAgent: agentRows.map((row) => ({
      agentId: row.AgentID ?? null,
      agentName: row.AgentName ? String(row.AgentName) : "Unassigned",
      value: asNumber(row.Value),
      count: asNumber(row.Count),
    })),
    sqlPreview: {
      basePaymentsQuery: shortSql(options.basePaymentsQuery),
      verifiedPaymentsQuery: shortSql(options.verifiedPaymentsQuery),
    },
  };
}

export interface DebtCollectionTransactionSummaryOptions {
  startDate: Date;
  endDate: Date;
  agentId?: number | null;
  accountNo?: string | null;
  topLimit?: number;
  includeTransactions?: boolean;
  debug?: boolean;
}

export async function getDebtCollectionTransactionSummary(
  options: DebtCollectionTransactionSummaryOptions,
) {
  const startDate = new Date(options.startDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = normalizeEndOfDay(options.endDate);
  const endExclusive = new Date(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);

  const queryOptions = {
    startOle: toOleDateOnly(startDate),
    endOle: toOleDateOnly(endExclusive),
    agentId: options.agentId ?? null,
    accountNo: options.accountNo ?? null,
  };

  const basePaymentsQuery = buildPaymentBaseQuery(queryOptions);
  const verifiedPaymentsQuery = buildVerifiedPaymentQuery(queryOptions);
  const topLimit = Math.max(1, Math.min(asInt(options.topLimit) ?? 10, 50));

  const debugPayload = options.debug
    ? await buildTransactionDebugPayload({
        startDate,
        endDate,
        startOle: queryOptions.startOle,
        endOle: queryOptions.endOle,
        agentId: queryOptions.agentId,
        accountNo: queryOptions.accountNo,
        basePaymentsQuery,
        verifiedPaymentsQuery,
      })
    : null;

  if (options.debug) {
    console.log("[transactions.debug]", JSON.stringify(debugPayload, null, 2));
  }

  const totalRows = await soapSelect<{ VerifiedIncome: string | number; TransactionCount: string | number }>(`
    SELECT
      SUM(p.Amount) AS VerifiedIncome,
      COUNT(*) AS TransactionCount
    FROM (${verifiedPaymentsQuery}) p
  `);

  const timelineRows = await soapSelect<{ DateLabel: string; Value: string | number; Count: string | number }>(`
    SELECT
      CONVERT(varchar(10), p.TranDate, 23) AS DateLabel,
      SUM(p.Amount) AS Value,
      COUNT(*) AS Count
    FROM (${verifiedPaymentsQuery}) p
    GROUP BY CONVERT(varchar(10), p.TranDate, 23)
    ORDER BY DateLabel
  `);

  const agentRows = await soapSelect<{ AgentName: string; Value: string | number; Count: string | number }>(`
    SELECT
      p.AgentName,
      SUM(p.Amount) AS Value,
      COUNT(*) AS Count
    FROM (${verifiedPaymentsQuery}) p
    GROUP BY p.AgentName
    ORDER BY SUM(p.Amount) DESC
  `);

  const topAccountRows = await soapSelect<{
    AccountNo: string;
    BPName: string;
    AgentName: string;
    AmountPaid: string | number;
    TransactionCount: string | number;
    LastPaymentAt: string | null;
  }>(`
    SELECT TOP ${topLimit}
      p.AccountNo,
      p.BPName,
      p.AgentName,
      SUM(p.Amount) AS AmountPaid,
      COUNT(*) AS TransactionCount,
      CONVERT(varchar(19), MAX(p.TranDate), 120) AS LastPaymentAt
    FROM (${verifiedPaymentsQuery}) p
    GROUP BY p.AccountNo, p.BPName, p.AgentName
    ORDER BY SUM(p.Amount) DESC
  `);

  const transactionRows = options.includeTransactions
    ? await soapSelect<{
        AccountNo: string;
        BPName: string;
        AgentName: string;
        Amount: string | number;
        TranDate: string | null;
        JournalNo: string | number | null;
        Description: string | null;
      }>(`
        SELECT TOP 100
          p.AccountNo,
          p.BPName,
          p.AgentName,
          p.Amount,
          CONVERT(varchar(19), p.TranDate, 120) AS TranDate,
          p.JournalNo,
          p.Description
        FROM (${verifiedPaymentsQuery}) p
        ORDER BY p.TranDate DESC
      `)
    : [];

  return {
    verifiedIncome: asNumber(totalRows[0]?.VerifiedIncome),
    transactionCount: asNumber(totalRows[0]?.TransactionCount),
    paymentsTimeline: timelineRows.map((row) => ({
      date: String(row.DateLabel ?? ""),
      value: asNumber(row.Value),
      count: asNumber(row.Count),
    })),
    agentCollections: agentRows.map((row) => ({
      name: String(row.AgentName ?? "Unassigned"),
      value: asNumber(row.Value),
      count: asNumber(row.Count),
    })),
    topPaidAccounts: topAccountRows.map((row) => ({
      accountNo: String(row.AccountNo ?? ""),
      debtorName: String(row.BPName ?? "Unknown"),
      agentName: String(row.AgentName ?? "Unassigned"),
      amountPaid: asNumber(row.AmountPaid),
      transactionCount: asNumber(row.TransactionCount),
      lastPaymentAt: row.LastPaymentAt ? String(row.LastPaymentAt) : null,
    })),
    transactions: transactionRows.map((row) => ({
      accountNo: String(row.AccountNo ?? ""),
      debtorName: String(row.BPName ?? "Unknown"),
      agentName: String(row.AgentName ?? "Unassigned"),
      amount: asNumber(row.Amount),
      tranDate: row.TranDate ? String(row.TranDate) : null,
      journalNo: row.JournalNo ?? null,
      description: row.Description ? String(row.Description) : null,
    })),
    debug: debugPayload,
    source: "JournalTrans GL 1070 credits",
    rule:
      "Only non-reversal GL 1070 credit transactions linked to DebtCase accounts and dated at least 30 days after DebtCase.TerminationDate are counted.",
    note:
      "DebtCase.PaymentReceived is intentionally excluded from verified income because it is user-marked and can be wrong.",
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

export class TransactionsController {
  /**
   * GET /api/debt-manager/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD&agentId=1
   */
  static async getSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate, startOle, endOle } = parseTransactionDateRange(req);
      const agentId = asPositiveInt(req.query.agentId);
      const debug = String(req.query.debug ?? "").toLowerCase() === "true";

      if (debug) {
        console.log("[transactions.request]", {
          query: req.query,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          startOle,
          endOle,
          agentId,
        });
      }

      const data = await getDebtCollectionTransactionSummary({
        startDate,
        endDate,
        agentId,
        topLimit: asInt(req.query.topLimit) ?? 10,
        includeTransactions: String(req.query.includeTransactions ?? "").toLowerCase() === "true",
        debug,
      });

      return res.json({ success: true, data });
    } catch (error) {
      console.error("getTransactionSummary error:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to load transactions",
      });
    }
  }

  /**
   * GET /api/debt-manager/transactions/case/:id
   *
   * For debtor-case-page. Resolves DebtCase.AccountNo and returns verified
   * payments from JournalTrans for that one new DebtCase account.
   */
  static async getCaseTransactions(req: Request, res: Response) {
    try {
      const debtCaseId = asInt(req.params.id ?? req.query.debtCaseId);

      if (debtCaseId === null) {
        return res.status(400).json({ success: false, message: "Debt case id required" });
      }

      const caseRows = await soapSelect<{
        DebtCaseID: string | number;
        AccountNo: string;
        DebtorName: string;
        TotalOutstanding: string | number;
      }>(`
        SELECT TOP 1
          DebtCaseID,
          AccountNo,
          DebtorName,
          ISNULL(TotalOutstanding,0) AS TotalOutstanding
        FROM [TestMetermisDB].[dbo].[DebtCase]
        WHERE DebtCaseID = ${debtCaseId}
      `);

      if (!caseRows.length) {
        return res.status(404).json({ success: false, message: "Debt case not found" });
      }

      const debtCase = caseRows[0];
      const { startDate, endDate } = parseTransactionDateRange(req);

      const summary = await getDebtCollectionTransactionSummary({
        startDate,
        endDate,
        accountNo: debtCase.AccountNo,
        topLimit: 10,
        includeTransactions: true,
        debug: String(req.query.debug ?? "").toLowerCase() === "true",
      });

      const totalOutstanding = asNumber(debtCase.TotalOutstanding);
      const verifiedPaid = summary.verifiedIncome;
      const calculatedRemaining = Math.max(totalOutstanding - verifiedPaid, 0);
      const progressPercent =
        totalOutstanding > 0
          ? Math.min(100, Math.round((verifiedPaid / totalOutstanding) * 100))
          : verifiedPaid > 0
            ? 100
            : 0;

      return res.json({
        success: true,
        data: {
          debtCase: {
            debtCaseId: debtCase.DebtCaseID,
            accountNo: debtCase.AccountNo,
            debtorName: debtCase.DebtorName,
            totalOutstanding,
          },
          money: {
            verifiedPaid,
            calculatedRemaining,
            progressPercent,
            transactionCount: summary.transactionCount,
            lastPaymentAt: summary.transactions[0]?.tranDate ?? null,
            source: summary.source,
            rule: summary.rule,
            note: summary.note,
          },
          transactions: summary.transactions,
          timeline: summary.paymentsTimeline,
        },
      });
    } catch (error) {
      console.error("getCaseTransactions error:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to load case transactions",
      });
    }
  }
}
