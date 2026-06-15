export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  maxEmailsPerMinute: number;
  maxEmailsPerHour: number;
  isConfigured: boolean;
}

const port = Number(process.env.EMAIL_PORT ?? 587);

export const emailConfig: EmailConfig = {
  host: process.env.EMAIL_HOST ?? "",
  port,
  secure:
    String(process.env.EMAIL_SECURE ?? "").toLowerCase() === "true" || port === 465,
  user: process.env.EMAIL_USER ?? "",
  password: process.env.EMAIL_PASSWORD ?? "",
  from: process.env.EMAIL_FROM ?? "",
  maxEmailsPerMinute: Number(process.env.EMAIL_MAX_PER_MINUTE ?? 10),
  maxEmailsPerHour: Number(process.env.EMAIL_MAX_PER_HOUR ?? 100),
  isConfigured: Boolean(
    process.env.EMAIL_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD &&
      process.env.EMAIL_FROM,
  ),
};

export default emailConfig;