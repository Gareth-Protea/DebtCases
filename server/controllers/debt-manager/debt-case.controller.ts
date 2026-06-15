import { Request, Response } from "express";
import {
  EVENT_TYPE,
  TABLES,
  asInt,
  soapSelect,
  soapWrite,
  toSqlBit,
  toSqlDateTime,
  toSqlDecimal,
  toSqlInt,
  toSqlNVarChar,
} from "../../lib/debt-case-soap";

async function getStatusIdByName(statusName: string): Promise<number | null> {
  const sql = `
    SELECT TOP 1 StatusID
    FROM ${TABLES.statuses}
    WHERE StatusName = ${toSqlNVarChar(statusName)};
  `;

  const rows = await soapSelect<{ StatusID: string | number }>(sql);
  return asInt(rows[0]?.StatusID);
}

export async function listDebtCases(req: Request, res: Response) {
  try {
    const statusId = asInt(req.query.statusId);
    const ownerAgentId = asInt(req.query.ownerAgentId);
    const filters: string[] = [];

    if (statusId) filters.push(`c.CurrentStatusID = ${statusId}`);
    if (ownerAgentId) filters.push(`c.CurrentOwnerAgentID = ${ownerAgentId}`);

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const sql = `
      SELECT
        c.DebtCaseID,
        c.AccountNo,
        c.ComplexID,
        c.ComplexName,
        c.DebtorName,
        c.ContactPhone,
        c.ContactEmail,
        c.ProteaAmount,
        c.LandlordAmount,
        c.TotalOutstanding,
        c.TerminationDate,
        c.DebtorQualifiedDate,
        c.CurrentStatusID,
        s.StatusName AS CurrentStatusName,
        c.StatusStartedAt,
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
        c.EscalatedToSuperior,
        c.CreatedAt,
        c.UpdatedAt,
        DATEDIFF(DAY, c.TerminationDate, GETDATE()) AS DaysSinceTermination
      FROM ${TABLES.cases} c
      LEFT JOIN ${TABLES.statuses} s ON s.StatusID = c.CurrentStatusID
      LEFT JOIN ${TABLES.agents} a ON a.ID = c.CurrentOwnerAgentID
      ${whereClause}
      ORDER BY c.DebtCaseID DESC;
    `;

    const rows = await soapSelect(sql);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listDebtCases error:", error);
    return res.status(500).json({ success: false, message: "Failed to load debt cases" });
  }
}

export async function getDebtCaseById(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({ success: false, message: "Invalid debt case id" });
  }

  try {
    const caseSql = `
      SELECT TOP 1
        c.*,
        s.StatusName AS CurrentStatusName,
        a.AgentName AS CurrentOwnerName,
        r.AgentName AS ResolutionChosenByAgentName,
        sb.AgentName AS EscalatedToSuperiorByAgentName,
        sup.AgentName AS SuperiorAgentName,
        DATEDIFF(DAY, c.TerminationDate, GETDATE()) AS DaysSinceTermination
      FROM ${TABLES.cases} c
      LEFT JOIN ${TABLES.statuses} s ON s.StatusID = c.CurrentStatusID
      LEFT JOIN ${TABLES.agents} a ON a.ID = c.CurrentOwnerAgentID
      LEFT JOIN ${TABLES.agents} r ON r.ID = c.ResolutionChosenByAgentID
      LEFT JOIN ${TABLES.agents} sb ON sb.ID = c.EscalatedToSuperiorByAgentID
      LEFT JOIN ${TABLES.agents} sup ON sup.ID = c.SuperiorAgentID
      WHERE c.DebtCaseID = ${debtCaseId};
    `;

    const caseRows = await soapSelect(caseSql);
    if (!caseRows.length) {
      return res.status(404).json({ success: false, message: "Debt case not found" });
    }

    const eventsSql = `
      SELECT TOP 100
        e.*,
        et.EventTypeName,
        trig.AgentName AS TriggeredByAgentName,
        rel.AgentName AS RelatedAgentName,
        fs.StatusName AS FromStatusName,
        ts.StatusName AS ToStatusName
      FROM ${TABLES.events} e
      LEFT JOIN ${TABLES.eventTypes} et ON et.EventTypeID = e.EventTypeID
      LEFT JOIN ${TABLES.agents} trig ON trig.ID = e.TriggeredByAgentID
      LEFT JOIN ${TABLES.agents} rel ON rel.ID = e.RelatedAgentID
      LEFT JOIN ${TABLES.statuses} fs ON fs.StatusID = e.FromStatusID
      LEFT JOIN ${TABLES.statuses} ts ON ts.StatusID = e.ToStatusID
      WHERE e.DebtCaseID = ${debtCaseId}
      ORDER BY e.CreatedAt DESC, e.DebtCaseEventID DESC;
    `;

    const events = await soapSelect(eventsSql);

    return res.json({
      success: true,
      data: {
        case: caseRows[0],
        events,
      },
    });
  } catch (error) {
    console.error("getDebtCaseById error:", error);
    return res.status(500).json({ success: false, message: "Failed to load debt case" });
  }
}

