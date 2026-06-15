import crypto from "crypto";

const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH = 32;      // 256-bit AES key
const IV_LENGTH = 16;       // 128-bit AES block
const HMAC_KEY_LENGTH = 32; // 256-bit HMAC-SHA256

function deriveKeys(password: string, salt: Buffer): { encKey: Buffer; hmacKey: Buffer } {
  const derived = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH + HMAC_KEY_LENGTH,
    "sha256"
  );
  return {
    encKey: derived.subarray(0, KEY_LENGTH),
    hmacKey: derived.subarray(KEY_LENGTH),
  };
}

function verifyLegacyPBKDF2(password: string, salt: Buffer, storedHash: Buffer): boolean {
  try {
    const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
    return crypto.timingSafeEqual(derived, storedHash);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(
  password: string,
  salt: Buffer,
  storedHash: Buffer
): boolean {
  // 32-byte = legacy PBKDF2-only (no AES wrapper)
  if (storedHash.length === 32) {
    return verifyLegacyPBKDF2(password, salt, storedHash);
  }

  // Modern format: [IV(16)][AES-encrypted password][HMAC(32)]
  if (storedHash.length < 64) return false;

  try {
    const { encKey, hmacKey } = deriveKeys(password, salt);

    const tagLength = 32;
    const ciphertext = storedHash.subarray(0, storedHash.length - tagLength);
    const storedTag = storedHash.subarray(storedHash.length - tagLength);

    // Verify HMAC integrity first
    const hmac = crypto.createHmac("sha256", hmacKey);
    hmac.update(ciphertext);
    const computedTag = hmac.digest();

    if (!crypto.timingSafeEqual(storedTag, computedTag)) return false;

    // Decrypt and compare
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH);

    const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    return decrypted === password;
  } catch {
    return false;
  }
}

/**
 * Parse a VARBINARY value returned from SOAP/XML.
 * SQL Server DataSets encode binary as base64, but may also come as 0x-prefixed hex.
 */
export function parseDbBinary(val: unknown): Buffer | null {
  if (!val || typeof val !== "string" || val.trim() === "") return null;
  const s = val.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) {
    return Buffer.from(s.substring(2), "hex");
  }
  return Buffer.from(s, "base64");
}

/** The fixed organisational salt used for all MM_Logins / LLLogins passwords. */
export function getFixedSalt(): Buffer {
  return Buffer.from("FixedSalt816", "utf8");
}

/**
 * Hash a plaintext password using PBKDF2 + AES-256-CBC + HMAC-SHA256.
 * Returns { passwordHash, passwordSalt } ready to store in LLLogins.
 * passwordHash is a hex string (0x-prefixed) for use in SQL.
 * passwordSalt is a hex string (0x-prefixed) for use in SQL.
 */
export function hashLLPassword(password: string): { passwordHashHex: string; passwordSaltHex: string } {
  const salt = getFixedSalt();
  const { encKey, hmacKey } = deriveKeys(password, salt);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", encKey, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const ciphertext = Buffer.concat([iv, encrypted]);

  const hmac = crypto.createHmac("sha256", hmacKey);
  hmac.update(ciphertext);
  const tag = hmac.digest();

  const hashBuf = Buffer.concat([ciphertext, tag]);
  return {
    passwordHashHex: "0x" + hashBuf.toString("hex"),
    passwordSaltHex: "0x" + salt.toString("hex"),
  };
}
