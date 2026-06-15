import axios from "axios";

const WA_BASE_URL =
  (process.env.WA_SERVICE_BASE_URL || "https://whatsapp-service-8wpz.onrender.com").replace(/\/$/, "");

const WA_USER = process.env.WA_SERVICE_USER;
const WA_PASS = process.env.WA_SERVICE_PASS;
const WA_API_KEY = process.env.WA_SERVICE_API_KEY;

const waAuth = {
  token: null as string | null,
  exp: 0,
};

function decodeJwtExp(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj?.exp || 0;
  } catch {
    return 0;
  }
}

function normalizeCell(cell: string): string {
  return String(cell || "").replace(/\D/g, "");
}

async function loginToWhatsAppService(): Promise<string> {
  if (!WA_USER || !WA_PASS) {
    throw new Error("Missing WA_SERVICE_USER or WA_SERVICE_PASS env vars");
  }
  if (!WA_API_KEY) {
    throw new Error("Missing WA_SERVICE_API_KEY env var");
  }

  const res = await axios.post(
    `${WA_BASE_URL}/whatsapp/auth/login`,
    {
      username: WA_USER,
      password: WA_PASS,
    },
    {
      headers: { "x-api-key": WA_API_KEY },
    },
  );

  const token = res.data?.token;
  if (!token) {
    throw new Error("WhatsApp service login did not return a token");
  }

  waAuth.token = token;
  waAuth.exp = decodeJwtExp(token);

  return token;
}

async function getWhatsAppServiceToken(force = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (
    force ||
    !waAuth.token ||
    !waAuth.exp ||
    waAuth.exp - now < 60
  ) {
    return loginToWhatsAppService();
  }

  return waAuth.token;
}

async function callWithAuth<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getWhatsAppServiceToken();

  try {
    return await fn(token);
  } catch (err: any) {
    if (err?.response?.status === 401) {
      const newToken = await getWhatsAppServiceToken(true);
      return fn(newToken);
    }
    throw err;
  }
}

export interface DebtWhatsAppTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  variables?: string[];
  appName?: string;
  requestedBy?: string;
}

export async function sendDebtWhatsAppTemplate(
  params: DebtWhatsAppTemplateParams,
) {
  const cellNo = normalizeCell(params.to);

  if (!cellNo) {
    throw new Error("Missing/invalid WhatsApp cellphone number");
  }

  if (!params.templateName) {
    throw new Error("templateName is required for WhatsApp sending");
  }

  const safeVars = (params.variables ?? []).map((v) =>
    v == null ? "" : String(v),
  );

  const response = await callWithAuth((token) =>
    axios.post(
      `${WA_BASE_URL}/whatsapp/send`,
      {
        to: cellNo,
        templateName: params.templateName,
        languageCode: params.languageCode ?? "en",
        variables: safeVars,
        appName: params.appName ?? "DebtCollection",
        requestedBy: params.requestedBy ?? "SYSTEM",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    ),
  );

  return response.data;
}