export async function createDebtCase(req: Request, res: Response) {
  try {
    const body = req.body ?? {};

    if (!body.accountNo || !body.debtorName || !body.terminationDate) {
      return res.status(400).json({
        success: false,
        message: "accountNo, debtorName, and terminationDate are required",
      });
    }

    const currentStatusId =
      asInt(body.currentStatusId) ?? (await getStatusIdByName("UNASSIGNED"));

    if (!currentStatusId) {
      return res.status(500).json({
        success: false,
        message: "Could not resolve default UNASSIGNED status",
      });
    }

    const insertSql = `
      INSERT INTO ${TABLES.cases}
      (
        AccountNo,
        ComplexID,
        ComplexName,
        DebtorName,
        ContactPhone,
        ContactEmail,
        ProteaAmount,
        LandlordAmount,
        TotalOutstanding,
        TerminationDate,
        DebtorQualifiedDate,
        CurrentStatusID,
        StatusStartedAt,
        CurrentOwnerAgentID,
        Priority,
        RecommendedPath,
        InternalNotes,
        CreatedAt,
        UpdatedAt
      )
      VALUES
      (
        ${toSqlNVarChar(body.accountNo)},
        ${toSqlNVarChar(body.complexId)},
        ${toSqlNVarChar(body.complexName)},
        ${toSqlNVarChar(body.debtorName)},
        ${toSqlNVarChar(body.contactPhone)},
        ${toSqlNVarChar(body.contactEmail)},
        ${toSqlDecimal(body.proteaAmount ?? 0)},
        ${toSqlDecimal(body.landlordAmount ?? 0)},
        ${toSqlDecimal(body.totalOutstanding ?? 0)},
        CAST(${toSqlNVarChar(body.terminationDate)} AS DATE),
        ${toSqlDateTime(body.debtorQualifiedDate ?? new Date())},
        ${currentStatusId},
        SYSUTCDATETIME(),
        ${toSqlInt(body.currentOwnerAgentId)},
        ${toSqlNVarChar(body.priority ?? "Medium")},
        ${toSqlNVarChar(body.recommendedPath)},
        ${toSqlNVarChar(body.internalNotes)},
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
      );
    `;

    await soapWrite(insertSql);

    const selectBackSql = `
      SELECT TOP 1 DebtCaseID
      FROM ${TABLES.cases}
      WHERE AccountNo = ${toSqlNVarChar(body.accountNo)}
        AND DebtorName = ${toSqlNVarChar(body.debtorName)}
      ORDER BY DebtCaseID DESC;
    `;

    const idRows = await soapSelect<{ DebtCaseID: string | number }>(selectBackSql);
    const debtCaseId = asInt(idRows[0]?.DebtCaseID);

    if (!debtCaseId) {
      return res.status(500).json({ success: false, message: "Debt case created but id could not be retrieved" });
    }

    const triggeredByAgentId = asInt(body.triggeredByAgentId) ?? asInt(body.currentOwnerAgentId);
    if (triggeredByAgentId) {
      const eventSql = `
        INSERT INTO ${TABLES.events}
        (
          DebtCaseID,
          EventTypeID,
          TriggeredByAgentID,
          Title,
          EventText,
          CreatedAt
        )
        VALUES
        (
          ${debtCaseId},
          ${EVENT_TYPE.SYSTEM_MESSAGE},
          ${triggeredByAgentId},
          N'Case created',
          N'Debt case entered into workflow.',
          SYSUTCDATETIME()
        );
      `;
      await soapWrite(eventSql);
    }

    return res.status(201).json({ success: true, debtCaseId });
  } catch (error) {
    console.error("createDebtCase error:", error);
    return res.status(500).json({ success: false, message: "Failed to create debt case" });
  }
}

