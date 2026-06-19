import type { Request, Response } from "express";

const WA_BASE_URL = (
  process.env.WA_SERVICE_BASE_URL || "https://whatsapp-service-8wpz.onrender.com"
).replace(/\/$/, "");

const WA_USER = process.env.WA_SERVICE_USER;
const WA_PASS = process.env.WA_SERVICE_PASS;
const WA_API_KEY = process.env.WA_SERVICE_API_KEY;

type WhatsAppDocument = {
  filename?: string;
  /**
   * Public or signed URL to the document.
   * WhatsApp template document headers accept document.link, not base64 content.
   */
  url?: string;
  link?: string;
  /**
   * WhatsApp Cloud API media id, if the file was uploaded to WhatsApp first.
   */
  id?: string;
  mediaId?: string;
  /**
   * Kept only so old callers do not break TypeScript.
   * This controller intentionally does NOT forward base64 content to WhatsApp.
   */
  content?: string;
  contentType?: string;
};

type WhatsAppServiceError = Error & {
  status?: number;
  payload?: unknown;
};

const waAuth: { token: string | null; exp: number } = {
  token: null,
  exp: 0,
};

function decodeJwtExp(token: string) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    return Number(JSON.parse(json)?.exp || 0);
  } catch {
    return 0;
  }
}

function normalizeCell(cell: unknown) {
  const digits = String(cell || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) return `27${digits.slice(1)}`;

  return digits;
}

function safeVariables(values: unknown[]) {
  return values.map((value) =>
    value === null || value === undefined ? "" : String(value),
  );
}

function getRequester(req: Request, requestedBy?: unknown) {
  const user = (req as any).user ?? {};

  return (
    user.username ||
    user.name ||
    user.userName ||
    user.fullName ||
    (typeof requestedBy === "string" ? requestedBy : "") ||
    "SYSTEM"
  );
}

function getDocumentLink(document: WhatsAppDocument) {
  return (document.url || document.link || "").trim();
}

function getDocumentId(document: WhatsAppDocument) {
  return (document.id || document.mediaId || "").trim();
}

/**
 * WhatsApp template DOCUMENT headers can only receive:
 *
 * document: { link, filename }
 * or
 * document: { id, filename }
 *
 * They cannot receive:
 * document: { content: base64 }
 *
 * If the debtor page sends base64 content, that must first be stored somewhere
 * public/signed or uploaded to WhatsApp media before this controller can send
 * it as a document header.
 */
function buildDocumentComponents(documents: WhatsAppDocument[]) {
  const first = documents[0];
  if (!first) return undefined;

  const filename = first.filename || "document.pdf";
  const link = getDocumentLink(first);
  const id = getDocumentId(first);

  if (!link && !id) {
    throw new Error(
      "WhatsApp document templates require a public document URL/link or WhatsApp media ID. Base64 document.content cannot be sent directly to WhatsApp.",
    );
  }

  const documentPayload = id ? { id, filename } : { link, filename };

  return [
    {
      type: "header",
      parameters: [
        {
          type: "document",
          document: documentPayload,
        },
      ],
    },
  ];
}

function sanitizeDocumentsForLogging(documents: WhatsAppDocument[]) {
  return documents.map((document) => ({
    filename: document.filename || "document.pdf",
    url: document.url || document.link || undefined,
    id: document.id || document.mediaId || undefined,
    contentType: document.contentType || undefined,
    hasBase64Content: Boolean(document.content),
  }));
}

