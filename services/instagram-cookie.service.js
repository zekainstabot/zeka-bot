
const crypto = require("crypto");
const { getClient } = require("../database/client");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const value = String(
    process.env.INSTAGRAM_COOKIE_ENCRYPTION_KEY || ""
  ).trim();

  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      "Instagram cookie encryption key is not configured correctly."
    );
  }

  return Buffer.from(value, "hex");
}

function encryptCookie(cookieText) {
  const key = getEncryptionKey();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(cookieText, "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedData: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptCookie(row) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(row.nonce, "base64")
  );

  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function saveInstagramCookie(cookieText, telegramUserId) {
  if (typeof cookieText !== "string" || !cookieText.trim()) {
    throw new Error("Cookie content is empty.");
  }

  const encrypted = encryptCookie(cookieText);
  const db = getClient();

  const userResult = await db.query(
    "SELECT id FROM users WHERE telegram_user_id = $1 LIMIT 1",
    [telegramUserId]
  );

  await db.query(
    `INSERT INTO instagram_cookie_store
       (id, encrypted_data, nonce, auth_tag, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       encrypted_data = EXCLUDED.encrypted_data,
       nonce = EXCLUDED.nonce,
       auth_tag = EXCLUDED.auth_tag,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      encrypted.encryptedData,
      encrypted.nonce,
      encrypted.authTag,
      userResult.rows[0]?.id || null,
    ]
  );
}

async function getInstagramCookie() {
  const result = await getClient().query(
    `SELECT encrypted_data, nonce, auth_tag
     FROM instagram_cookie_store WHERE id = 1 LIMIT 1`
  );

  return result.rows[0] ? decryptCookie(result.rows[0]) : null;
}

async function hasInstagramCookie() {
  const result = await getClient().query(
    "SELECT 1 FROM instagram_cookie_store WHERE id = 1 LIMIT 1"
  );

  return result.rowCount > 0;
}

async function deleteInstagramCookie() {
  await getClient().query(
    "DELETE FROM instagram_cookie_store WHERE id = 1"
  );
}

module.exports = {
  saveInstagramCookie,
  getInstagramCookie,
  hasInstagramCookie,
  deleteInstagramCookie,
};
