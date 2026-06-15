import { pgTable, varchar, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── Arrears Manager Types ─────────────────────────────────────
// Add Drizzle tables and SOAP interfaces for arrears features here

export interface ArrearsRecord {
  id: string;
  complexName: string;
  unitNumber: string;
  tenantName: string;
  amountOwing: number;
  daysOverdue: number;
}

// ── Debt Manager Types ────────────────────────────────────────
// Add Drizzle tables and SOAP interfaces for debt features here

export interface DebtRecord {
  id: string;
  complexName: string;
  unitNumber: string;
  tenantName: string;
  debtAmount: number;
  status: string;
}

// ── Shared / Admin Types ──────────────────────────────────────

export interface AdminUser {
  id: number;
  username: string;
  level: number;
}
