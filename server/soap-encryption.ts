import crypto from "crypto";

/**
 * SOAP Encryption Configuration
 * Sensitive values are loaded from environment variables — never hardcoded.
 * Uses getters so env vars are read lazily (after dotenv has loaded).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const SOAP_CONFIG = {
  get baseUrl()        { return process.env.SOAP_BASE_URL   ?? "https://www.oami.co.za/SSQQLLWS/SSQQLLWS_Enc.asmx"; },
  get adminUser()      { return process.env.SOAP_ADMIN_USER ?? "administrator"; },
  get adminPassword()  { return requireEnv("SOAP_ADMIN_PASSWORD"); },
  get secondPassword() { return requireEnv("SOAP_SECOND_PASSWORD"); },
  get encryptionKey1() { return requireEnv("SOAP_ENCRYPTION_KEY1"); },
  get encryptionKey2() { return requireEnv("SOAP_ENCRYPTION_KEY2"); },
  get salt()           { return process.env.SOAP_SALT       ?? "FixedSalt816"; },
  iterations: 1000,
  keyLength:  32,
};

/**
 * SOAP Encryption Utility
 * Handles PBKDF2 + AES-256-CBC encryption for SOAP requests
 */
export class SOAPEncryption {
  /**
   * Derive encryption key using PBKDF2
   */
  private static deriveKey(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      SOAP_CONFIG.iterations,
      SOAP_CONFIG.keyLength,
      "sha1"
    );
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  static encrypt(plainText: string, encryptionKey: string): string {
    const key = this.deriveKey(encryptionKey, SOAP_CONFIG.salt);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plainText, "utf8", "base64");
    encrypted += cipher.final("base64");
    
    // Combine IV + ciphertext and encode as base64
    const combined = Buffer.concat([iv, Buffer.from(encrypted, "base64")]);
    return combined.toString("base64");
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  static decrypt(encryptedText: string, encryptionKey: string): string {
    const key = this.deriveKey(encryptionKey, SOAP_CONFIG.salt);
    const combined = Buffer.from(encryptedText, "base64");
    
    const iv = combined.subarray(0, 16);
    const ciphertext = combined.subarray(16);
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  }

  /**
   * Create encrypted payload for SOAP request
   * Format: EncPwd1|EncSql|EncPwd2
   */
  static createPayload(sqlQuery: string): string {
    const encPwd1 = this.encrypt(SOAP_CONFIG.adminPassword, SOAP_CONFIG.encryptionKey1);
    const encSql = this.encrypt(sqlQuery, SOAP_CONFIG.encryptionKey1);
    const encPwd2 = this.encrypt(SOAP_CONFIG.secondPassword, SOAP_CONFIG.encryptionKey2);
    
    return `${encPwd1}|${encSql}|${encPwd2}`;
  }

  /**
   * Validate SQL query for dangerous operations
   */
  static validateSQL(sql: string): { valid: boolean; error?: string } {
    const dangerousKeywords = [
      "DROP", "CREATE", "DELETE", "UPDATE", "INSERT",
      "ALTER", "TRUNCATE", "EXEC", "EXECUTE", "SP_"
    ];
    
    const upperSQL = sql.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      // Use word-boundary regex so column names like 'createdAt' aren't flagged
      const pattern = new RegExp(`\\b${keyword}\\b`);
      if (pattern.test(upperSQL)) {
        return {
          valid: false,
          error: `Invalid SQL: ${keyword} operations are not allowed`
        };
      }
    }
    
    return { valid: true };
  }
}