export async function updateDebtCase(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({ success: false, message: "Invalid debt case id" });
  }

  try {
    const body = req.body ?? {};
    const updates: string[] = [];

    if (body.contactPhone !== undefined) updates.push(`ContactPhone = ${toSqlNVarChar(body.contactPhone)}`);
    if (body.contactEmail !== undefined) updates.push(`ContactEmail = ${toSqlNVarChar(body.contactEmail)}`);
    if (body.priority !== undefined) updates.push(`Priority = ${toSqlNVarChar(body.priority)}`);
    if (body.recommendedPath !== undefined) updates.push(`RecommendedPath = ${toSqlNVarChar(body.recommendedPath)}`);
    if (body.invoiceSent !== undefined) updates.push(`InvoiceSent = ${toSqlBit(body.invoiceSent)}`);
    if (body.invoiceSentAt !== undefined) updates.push(`InvoiceSentAt = ${toSqlDateTime(body.invoiceSentAt)}`);
    if (body.invoiceFileName !== undefined) updates.push(`InvoiceFileName = ${toSqlNVarChar(body.invoiceFileName)}`);
    if (body.finalDemandSent !== undefined) updates.push(`FinalDemandSent = ${toSqlBit(body.finalDemandSent)}`);
    if (body.finalDemandSentAt !== undefined) updates.push(`FinalDemandSentAt = ${toSqlDateTime(body.finalDemandSentAt)}`);
    if (body.finalDemandFileName !== undefined) {
      updates.push(`FinalDemandFileName = ${toSqlNVarChar(body.finalDemandFileName)}`);
    }
    if (body.reminder7DueAt !== undefined) updates.push(`Reminder7DueAt = ${toSqlDateTime(body.reminder7DueAt)}`);
    if (body.reminder14DueAt !== undefined) updates.push(`Reminder14DueAt = ${toSqlDateTime(body.reminder14DueAt)}`);
    if (body.arrangementActive !== undefined) updates.push(`ArrangementActive = ${toSqlBit(body.arrangementActive)}`);
    if (body.arrangementReference !== undefined) {
      updates.push(`ArrangementReference = ${toSqlNVarChar(body.arrangementReference)}`);
    }
    if (body.paymentReceived !== undefined) updates.push(`PaymentReceived = ${toSqlBit(body.paymentReceived)}`);
    if (body.paymentReceivedAt !== undefined) updates.push(`PaymentReceivedAt = ${toSqlDateTime(body.paymentReceivedAt)}`);
    if (body.lastExternalPaymentAt !== undefined) {
      updates.push(`LastExternalPaymentAt = ${toSqlDateTime(body.lastExternalPaymentAt)}`);
    }
    if (body.lastExternalPaymentAmount !== undefined) {
      updates.push(`LastExternalPaymentAmount = ${toSqlDecimal(body.lastExternalPaymentAmount)}`);
    }
    if (body.externalBalanceCheckedAt !== undefined) {
      updates.push(`ExternalBalanceCheckedAt = ${toSqlDateTime(body.externalBalanceCheckedAt)}`);
    }
    if (body.internalNotes !== undefined) updates.push(`InternalNotes = ${toSqlNVarChar(body.internalNotes)}`);
    if (body.documentFileName !== undefined) updates.push(`DocumentFileName = ${toSqlNVarChar(body.documentFileName)}`);

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No update fields supplied" });
    }

    updates.push(`UpdatedAt = SYSUTCDATETIME()`);

    const sql = `
      UPDATE ${TABLES.cases}
      SET ${updates.join(", ")}
      WHERE DebtCaseID = ${debtCaseId};
    `;

    const { rowsAffected } = await soapWrite(sql);
    if (rowsAffected !== null && rowsAffected <= 0) {
      return res.status(404).json({ success: false, message: "Debt case not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("updateDebtCase error:", error);
    return res.status(500).json({ success: false, message: "Failed to update debt case" });
  }
}

export async function assignDebtCase(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({
      success: false,
      message: "Invalid debt case id",
    });
  }

  try {
    const targetAgentId = asInt(req.body?.targetAgentId);
    const triggeredByAgentId = asInt(req.body?.triggeredByAgentId);
    const note = req.body?.note;

    if (!targetAgentId || !triggeredByAgentId) {
      return res.status(400).json({
        success: false,
        message: "targetAgentId and triggeredByAgentId are required",
      });
    }

    const currentRows = await soapSelect<{
      CurrentOwnerAgentID?: string | number;
      CurrentStatusID?: string | number;
    }>(`
      SELECT TOP 1
        CurrentOwnerAgentID,
        CurrentStatusID
      FROM ${TABLES.cases}
      WHERE DebtCaseID = ${debtCaseId};
    `);

    if (!currentRows.length) {
      return res.status(404).json({
        success: false,
        message: "Debt case not found",
      });
    }

    const previousOwnerAgentId = asInt(currentRows[0]?.CurrentOwnerAgentID);
    const previousStatusId = asInt(currentRows[0]?.CurrentStatusID);

    const unassignedStatusRows = await soapSelect<{ StatusID?: string | number }>(`
      SELECT TOP 1 StatusID
      FROM ${TABLES.statuses}
      WHERE UPPER(StatusName) = 'UNASSIGNED';
    `);

    const firstContactStatusRows = await soapSelect<{ StatusID?: string | number }>(`
      SELECT TOP 1 StatusID
      FROM ${TABLES.statuses}
      WHERE UPPER(StatusName) = 'FIRST_CONTACT';
    `);

    const unassignedStatusId = asInt(unassignedStatusRows[0]?.StatusID);
    const firstContactStatusId = asInt(firstContactStatusRows[0]?.StatusID);

    const shouldMoveToFirstContact =
      previousStatusId !== null &&
      unassignedStatusId !== null &&
      firstContactStatusId !== null &&
      previousStatusId === unassignedStatusId;

    const updateSql = `
      UPDATE ${TABLES.cases}
      SET
        CurrentOwnerAgentID = ${targetAgentId},
        ${
          shouldMoveToFirstContact
            ? `CurrentStatusID = ${firstContactStatusId},
        StatusStartedAt = SYSUTCDATETIME(),`
            : ""
        }
        UpdatedAt = SYSUTCDATETIME()
      WHERE DebtCaseID = ${debtCaseId};
    `;

    const { rowsAffected } = await soapWrite(updateSql);

    if (rowsAffected !== null && rowsAffected <= 0) {
      return res.status(404).json({
        success: false,
        message: "Debt case not found",
      });
    }

    const verifyRows = await soapSelect<{
      CurrentOwnerAgentID?: string | number;
      CurrentStatusID?: string | number;
    }>(`
      SELECT TOP 1
        CurrentOwnerAgentID,
        CurrentStatusID
      FROM ${TABLES.cases}
      WHERE DebtCaseID = ${debtCaseId};
    `);

    const currentOwnerAgentId = asInt(verifyRows[0]?.CurrentOwnerAgentID);
    const currentStatusId = asInt(verifyRows[0]?.CurrentStatusID);

    if (currentOwnerAgentId !== targetAgentId) {
      return res.status(500).json({
        success: false,
        message: "Debt case event was logged, but case owner was not updated",
      });
    }

    const eventSql = `
      INSERT INTO ${TABLES.events}
      (
        DebtCaseID,
        EventTypeID,
        TriggeredByAgentID,
        RelatedAgentID,
        Title,
        EventText,
        Reason,
        CreatedAt
      )
      VALUES
      (
        ${debtCaseId},
        ${EVENT_TYPE.ASSIGNMENT},
        ${triggeredByAgentId},
        ${targetAgentId},
        N'Case assigned',
        N'Case assigned to agent.',
        ${toSqlNVarChar(note)},
        SYSUTCDATETIME()
      );
    `;
    await soapWrite(eventSql);

    return res.json({
      success: true,
      data: {
        debtCaseId,
        previousOwnerAgentId,
        currentOwnerAgentId,
        previousStatusId,
        currentStatusId,
      },
    });
  } catch (error) {
    console.error("assignDebtCase error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign debt case",
    });
  }
}

