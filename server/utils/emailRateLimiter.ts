import { emailConfig } from "../config/emailConfig.js";

/**
 * Simple in-memory rate limiter for email sending
 * Prevents abuse and accidental mass email sending
 */
class EmailRateLimiter {
  private attempts: Map<string, number[]>;
  private hourlyAttempts: Map<string, number[]>;

  constructor() {
    this.attempts = new Map();
    this.hourlyAttempts = new Map();
  }

  /**
   * Check if sending is allowed based on rate limits
   * @param identifier User identifier (userId, email, IP, etc.)
   */
  checkLimit(identifier: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    let minuteAttempts = this.attempts.get(identifier) ?? [];
    let hourAttempts = this.hourlyAttempts.get(identifier) ?? [];

    minuteAttempts = minuteAttempts.filter((time) => time > oneMinuteAgo);
    hourAttempts = hourAttempts.filter((time) => time > oneHourAgo);

    if (minuteAttempts.length >= emailConfig.maxEmailsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: Maximum ${emailConfig.maxEmailsPerMinute} emails per minute`,
      };
    }

    if (hourAttempts.length >= emailConfig.maxEmailsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: Maximum ${emailConfig.maxEmailsPerHour} emails per hour`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record an email attempt
   */
  recordAttempt(identifier: string): void {
    const now = Date.now();

    const minuteAttempts = this.attempts.get(identifier) ?? [];
    minuteAttempts.push(now);
    this.attempts.set(identifier, minuteAttempts);

    const hourAttempts = this.hourlyAttempts.get(identifier) ?? [];
    hourAttempts.push(now);
    this.hourlyAttempts.set(identifier, hourAttempts);
  }

  /**
   * Clean up old attempts
   */
  cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [identifier, attempts] of this.attempts.entries()) {
      const filtered = attempts.filter((time) => time > now - 60 * 1000);
      if (filtered.length === 0) {
        this.attempts.delete(identifier);
      } else {
        this.attempts.set(identifier, filtered);
      }
    }

    for (const [identifier, attempts] of this.hourlyAttempts.entries()) {
      const filtered = attempts.filter((time) => time > oneHourAgo);
      if (filtered.length === 0) {
        this.hourlyAttempts.delete(identifier);
      } else {
        this.hourlyAttempts.set(identifier, filtered);
      }
    }
  }
}

const emailRateLimiter = new EmailRateLimiter();

// Clean up every 5 minutes
setInterval(() => {
  emailRateLimiter.cleanup();
}, 5 * 60 * 1000);

export default emailRateLimiter;