async function readResponse(response: globalThis.Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postJson<T = any>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const payload = await readResponse(response);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as any).message)
        : `WhatsApp service request failed: ${response.status}`;

    const error = new Error(message) as WhatsAppServiceError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function getJson<T = any>(
  url: string,
  headers: Record<string, string>,
) {
  const response = await fetch(url, { headers });
  const payload = await readResponse(response);

  if (!response.ok) {
    const error = new Error(
      `WhatsApp service request failed: ${response.status}`,
    ) as WhatsAppServiceError;

    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function loginToWhatsAppService() {
  if (!WA_USER || !WA_PASS) {
    throw new Error("Missing WA_SERVICE_USER or WA_SERVICE_PASS env vars");
  }

  if (!WA_API_KEY) {
    throw new Error("Missing WA_SERVICE_API_KEY env var");
  }

  const data = await postJson<{ token?: string }>(
    `${WA_BASE_URL}/whatsapp/auth/login`,
    {
      username: WA_USER,
      password: WA_PASS,
    },
    {
      "x-api-key": WA_API_KEY,
    },
  );

  const token = data?.token;

  if (!token) {
    throw new Error("WhatsApp service login did not return a token");
  }

  waAuth.token = token;
  waAuth.exp = decodeJwtExp(token);

  return token;
}

async function getWhatsAppServiceToken({
  force = false,
}: { force?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);

  if (force || !waAuth.token || !waAuth.exp || waAuth.exp - now < 60) {
    return loginToWhatsAppService();
  }

  return waAuth.token;
}

async function callWithAuth<T>(fn: (token: string) => Promise<T>) {
  const token = await getWhatsAppServiceToken();

  try {
    return await fn(token);
  } catch (error) {
    if ((error as WhatsAppServiceError)?.status === 401) {
      const freshToken = await getWhatsAppServiceToken({ force: true });
      return fn(freshToken);
    }

    throw error;
  }
}

export class WhatsAppController {
  /**
   * POST /api/whatsapp/send
   *
   * Body:
   * {
   *   to: "2782...",
   *   templateName: "debt_invoice_document",
   *   languageCode: "en",
   *   variables: ["Client", "Invoice 1", "Account", "100.00", "30 Jun 2026"],
   *   documents: [
   *     { filename: "invoice.pdf", url: "https://..." }
   *     // or { filename: "invoice.pdf", mediaId: "..." }
   *   ],
   *   components: optional advanced override,
   *   appName: "DebtManager",
   *   requestedBy: "Gareth"
   * }
   */
  static async sendTemplate(req: Request, res: Response) {
    try {
      const {
        to,
        templateName,
        languageCode = "en",
        variables = [],
        components,
        documents = [],
        appName,
        requestedBy,
      } = req.body || {};

      const cellNo = normalizeCell(to);

      if (!cellNo) {
        return res.status(400).json({
          success: false,
          message: "Missing/invalid 'to' cellphone number",
        });
      }

      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: "Missing 'templateName'",
        });
      }

      if (!Array.isArray(variables)) {
        return res.status(400).json({
          success: false,
          message: "'variables' must be an array",
        });
      }

      const safeDocs = Array.isArray(documents)
        ? (documents as WhatsAppDocument[])
        : [];

      const resolvedComponents =
        Array.isArray(components) && components.length
          ? components
          : buildDocumentComponents(safeDocs);

      const payload: Record<string, unknown> = {
        to: cellNo,
        templateName,
        languageCode,
        variables: safeVariables(variables),
        appName: appName || "DebtManager",
        requestedBy: getRequester(req, requestedBy),
      };

      if (resolvedComponents) {
        payload.components = resolvedComponents;
      }

      /*
       * Do not forward documents with base64 content to the WhatsApp service.
       *
       * The service ultimately sends Meta a template document header, and Meta
       * rejects document.content. Only document.link or document.id is valid.
       *
       * Keep a safe debug copy only if your service wants to log filenames/ids.
       */
      if (safeDocs.length) {
        payload.documentMeta = sanitizeDocumentsForLogging(safeDocs);
      }

      const response = await callWithAuth((token) =>
        postJson(`${WA_BASE_URL}/whatsapp/send`, payload, {
          Authorization: `Bearer ${token}`,
        }),
      );

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error(
        "sendWhatsAppTemplate error:",
        (error as WhatsAppServiceError)?.payload || (error as Error).message,
      );

      return res.status(500).json({
        success: false,
        message: "Failed to send WhatsApp template",
        error:
          (error as WhatsAppServiceError)?.payload ||
          (error as Error).message,
      });
    }
  }

  /**
   * GET /api/whatsapp/messages?limit=50&direction=out&cellNo=2782...
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const params = new URLSearchParams();

      if (req.query.limit) params.set("limit", String(req.query.limit));
      if (req.query.beforeId) params.set("beforeId", String(req.query.beforeId));
      if (req.query.direction) params.set("direction", String(req.query.direction));
      if (req.query.cellNo) params.set("cellNo", normalizeCell(req.query.cellNo));

      const qs = params.toString();

      const response = await callWithAuth((token) =>
        getJson(`${WA_BASE_URL}/whatsapp/messages${qs ? `?${qs}` : ""}`, {
          Authorization: `Bearer ${token}`,
        }),
      );

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error(
        "getWhatsAppMessages error:",
        (error as WhatsAppServiceError)?.payload || (error as Error).message,
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch WhatsApp logs",
        error:
          (error as WhatsAppServiceError)?.payload ||
          (error as Error).message,
      });
    }
  }

  /**
   * GET /api/whatsapp/health?deep=1
   */
  static async getHealth(req: Request, res: Response) {
    try {
      const response = await getJson(
        `${WA_BASE_URL}/whatsapp/health${req.query.deep ? "?deep=1" : ""}`,
        {},
      );

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error(
        "getWhatsAppHealth error:",
        (error as WhatsAppServiceError)?.payload || (error as Error).message,
      );

      return res.status(500).json({
        success: false,
        message: "WhatsApp service health check failed",
        error:
          (error as WhatsAppServiceError)?.payload ||
          (error as Error).message,
      });
    }
  }
}