export async function changeDebtCaseStatus(req: Request, res: Response) {
  const debtCaseId = asInt(req.params.id);
  if (!debtCaseId) {
    return res.status(400).json({ success: false, message: "Invalid debt case id" });
  }

  try {
    const toStatusId = asInt(req.body?.toStatusId);
    const triggeredByAgentId = asInt(req.body?.triggeredByAgentId);
    const reason = req.body?.reason;
    const resolutionType = req.body?.resolutionType;

    if (!toStatusId || !triggeredByAgentId) {
      return res.status(400).json({
        success: false,
        message: "toStatusId and triggeredByAgentId are required",
      });
    }

    const currentRows = await soapSelect<{ CurrentStatusID?: string | number }>(`
      SELECT TOP 1 CurrentStatusID
      FROM ${TABLES.cases}
      WHERE DebtCaseID = ${debtCaseId};
    `);

    if (!currentRows.length) {
      return res.status(404).json({ success: false, message: "Debt case not found" });
    }

    const fromStatusId = asInt(currentRows[0]?.CurrentStatusID);
    const updates: string[] = [
      `CurrentStatusID = ${toStatusId}`,
      `StatusStartedAt = SYSUTCDATETIME()`,
      `UpdatedAt = SYSUTCDATETIME()`,
    ];

    if (resolutionType !== undefined) {
      updates.push(`ResolutionType = ${toSqlNVarChar(resolutionType)}`);
      updates.push(`ResolutionChosenAt = SYSUTCDATETIME()`);
      updates.push(`ResolutionChosenByAgentID = ${triggeredByAgentId}`);
    }

    const updateSql = `
      UPDATE ${TABLES.cases}
      SET ${updates.join(", ")}
      WHERE DebtCaseID = ${debtCaseId};
    `;

    const { rowsAffected } = await soapWrite(updateSql);
    if (rowsAffected !== null && rowsAffected <= 0) {
      return res.status(404).json({ success: false, message: "Debt case not found" });
    }

    const eventSql = `
      INSERT INTO ${TABLES.events}
      (
        DebtCaseID,
        EventTypeID,
        TriggeredByAgentID,
        FromStatusID,
        ToStatusID,
        Title,
        EventText,
        Reason,
        ResolutionType,
        CreatedAt
      )
      VALUES
      (
        ${debtCaseId},
        ${EVENT_TYPE.STATUS_CHANGE},
        ${triggeredByAgentId},
        ${toSqlInt(fromStatusId)},
        ${toStatusId},
        N'Status changed',
        N'Workflow status updated.',
        ${toSqlNVarChar(reason)},
        ${toSqlNVarChar(resolutionType)},
        SYSUTCDATETIME()
      );
    `;

    

    await soapWrite(eventSql);

    return res.json({
      success: true,
      data: {
        debtCaseId,
        fromStatusId,
        toStatusId,
      },
    });
  } catch (error) {
    console.error("changeDebtCaseStatus error:", error);
    return res.status(500).json({ success: false, message: "Failed to change debt case status" });
  }

  
}

