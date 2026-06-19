import { Express, Request, Response } from "express";
import { getDebtRecords, assignDebtRecord } from "../controllers/debt-manager/debt.controller";
import {
  awardDebtCaseAgentProgress,
  getDebtCaseAgentProfile,
  listDebtCaseAgents,
  updateDebtCaseAgentProfile,
} from "../controllers/debt-manager/debt-case-agent.controller";
import { listDebtCaseStatuses } from "../controllers/debt-manager/debt-case-status.controller";
import {
  assignDebtCase,
  changeDebtCaseStatus,
  createDebtCase,
  getDebtCaseById,
  listDebtCases ,
  listDebtCasesForAgent,
  updateDebtCase,
} from "../controllers/debt-manager/debt-case.controller";
import {
  createDebtCaseCommunicationEvent,
  createDebtCaseEvent,
  createDebtCaseReminderEvent,
  listDebtCaseEvents,
} from "../controllers/debt-manager/debt-case-event.controller";

import { sendManualEmail } from "../controllers/debt-manager/debt-case-email.controller";
import { ManagerSettingsController } from "../controllers/debt-manager/manager-settings.controller";
import { StatsController } from "../controllers/debt-manager/stats.controller";
import { TransactionsController } from "server/controllers/debt-manager/transactions.controller";
import { WhatsAppController } from "server/controllers/debt-manager/whatsapp.controller";
import { ObjectivesController } from "server/controllers/debt-manager/objectives.controller";

export function registerDebtRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response) => boolean
) {
  const base = "/api/debt-manager";

  const withAdmin =
    (handler: (req: Request, res: Response) => Promise<any> | any) =>
    (req: Request, res: Response) => {
      if (!requireAdmin(req, res)) return;
      return handler(req, res);
    };

  // ── Debt Manager API Routes ─────────────────────────────

  // existing record route
  app.get(`${base}/records`, withAdmin(getDebtRecords));

  // assign legacy debt record to an agent
  app.post(`${base}/records/:id/assign`, withAdmin(assignDebtRecord));
  app.get("/api/debt-manager/agents/:id/cases", listDebtCasesForAgent);

  // lookups
  app.get(`${base}/statuses`, withAdmin(listDebtCaseStatuses));
  app.get(`${base}/agents`, withAdmin(listDebtCaseAgents));
  app.get(`${base}/agents/:id`, withAdmin(getDebtCaseAgentProfile));
  app.patch(`${base}/agents/:id/profile`, withAdmin(updateDebtCaseAgentProfile));
  app.post(`${base}/agents/:id/progress`, withAdmin(awardDebtCaseAgentProgress));

  // cases
  app.get(`${base}/cases`, withAdmin(listDebtCases));
  app.get(`${base}/cases/:id`, withAdmin(getDebtCaseById));
  app.post(`${base}/cases`, withAdmin(createDebtCase));
  app.patch(`${base}/cases/:id`, withAdmin(updateDebtCase));
  app.post(`${base}/cases/:id/assign`, withAdmin(assignDebtCase));
  app.post(`${base}/cases/:id/status`, withAdmin(changeDebtCaseStatus));

  app.get("/api/debt-manager/cases/:id/events", listDebtCaseEvents);
app.post("/api/debt-manager/cases/:id/events", createDebtCaseEvent);
app.post("/api/debt-manager/cases/:id/events/communication", createDebtCaseCommunicationEvent);
app.post("/api/debt-manager/cases/:id/events/reminder", createDebtCaseReminderEvent);

  // events
  app.get(`${base}/cases/:id/events`, withAdmin(listDebtCaseEvents));
  app.post(`${base}/cases/:id/events`, withAdmin(createDebtCaseEvent));
  app.post(
    `${base}/cases/:id/events/communication`,
    withAdmin(createDebtCaseCommunicationEvent)
  );
  app.post(
    `${base}/cases/:id/events/reminder`,
    withAdmin(createDebtCaseReminderEvent)
  );

  //Send emails with the service
  app.post("/api/email/send", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  sendManualEmail(req, res);
});

  // ── Manager settings and import ──────────────────────────
  // Retrieve manager settings
  app.get(
    `${base}/manager-settings`,
    withAdmin(ManagerSettingsController.getSettings),
  );
  // Update manager settings
  app.put(
    `${base}/manager-settings`,
    withAdmin(ManagerSettingsController.updateSettings),
  );
  // Trigger the daily import
  app.post(
    `${base}/manager-settings/import`,
    withAdmin(ManagerSettingsController.runImport),
  );

  // ── Statistics ────────────────────────────────────────────
  // Summary statistics for reports
  app.get(
    `${base}/stats`,
    withAdmin(StatsController.getSummary),
  );
  // Agent stats: xp, level & coins
  app.get(
    `${base}/agent-stats/:id?`,
    withAdmin(StatsController.getAgentStats),
  );

  //Transaction Data
  app.get(
  "/api/debt-manager/transactions",
  TransactionsController.getSummary,
);

app.get(
  "/api/debt-manager/transactions/case/:id",
  TransactionsController.getCaseTransactions,
);

// Whatsapp endpoints
app.post("/api/whatsapp/send", WhatsAppController.sendTemplate);
app.get("/api/whatsapp/messages", WhatsAppController.getMessages);
app.get("/api/whatsapp/health", WhatsAppController.getHealth);

//Objective Routes
app.get("/api/debt-manager/objectives/:agentId", ObjectivesController.getAgentObjectives);
app.post("/api/debt-manager/objectives/:agentId/refresh", ObjectivesController.refreshAgentObjectives);

}