import xml2js from "xml2js";
import { soapClient } from "../soap-client";

const DB_NAME = process.env.DEBT_CASE_DB_NAME ?? "TestMetermisDB";
const DB_SCHEMA = `[${DB_NAME}].[dbo]`;

export const TABLES = {
  agents: `[TestMetermisDB].[dbo].[DebtCaseAgents]`,
  statuses: `[TestMetermisDB].[dbo].[DebtCaseStatus]`,
  eventTypes: `[TestMetermisDB].[dbo].[DebtCaseEventType]`,
  cases: `[TestMetermisDB].[dbo].[DebtCase]`,
  events: `[TestMetermisDB].[dbo].[DebtCaseEvent]`,
};

export const EVENT_TYPE = {
  STATUS_CHANGE: 1,
  ASSIGNMENT: 2,
  REMINDER: 3,
  COMMUNICATION: 4,
  INVOICE_SENT: 5,
  FINAL_DEMAND_SENT: 6,
  SUPERIOR_ESCALATION: 7,
  RESOLUTION: 8,
  SYSTEM_MESSAGE: 9,
  MANUAL_NOTE: 10,
} as const;

export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function asInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toSqlNVarChar(value?: string | null): string {
  if (value === undefined || value === null || value === "") return "NULL";
  return `N'${escapeSqlLiteral(value)}'`;
}

export function toSqlInt(value?: unknown | null): string {
  const n = asInt(value);
  return n === null ? "NULL" : String(n);
}

export function toSqlDecimal(value?: unknown | null): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "NULL";
}

export function toSqlBit(value?: unknown | null): string {
  return value ? "1" : "0";
}

export function toSqlDateTime(value?: string | Date | null): string {
  if (!value) return "NULL";
  const text = value instanceof Date ? value.toISOString() : value;
  return `CAST(N'${escapeSqlLiteral(text)}' AS DATETIME2)`;
}

export async function soapSelect<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const rows = await soapClient.queryMetermis(sql);
  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function getRowsAffectedFromWriteXml(xml: string): Promise<number | null> {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    normalizeTags: false,
  });

  try {
    const parsed = await parser.parseStringPromise(xml);

    const ack =
      parsed?.["soap:Envelope"]?.["soap:Body"]?.QueryMetermisResponse?.QueryMetermisResult?.DataSet?.[
        "diffgr:diffgram"
      ]?.Result?.Acknowledge ??
      parsed?.DataSet?.["diffgr:diffgram"]?.Result?.Acknowledge ??
      parsed?.["diffgr:diffgram"]?.Result?.Acknowledge;

    const rowsAffected = Number(ack?.RowsAffected);
    return Number.isFinite(rowsAffected) ? rowsAffected : null;
  } catch {
    return null;
  }
}

export async function soapWrite(sql: string): Promise<{ rowsAffected: number | null; raw: string }> {
  const raw = await soapClient.writeMetermis(sql);
  const rawText = typeof raw === "string" ? raw : String(raw ?? "");
  const rowsAffected = await getRowsAffectedFromWriteXml(rawText);

  return { rowsAffected, raw: rawText };
}