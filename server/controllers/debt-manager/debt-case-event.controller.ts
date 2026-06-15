import { Request, Response } from "express";
import { sendEmail } from "../../services/emailService.js";
import emailRateLimiter from "../../utils/emailRateLimiter.js";
import { sendDebtWhatsAppTemplate } from "../../services/debt-whatsapp.service";
import { soapSelect, soapWrite } from "../../lib/debt-case-soap";
import { awardExperiencePoints } from "../../services/gamification.service";

const DB_NAME = process.env.DEBT_CASE_DB_NAME ?? "TestMetermisDB";
const DB_SCHEMA = `[${DB_NAME}].[dbo]`;

const TABLES = {
  cases: `${DB_SCHEMA}.[DebtCase]`,
  statuses: `${DB_SCHEMA}.[DebtCaseStatus]`,
  events: `${DB_SCHEMA}.[DebtCaseEvent]`,
  eventTypes: `${DB_SCHEMA}.[DebtCaseEventType]`,
  agents: `${DB_SCHEMA}.[DebtCaseAgents]`,
};

type WorkflowStatus =
  | "UNASSIGNED"
  | "FIRST_CONTACT"
  | "REMINDER_7D"
  | "FOLLOW_UP_7D"
  | "REMINDER_14D"
  | "RESOLUTION"
  | "ITC"
  | "LEGAL"
  | "ARRANGEMENT"
  | "PAID";