export async function listDebtCasesForAgent(req: Request, res: Response) {
  const agentId = asInt(req.params.id ?? req.params.agentId);
  if (!agentId) {
    return res.status(400).json({
      success: false,
      message: "Invalid agent id",
    });
  }

  try {
    const top = asInt(req.query.top);
    const includePaid = String(req.query.includePaid ?? "false").toLowerCase() === "true";
    const onlyFresh = String(req.query.onlyFresh ?? "false").toLowerCase() === "true";
    const onlyReminders =
      String(req.query.onlyReminders ?? "false").toLowerCase() === "true";
    const onlyEscalated =
      String(req.query.onlyEscalated ?? "false").toLowerCase() === "true";

    const filters: string[] = [`c.CurrentOwnerAgentID = ${agentId}`];

    if (!includePaid) {
      filters.push(`ISNULL(c.PaymentReceived, 0) = 0`);
    }

    if (onlyFresh) {
      filters.push(
        `DATEDIFF(DAY, ISNULL(c.DebtorQualifiedDate, c.CreatedAt), GETDATE()) <= 7`,
      );
    }

    if (onlyReminders) {
      filters.push(`
        (
          s.StatusName IN (N'REMINDER_7D', N'REMINDER_14D', N'FINAL_DEMAND')
          OR c.Reminder7DueAt IS NOT NULL
          OR c.Reminder14DueAt IS NOT NULL
        )
      `);
    }

    if (onlyEscalated) {
      filters.push(`
        (
          ISNULL(c.EscalatedToSuperior, 0) = 1
          OR s.StatusName IN (N'ITC', N'LEGAL', N'ESCALATION_MANAGER')
        )
      `);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const topClause = top ? `TOP ${top}` : "";

    const sql = `
      SELECT ${topClause}
        c.DebtCaseID,
        c.AccountNo,
        c.ComplexID,
        c.ComplexName,
        c.DebtorName,
        c.ContactPhone,
        c.ContactEmail,
        c.ProteaAmount,
        c.LandlordAmount,
        c.TotalOutstanding,
        c.TerminationDate,
        c.DebtorQualifiedDate,
        c.CurrentStatusID,
        s.StatusName AS CurrentStatusName,
        c.StatusStartedAt,
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
        c.CreatedAt,
        c.UpdatedAt,
        DATEDIFF(DAY, c.TerminationDate, GETDATE()) AS DaysSinceTermination
      FROM ${TABLES.cases} c
      LEFT JOIN ${TABLES.statuses} s ON s.StatusID = c.CurrentStatusID
      LEFT JOIN ${TABLES.agents} a ON a.ID = c.CurrentOwnerAgentID
      ${whereClause}
      ORDER BY
        ISNULL(c.DebtorQualifiedDate, c.CreatedAt) DESC,
        c.DebtCaseID DESC;
    `;

    const rows = await soapSelect(sql);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("listDebtCasesForAgent error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load debt cases for agent",
    });
  }
}