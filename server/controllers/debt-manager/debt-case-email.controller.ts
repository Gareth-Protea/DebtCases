import { Request, Response } from "express";
import { sendEmail, type EmailAttachment } from "../../services/emailService";
import emailRateLimiter from "../../utils/emailRateLimiter.js";

type RequestUser = {
  id?: string | number;
  email?: string;
  fullName?: string;
  name?: string;
  username?: string;
  userName?: string;
};

type AttachmentInput = {
  filename?: string;
  content?: string;
  contentType?: string;
};

function getActor(req: Request): string {
  const user = (req as Request & { user?: RequestUser }).user;

  return (
    String(user?.id ?? "") ||
    user?.email ||
    user?.fullName ||
    user?.name ||
    user?.username ||
    user?.userName ||
    req.ip ||
    "SYSTEM"
  );
}

function parseAttachments(raw: unknown): EmailAttachment[] {
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

export async function sendManualEmail(req: Request, res: Response) {
  try {
    const { to, subject, text, html } = req.body as {
      to?: string | string[];
      subject?: string;
      text?: string;
      html?: string;
    };

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        message: "Missing 'to' or 'subject'",
      });
    }

    const identifier = getActor(req);
    const limitCheck = emailRateLimiter.checkLimit(identifier);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: limitCheck.reason,
      });
    }

    const fixedAttachments = parseAttachments((req.body as { attachments?: unknown }).attachments);

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      attachments: fixedAttachments,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    emailRateLimiter.recordAttempt(identifier);

    return res.json({
      success: true,
      messageId: result.messageId,
      devMode: result.devMode ?? false,
    });
  } catch (err: any) {
    console.error("❌ sendManualEmail failed:", err);
    return res.status(500).json({
      success: false,
      message: "Email failed",
      error: err?.message || "Unknown error",
    });
  }
}

export default {
  sendManualEmail,
};