interface DebtCaseRow {
  DebtCaseID: number | string;
  AccountNo: string;
  DebtorName: string;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  TotalOutstanding?: number | string | null;
  CurrentStatusID?: number | string | null;
  CurrentStatusName?: string | null;
  CurrentOwnerAgentID?: number | string | null;
  CurrentOwnerName?: string | null;
  Priority?: string | null;
  RecommendedPath?: string | null;
  InvoiceSent?: boolean | number | string | null;
  InvoiceSentAt?: string | null;
  FinalDemandSent?: boolean | number | string | null;
  FinalDemandSentAt?: string | null;
  Reminder7DueAt?: string | null;
  Reminder14DueAt?: string | null;
  ResolutionType?: string | null;
  ArrangementActive?: boolean | number | string | null;
  PaymentReceived?: boolean | number | string | null;
  PaymentReceivedAt?: string | null;
  EscalatedToSuperior?: boolean | number | string | null;
  InternalNotes?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

type AttachmentInput = {
  filename?: string;
  content?: string;
  contentType?: string;
};

type RequestUser = {
  fullName?: string;
  name?: string;
  username?: string;
  userName?: string;
};

function asInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return false;
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sqlString(value?: string | null): string {
  if (value == null || value === "") return "NULL";
  return `N'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value?: number | null): string {
  return value == null ? "NULL" : String(value);
}

function sqlBit(value?: boolean | null): string {
  return value ? "1" : "0";
}

function sqlDate(value?: string | Date | null): string {
  if (!value) return "NULL";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "NULL";
  return `CAST(${sqlString(date.toISOString())} AS DATETIME2)`;
}

function prettyEventName(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function mapApiStatus(status?: string | null): WorkflowStatus {
  const normalized = normalizeText(status);

  if (normalized === "unassigned") return "UNASSIGNED";
  if (normalized === "first_contact" || normalized === "invoice_due") {
    return "FIRST_CONTACT";
  }
  if (normalized === "reminder_7d" || normalized === "final_demand") {
    return "REMINDER_7D";
  }
  // A dedicated follow up stage exists after the initial 7 day reminder. Map
  // both kebab and underscore forms to the unified workflow type. Without
  // this mapping the front end cannot display "FOLLOW_UP_7D" entries.
  if (normalized === "follow_up_7d" || normalized === "follow-up-7d") {
    return "FOLLOW_UP_7D";
  }
  if (normalized === "reminder_14d") return "REMINDER_14D";
  if (normalized === "resolution") return "RESOLUTION";
  if (normalized === "itc" || normalized === "itc_legal") return "ITC";
  if (normalized === "legal") return "LEGAL";
  if (normalized === "arrangement") return "ARRANGEMENT";
  if (normalized === "paid") return "PAID";

  return "UNASSIGNED";
}

function getEmailRateLimitIdentifier(
  req: Request,
  triggeredByAgentId?: number | null,
): string {
  const user = (req as Request & { user?: RequestUser & { id?: string | number; email?: string } }).user;

  return (
    String(triggeredByAgentId ?? "") ||
    String(user?.id ?? "") ||
    user?.email ||
    user?.username ||
    req.ip ||
    "SYSTEM"
  );
}

function getRequestedBy(req: Request): string {
  const user = (req as Request & { user?: RequestUser }).user;
  return (
    user?.fullName ||
    user?.name ||
    user?.username ||
    user?.userName ||
    "SYSTEM"
  );
}

function parseAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return (raw as AttachmentInput[]).map((att, index) => {
    if (!att?.filename || !att?.content) {
      throw new Error(`Invalid attachment at index ${index}`);
    }

    return {
      filename: att.filename,
      content: Buffer.from(att.content, "base64"),
      contentType: att.contentType || "application/octet-stream",
    };
  });
}

function extractExternalReference(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const candidate =
    obj.messageId ??
    obj.id ??
    obj.requestId ??
    obj.reference ??
    obj.wamid;

  if (candidate == null) return null;
  return String(candidate);
}

async function getDebtCaseOrThrow(debtCaseId: number): Promise<DebtCaseRow> {
  const rows = await soapSelect(`
    SELECT TOP 1
      c.DebtCaseID,
      c.AccountNo,
      c.DebtorName,
      c.ContactPhone,
      c.ContactEmail,
      c.TotalOutstanding,
      c.CurrentStatusID,
      s.StatusName AS CurrentStatusName,
      c.CurrentOwnerAgentID,
      a.AgentName AS CurrentOwnerName,
      c.Priority,
      c.RecommendedPath,
      c.InvoiceSent,
      c.InvoiceSentAt,
      c.FinalDemandSent,
      c.FinalDemandSentAt,
      c.Reminder7DueAt,
      c.Reminder14DueAt,
      c.ResolutionType,
      c.ArrangementActive,
      c.PaymentReceived,
      c.PaymentReceivedAt,
      c.EscalatedToSuperior,
      c.InternalNotes,
      c.CreatedAt,
      c.UpdatedAt
    FROM ${TABLES.cases} c
    LEFT JOIN ${TABLES.statuses} s ON s.StatusID = c.CurrentStatusID
    LEFT JOIN ${TABLES.agents} a ON a.ID = c.CurrentOwnerAgentID
    WHERE c.DebtCaseID = ${debtCaseId};
  `);

  const row = rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error("Debt case not found");
  }

  if (row.DebtCaseID == null || row.AccountNo == null || row.DebtorName == null) {
    throw new Error("Debt case row is missing required fields");
  }

  return row as unknown as DebtCaseRow;
}

async function getStatusIdOrThrow(statusName: string): Promise<number> {
  const rows = await soapSelect(`
    SELECT TOP 1 StatusID
    FROM ${TABLES.statuses}
    WHERE UPPER(StatusName) = UPPER(${sqlString(statusName)});
  `);

  const statusId = asInt((rows[0] as Record<string, unknown> | undefined)?.StatusID);
  if (!statusId) {
    throw new Error(`Could not resolve status id for ${statusName}`);
  }

  return statusId;
}

async function ensureEventTypeId(
  eventTypeName: string,
  options?: { description?: string; isTaskType?: boolean },
): Promise<number> {
  const safeName = eventTypeName.trim();
  const description = options?.description ?? safeName;
  const isTaskType = options?.isTaskType ?? false;

  const existingRows = await soapSelect<{ EventTypeID?: string | number }>(`
    SELECT TOP 1 EventTypeID
    FROM ${TABLES.eventTypes}
    WHERE UPPER(EventTypeName) = UPPER(${sqlString(safeName)});
  `);

  const existingId = asInt(existingRows[0]?.EventTypeID);
  if (existingId) {
    return existingId;
  }

  const nextIdRows = await soapSelect<{ NextEventTypeID?: string | number }>(`
    SELECT ISNULL(MAX(EventTypeID), 0) + 1 AS NextEventTypeID
    FROM ${TABLES.eventTypes};
  `);

  const nextEventTypeId = asInt(nextIdRows[0]?.NextEventTypeID);
  if (!nextEventTypeId) {
    throw new Error(`Could not generate EventTypeID for ${safeName}`);
  }

  await soapWrite(`
    INSERT INTO ${TABLES.eventTypes} (
      EventTypeID,
      EventTypeName,
      Description,
      IsTaskType,
      CreatedAt
    )
    VALUES (
      ${nextEventTypeId},
      ${sqlString(safeName)},
      ${sqlString(description)},
      ${sqlBit(isTaskType)},
      GETDATE()
    );
  `);

  return nextEventTypeId;
}
async function insertDebtCaseEvent(params: {
  debtCaseId: number;
  eventTypeName: string;
  eventTypeDescription?: string;
  isTaskType?: boolean;
  triggeredByAgentId?: number | null;
  relatedAgentId?: number | null;
  fromStatusId?: number | null;
  toStatusId?: number | null;
  title?: string | null;
  eventText?: string | null;
  reason?: string | null;
  dueAt?: string | Date | null;
  completedAt?: string | Date | null;
  taskStatus?: string | null;
  communicationType?: string | null;
  direction?: string | null;
  successFlag?: boolean | null;
  recipientName?: string | null;
  recipientAddress?: string | null;
  subjectLine?: string | null;
  messageBody?: string | null;
  includesInvoice?: boolean | null;
  includesFinalDemand?: boolean | null;
  resolutionType?: string | null;
  fileName?: string | null;
  externalReference?: string | null;
}) {
  const eventTypeId = await ensureEventTypeId(params.eventTypeName, {
    description: params.eventTypeDescription,
    isTaskType: params.isTaskType,
  });

  await soapWrite(`
    INSERT INTO ${TABLES.events} (
      DebtCaseID,
      EventTypeID,
      TriggeredByAgentID,
      RelatedAgentID,
      FromStatusID,
      ToStatusID,
      Title,
      EventText,
      Reason,
      DueAt,
      CompletedAt,
      TaskStatus,
      CommunicationType,
      Direction,
      SuccessFlag,
      RecipientName,
      RecipientAddress,
      SubjectLine,
      MessageBody,
      IncludesInvoice,
      IncludesFinalDemand,
      ResolutionType,
      FileName,
      ExternalReference,
      CreatedAt
    )
    VALUES (
      ${sqlInt(params.debtCaseId)},
      ${sqlInt(eventTypeId)},
      ${sqlInt(params.triggeredByAgentId ?? null)},
      ${sqlInt(params.relatedAgentId ?? null)},
      ${sqlInt(params.fromStatusId ?? null)},
      ${sqlInt(params.toStatusId ?? null)},
      ${sqlString(params.title ?? null)},
      ${sqlString(params.eventText ?? null)},
      ${sqlString(params.reason ?? null)},
      ${sqlDate(params.dueAt ?? null)},
      ${sqlDate(params.completedAt ?? null)},
      ${sqlString(params.taskStatus ?? null)},
      ${sqlString(params.communicationType ?? null)},
      ${sqlString(params.direction ?? null)},
      ${sqlBit(params.successFlag ?? null)},
      ${sqlString(params.recipientName ?? null)},
      ${sqlString(params.recipientAddress ?? null)},
      ${sqlString(params.subjectLine ?? null)},
      ${sqlString(params.messageBody ?? null)},
      ${sqlBit(params.includesInvoice ?? null)},
      ${sqlBit(params.includesFinalDemand ?? null)},
      ${sqlString(params.resolutionType ?? null)},
      ${sqlString(params.fileName ?? null)},
      ${sqlString(params.externalReference ?? null)},
      GETDATE()
    );
  `);
}

async function updateDebtCaseColumns(
  debtCaseId: number,
  setClauses: string[],
): Promise<void> {
  if (!setClauses.length) return;

  await soapWrite(`
    UPDATE ${TABLES.cases}
    SET
      ${setClauses.join(",\n      ")},
      UpdatedAt = GETDATE()
    WHERE DebtCaseID = ${debtCaseId};
  `);
}

async function moveCaseToStatus(params: {
  debtCaseId: number;
  statusName: string;
  triggeredByAgentId?: number | null;
  note: string;
  extraSetClauses?: string[];
}) {
  const currentCase = await getDebtCaseOrThrow(params.debtCaseId);
  const fromStatusId = asInt(currentCase.CurrentStatusID);
  const toStatusId = await getStatusIdOrThrow(params.statusName);

  await updateDebtCaseColumns(params.debtCaseId, [
    `CurrentStatusID = ${toStatusId}`,
    `StatusStartedAt = GETDATE()`,
    ...(params.extraSetClauses ?? []),
  ]);

  await insertDebtCaseEvent({
    debtCaseId: params.debtCaseId,
    eventTypeName: "STATUS_AUTO_PROGRESS",
    eventTypeDescription: "Automatic workflow status progression",
    triggeredByAgentId: params.triggeredByAgentId ?? null,
    fromStatusId,
    toStatusId,
    title: "Status progressed automatically",
    eventText: params.note,
    reason: params.note,
    completedAt: new Date(),
    taskStatus: null,
  });
}

export async function listDebtCaseEvents(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({
      success: false,
      message: "Invalid debt case id",
    });
  }

  try {
    const rows = await soapSelect(`
      SELECT
        e.DebtCaseEventID,
        e.DebtCaseID,
        e.EventTypeID,
        t.EventTypeName AS EventTypeName,
        t.EventTypeName AS EventTypeCode,

        e.CommunicationType AS Channel,
        e.Title,
        e.SubjectLine AS Subject,
        e.MessageBody AS Body,
        COALESCE(e.Reason, e.EventText) AS Note,
        e.DueAt AS ReminderAt,

        e.EventText,
        e.Reason,
        e.CompletedAt,
        e.TaskStatus,
        e.Direction,
        e.SuccessFlag,
        e.RecipientName,
        e.RecipientAddress,
        e.IncludesInvoice,
        e.IncludesFinalDemand,
        e.ResolutionType,
        e.FileName,
        e.ExternalReference,

        e.TriggeredByAgentID,
        a.AgentName AS TriggeredByAgentName,
        e.CreatedAt,

        CAST(NULL AS NVARCHAR(MAX)) AS MetadataJson
      FROM ${TABLES.events} e
      LEFT JOIN ${TABLES.eventTypes} t ON t.EventTypeID = e.EventTypeID
      LEFT JOIN ${TABLES.agents} a ON a.ID = e.TriggeredByAgentID
      WHERE e.DebtCaseID = ${debtCaseId}
      ORDER BY e.CreatedAt DESC, e.DebtCaseEventID DESC;
    `);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("listDebtCaseEvents error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load debt case events",
    });
  }
}

export async function createDebtCaseCommunicationEvent(
  req: Request,
  res: Response,
) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({
      success: false,
      message: "Invalid debt case id",
    });
  }

  try {
    const debtCase = await getDebtCaseOrThrow(debtCaseId);

    const channel = normalizeText(req.body.channel);
    const subject = String(req.body.subject ?? "").trim();
    const body = String(req.body.body ?? "").trim();
    const html = String(req.body.html ?? "").trim();
    const sendNow = asBool(req.body.sendNow);
    const attachInvoice = asBool(req.body.attachInvoice);
    const markContactSuccessful = asBool(req.body.markContactSuccessful);
    const actionType = String(req.body.actionType ?? "CASE_COMMUNICATION").toUpperCase();
    const triggeredByAgentId = asInt(req.body.triggeredByAgentId);
    const recipientEmail = String(
      req.body.recipientEmail ?? debtCase.ContactEmail ?? "",
    ).trim();
    const recipientPhone = String(
      req.body.recipientPhone ?? debtCase.ContactPhone ?? "",
    ).trim();
    const templateName = String(req.body.templateName ?? "").trim();
    const languageCode = String(req.body.languageCode ?? "en").trim() || "en";
    const variables = Array.isArray(req.body.variables)
      ? req.body.variables.map((value: unknown) => String(value ?? ""))
      : [];
    const requestedBy = getRequestedBy(req);

    if (!["email", "whatsapp", "phone"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid communication channel",
      });
    }

    if (channel === "phone" && !body) {
      return res.status(400).json({
        success: false,
        message: "Phone log notes are required",
      });
    }

    if (channel === "email") {
      if (!body && !html) {
        return res.status(400).json({
          success: false,
          message: "Email content is required",
        });
      }

      if (sendNow && (!recipientEmail || !subject)) {
        return res.status(400).json({
          success: false,
          message: "Email recipient and subject are required",
        });
      }
    }

    if (channel === "whatsapp") {
      if (!templateName && !body) {
        return res.status(400).json({
          success: false,
          message: "WhatsApp templateName or log body is required",
        });
      }

      if (sendNow && (!recipientPhone || !templateName)) {
        return res.status(400).json({
          success: false,
          message: "WhatsApp recipient phone and templateName are required",
        });
      }
    }

    const attachments = parseAttachments(req.body.attachments);
    let externalReference: string | null = null;
    const fallbackMessageBody =
      body ||
      html ||
      (templateName
        ? `Template: ${templateName}${variables.length ? ` | Variables: ${variables.join(" | ")}` : ""}`
        : "");

if (sendNow && channel === "email") {
  const rateIdentifier = getEmailRateLimitIdentifier(req, triggeredByAgentId);
  const limitCheck = emailRateLimiter.checkLimit(rateIdentifier);

  if (!limitCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: limitCheck.reason,
    });
  }

  const result = await sendEmail({
    to: recipientEmail,
    subject,
    text: body || undefined,
    html: html || undefined,
    attachments,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  emailRateLimiter.recordAttempt(rateIdentifier);
  externalReference = extractExternalReference(result);
}

    if (sendNow && channel === "whatsapp") {
      const result = await sendDebtWhatsAppTemplate({
        to: recipientPhone,
        templateName,
        languageCode,
        variables,
        appName: String(req.body.appName ?? "DebtCollection"),
        requestedBy,
      });

      externalReference = extractExternalReference(result);
    }

    const eventTypeName =
      channel === "email"
        ? sendNow
          ? "EMAIL_SENT"
          : "EMAIL_SAVED"
        : channel === "whatsapp"
          ? sendNow
            ? "WHATSAPP_SENT"
            : "WHATSAPP_SAVED"
          : "PHONE_LOGGED";

    await insertDebtCaseEvent({
      debtCaseId,
      eventTypeName,
      eventTypeDescription: "Debt case communication action",
      triggeredByAgentId,
      fromStatusId: asInt(debtCase.CurrentStatusID),
      title:
        actionType === "INVOICE_SENT"
          ? "Invoice communication"
          : channel === "phone"
            ? "Phone log"
            : "Communication",
      eventText: fallbackMessageBody || null,
      reason:
        actionType === "INVOICE_SENT"
          ? "Invoice communication recorded from debt flow."
          : "Communication recorded from debt flow.",
      completedAt: new Date(),
      taskStatus: null,
      communicationType: channel.toUpperCase(),
      direction: "OUTBOUND",
      successFlag: channel === "phone" ? markContactSuccessful : sendNow,
      recipientName: debtCase.DebtorName,
      recipientAddress:
        channel === "email"
          ? recipientEmail || null
          : channel === "whatsapp"
            ? recipientPhone || null
            : debtCase.ContactPhone ?? null,
      subjectLine: channel === "email" ? subject || null : null,
      messageBody: fallbackMessageBody || null,
      includesInvoice: attachInvoice,
      includesFinalDemand: false,
      fileName: attachments[0]?.filename ?? null,
      externalReference,
    });

    const currentStatus = mapApiStatus(debtCase.CurrentStatusName);

    if (
      currentStatus === "FIRST_CONTACT" &&
      sendNow &&
      (attachInvoice || actionType === "INVOICE_SENT")
    ) {
      await updateDebtCaseColumns(debtCaseId, [
        `InvoiceSent = 1`,
        `InvoiceSentAt = GETDATE()`,
        `Reminder7DueAt = DATEADD(DAY, 7, GETDATE())`,
      ]);

      await moveCaseToStatus({
        debtCaseId,
        statusName: "REMINDER_7D",
        triggeredByAgentId,
        note:
          "Invoice was recorded as sent. Case moved automatically into the 7 day reminder cycle.",
      });
    } else if (
      currentStatus === "UNASSIGNED" &&
      markContactSuccessful &&
      triggeredByAgentId
    ) {
      const firstContactStatusId = await getStatusIdOrThrow("FIRST_CONTACT");

      await updateDebtCaseColumns(debtCaseId, [
        `CurrentOwnerAgentID = ISNULL(CurrentOwnerAgentID, ${triggeredByAgentId})`,
        `CurrentStatusID = ${firstContactStatusId}`,
        `StatusStartedAt = GETDATE()`,
      ]);

    await insertDebtCaseEvent({
  debtCaseId,
  eventTypeName,
  eventTypeDescription: "Debt case communication action",
  triggeredByAgentId,
  fromStatusId: asInt(debtCase.CurrentStatusID),
  title:
    actionType === "INVOICE_SENT"
      ? "Invoice communication"
      : channel === "phone"
        ? "Phone log"
        : "Communication",
  eventText: fallbackMessageBody || null,
  reason:
    actionType === "INVOICE_SENT"
      ? "Invoice communication recorded from debt flow."
      : "Communication recorded from debt flow.",
  completedAt: new Date(),
  taskStatus: null,
  communicationType: channel.toUpperCase(),
  direction: "OUTBOUND",
  successFlag: channel === "phone" ? markContactSuccessful : sendNow,
  recipientName: debtCase.DebtorName,
  recipientAddress:
    channel === "email"
      ? recipientEmail || null
      : channel === "whatsapp"
        ? recipientPhone || null
        : debtCase.ContactPhone ?? null,
  subjectLine: channel === "email" ? subject || null : null,
  messageBody: fallbackMessageBody || null,
  includesInvoice: attachInvoice,
  includesFinalDemand: false,
  fileName: attachments[0]?.filename ?? null,
  externalReference,
});
    }

    return res.json({
      success: true,
      message: "Communication action recorded successfully",
    });
  } catch (error) {
    console.error("createDebtCaseCommunicationEvent error:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to record communication event",
    });
  }
}

export async function createDebtCaseReminderEvent(
  req: Request,
  res: Response,
) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({
      success: false,
      message: "Invalid debt case id",
    });
  }

  try {
    const remindAt = req.body.remindAt ? new Date(req.body.remindAt) : null;
    const title = String(req.body.title ?? "Debt case reminder").trim();
    const note = String(req.body.note ?? "").trim();
    const stage = String(req.body.stage ?? "").trim();
    const triggeredByAgentId = asInt(req.body.triggeredByAgentId);

    if (!remindAt || Number.isNaN(remindAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Valid remindAt is required",
      });
    }

    const debtCase = await getDebtCaseOrThrow(debtCaseId);

    await insertDebtCaseEvent({
      debtCaseId,
      eventTypeName: "REMINDER_CREATED",
      eventTypeDescription: "Debt case follow-up reminder",
      isTaskType: true,
      triggeredByAgentId,
      fromStatusId: asInt(debtCase.CurrentStatusID),
      title,
      eventText: note || title,
      reason: stage ? `Stage: ${stage}` : "Reminder created from debt flow.",
      dueAt: remindAt,
      taskStatus: "OPEN",
      recipientName: debtCase.DebtorName,
      messageBody: note || null,
      includesInvoice: false,
      includesFinalDemand: false,
    });

    return res.json({
      success: true,
      message: "Reminder created successfully",
    });
  } catch (error) {
    console.error("createDebtCaseReminderEvent error:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create reminder",
    });
  }
}

export async function createDebtCaseEvent(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({
      success: false,
      message: "Invalid debt case id",
    });
  }

  try {
    const debtCase = await getDebtCaseOrThrow(debtCaseId);

    const rawEventType = String(req.body.eventType ?? "").trim().toUpperCase();
    const note = String(req.body.note ?? "").trim();
    const channel = String(req.body.channel ?? "").trim() || null;
    const subject = String(req.body.subject ?? "").trim() || null;
    const body = String(req.body.body ?? "").trim() || null;
    const resolutionType = String(req.body.resolutionType ?? "")
      .trim()
      .toUpperCase();
    const triggeredByAgentId = asInt(req.body.triggeredByAgentId);

    if (!rawEventType) {
      return res.status(400).json({
        success: false,
        message: "eventType is required",
      });
    }

    if (
      rawEventType === "RESOLUTION_SELECTED" &&
      !["ITC", "LEGAL", "ARRANGEMENT", "PAID"].includes(resolutionType)
    ) {
      return res.status(400).json({
        success: false,
        message: "resolutionType must be ITC, LEGAL, ARRANGEMENT, or PAID",
      });
    }

    const currentStatus = mapApiStatus(debtCase.CurrentStatusName);

    await insertDebtCaseEvent({
      debtCaseId,
      eventTypeName: rawEventType,
      eventTypeDescription: prettyEventName(rawEventType),
      triggeredByAgentId,
      fromStatusId: asInt(debtCase.CurrentStatusID),
      title: prettyEventName(rawEventType),
      eventText: body || note || `${prettyEventName(rawEventType)} recorded from debt flow.`,
      reason: note || `${prettyEventName(rawEventType)} recorded from debt flow.`,
      completedAt: new Date(),
      taskStatus: null,
      communicationType: channel ? channel.toUpperCase() : null,
      // Direction should be outbound for all events or null when not applicable.
      // Using null avoids conflicts with the CK_DebtCaseEvent_Direction check constraint.
      direction: channel ? "OUTBOUND" : null,
      successFlag: true,
      recipientName: debtCase.DebtorName,
      subjectLine: subject,
      messageBody: body,
      includesInvoice: false,
      includesFinalDemand: rawEventType === "FINAL_DEMAND_SENT",
      resolutionType: resolutionType || null,
    });

    if (rawEventType === "FINAL_DEMAND_SENT") {
      await updateDebtCaseColumns(debtCaseId, [
        `FinalDemandSent = 1`,
        `FinalDemandSentAt = GETDATE()`,
        `Reminder14DueAt = DATEADD(DAY, 14, GETDATE())`,
      ]);

      await moveCaseToStatus({
        debtCaseId,
        statusName: "REMINDER_14D",
        triggeredByAgentId,
        note:
          "Final demand was recorded. Case moved automatically into the 14 day reminder cycle.",
      });

      // Award a modest amount of XP and coins for sending a final demand. This
      // recognises the administrative work required. The values can be
      // tuned via gamification.service.ts.
      await awardExperiencePoints(triggeredByAgentId, 10, 5);
    }

    // When a follow‑up is completed, move the case into the follow‑up waiting stage.
    // This explicit handling ensures that cases progress correctly even if the follow‑up
    // occurs earlier than the scheduled 7 day wait.
    if (rawEventType === "FOLLOW_UP_SENT") {
      await moveCaseToStatus({
        debtCaseId,
        statusName: "FOLLOW_UP_7D",
        triggeredByAgentId,
        note:
          note ||
          "Follow‑up recorded. Case moved automatically into the post follow‑up 7 day waiting period.",
      });

      // Optionally award experience for completing the follow‑up
      await awardExperiencePoints(triggeredByAgentId, 5, 2);
    }

    if (rawEventType === "RESOLUTION_SELECTED") {
      const extraSetClauses: string[] = [
        `ResolutionType = ${sqlString(resolutionType)}`,
      ];

      if (resolutionType === "ARRANGEMENT") {
        extraSetClauses.push(`ArrangementActive = 1`);
      }

      if (resolutionType === "PAID") {
        extraSetClauses.push(`PaymentReceived = 1`);
        extraSetClauses.push(`PaymentReceivedAt = GETDATE()`);
      }

      await moveCaseToStatus({
        debtCaseId,
        statusName: resolutionType,
        triggeredByAgentId,
        note: `Resolution confirmed as ${resolutionType}. Case moved automatically.`,
        extraSetClauses,
      });

      // Award extra XP and coins for confirming a resolution. This is a key
      // milestone in the workflow so the reward is higher.
      await awardExperiencePoints(triggeredByAgentId, 20, 10);
    }

    if (rawEventType === "PAYMENT_RECEIVED") {
      await moveCaseToStatus({
        debtCaseId,
        statusName: "PAID",
        triggeredByAgentId,
        note: "Payment was recorded. Case moved automatically to paid.",
        extraSetClauses: [
          `PaymentReceived = 1`,
          `PaymentReceivedAt = GETDATE()`,
        ],
      });

      // Receiving payment is the primary goal. Reward generously.
      await awardExperiencePoints(triggeredByAgentId, 30, 15);
    }

    if (rawEventType === "ESCALATED_TO_SUPERIOR") {
      await updateDebtCaseColumns(debtCaseId, [
        `EscalatedToSuperior = 1`,
      ]);

      // Escalations are important decisions but less frequent, reward modestly.
      await awardExperiencePoints(triggeredByAgentId, 5, 2);
    }

    if (
      currentStatus === "REMINDER_14D" &&
      rawEventType === "CASE_NOTE_ADDED" &&
      normalizeText(note).includes("resolution")
    ) {
      const resolutionStatusId = await getStatusIdOrThrow("RESOLUTION");

      await updateDebtCaseColumns(debtCaseId, [
        `CurrentStatusID = ${resolutionStatusId}`,
        `StatusStartedAt = GETDATE()`,
      ]);

      await insertDebtCaseEvent({
        debtCaseId,
        eventTypeName: "STATUS_AUTO_PROGRESS",
        eventTypeDescription: "Automatic workflow status progression",
        triggeredByAgentId,
        fromStatusId: asInt(debtCase.CurrentStatusID),
        toStatusId: resolutionStatusId,
        title: "Status progressed automatically",
        eventText: "Case moved automatically into resolution.",
        reason: "Case moved automatically into resolution.",
        completedAt: new Date(),
        taskStatus: null,
      });
    }

    return res.json({
      success: true,
      message: "Debt case event recorded successfully",
    });
  } catch (error) {
    console.error("createDebtCaseEvent error:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to record debt case event",
    });
  }
}