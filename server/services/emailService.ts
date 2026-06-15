import nodemailer from "nodemailer";
import emailConfig from "../config/emailConfig";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  message?: string;
  messageId?: string;
  devMode?: boolean;
}

let transporter: nodemailer.Transporter | null = null;

// ================= INITIALIZE TRANSPORTER =================
export function initializeTransporter(): void {
  transporter = null;

  try {
    if (emailConfig.isConfigured) {
      transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      console.log("✅ Email transporter initialized with SMTP configuration");
    } else {
      console.warn("⚠️ Email environment variables not set. Running in dev mode.");
    }
  } catch (error) {
    console.error("❌ Error initializing email transporter:", error);
  }
}

// Initialize on module load
initializeTransporter();

// ================= VALIDATION =================
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) return false;
  if (
    email === "." ||
    email.includes("..") ||
    email.startsWith(".") ||
    email.endsWith(".")
  ) {
    return false;
  }

  return true;
}

// ================= SEND EMAIL =================
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, from, subject, text, html, attachments } = params;

  if (!to) {
    return {
      success: false,
      error: "Recipient email is required",
      message: "Please provide a recipient email address",
    };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const invalidEmails = recipients.filter((email) => !isValidEmail(email));

  if (invalidEmails.length > 0) {
    return {
      success: false,
      error: "Invalid email address",
      message: `Invalid email address(es): ${invalidEmails.join(", ")}`,
    };
  }

  if (!subject || subject.trim().length === 0) {
    return {
      success: false,
      error: "Subject is required",
      message: "Email subject cannot be empty",
    };
  }

  if ((!text || text.trim().length === 0) && (!html || html.trim().length === 0)) {
    return {
      success: false,
      error: "Content is required",
      message: "Email must have text or HTML content",
    };
  }

  if (!emailConfig.isConfigured) {
    console.warn("[EMAIL] Running in dev mode - email not actually sent");
    console.info(
      `[EMAIL] Would send to: ${Array.isArray(to) ? to.join(", ") : to}`,
    );
    console.info(`[EMAIL] Subject: ${subject}`);

    return {
      success: true,
      devMode: true,
      message: "Email not sent (dev mode)",
      messageId: `dev-${Date.now()}`,
    };
  }

  if (!transporter) {
    initializeTransporter();
    if (!transporter) {
      return {
        success: false,
        error: "Email service not initialized",
        message: "Email transporter could not be initialized",
      };
    }
  }

  try {
    const mailOptions = {
      from: from || emailConfig.from,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      text,
      html,
      attachments,
    };

    console.log(`[EMAIL] Sending email to: ${mailOptions.to}`);
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.messageId);

    return {
      success: true,
      devMode: false,
      message: "Email sent successfully",
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("❌ Failed to send email:", error);

    let userMessage = "Failed to send email";

    if (error?.code === "EAUTH") {
      userMessage = "Email authentication failed";
    } else if (error?.code === "ECONNECTION") {
      userMessage = "Could not connect to email server";
    } else if (error?.code === "ETIMEDOUT") {
      userMessage = "Email server connection timed out";
    } else if (error?.responseCode === 550) {
      userMessage = "Recipient rejected by server";
    } else if (error?.responseCode === 554) {
      userMessage = "Email rejected as spam";
    }

    return {
      success: false,
      error: error?.message || "Unknown error",
      message: userMessage,
    };
  }
}

// ================= VERIFY =================
export async function verifyConnection(): Promise<boolean> {
  if (!transporter) return false;

  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("❌ SMTP connection verification failed:", error);
    return false;
  }
}

export default {
  sendEmail,
  verifyConnection,
  initializeTransporter,
};