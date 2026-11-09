"use strict";

const { getPool } = require("../database/pool");
const { grantRewardInTransaction } = require("./reward.service");

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function redeemGiftCode({ userId, code }) {
  if (!userId) throw new Error("USER_NOT_FOUND");
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 100) {
    throw new Error("INVALID_CODE");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const codeResult = await client.query(
      "SELECT * FROM gift_codes WHERE code = $1 FOR UPDATE",
      [normalizedCode]
    );
    const gift = codeResult.rows[0];

    if (!gift) throw new Error("GIFT_NOT_FOUND");
    if (gift.status !== "ACTIVE") throw new Error("GIFT_INACTIVE");
    if (gift.starts_at && new Date(gift.starts_at) > new Date()) {
      throw new Error("GIFT_NOT_STARTED");
    }
    if (gift.expires_at && new Date(gift.expires_at) <= new Date()) {
      throw new Error("GIFT_EXPIRED");
    }
    if (gift.max_uses !== null && Number(gift.used_count) >= Number(gift.max_uses)) {
      throw new Error("GIFT_EXHAUSTED");
    }

    const usedResult = await client.query(
      "SELECT id FROM gift_code_usages WHERE gift_code_id = $1 AND user_id = $2 LIMIT 1",
      [gift.id, userId]
    );
    if (usedResult.rows.length) throw new Error("GIFT_ALREADY_USED");

    const creditAmount = Number(gift.credit_amount || 0);
    const xpAmount = Number(gift.xp_amount || 0);
    const proDays = Number(gift.pro_days || 0);
    if (creditAmount <= 0 && xpAmount <= 0 && proDays <= 0) {
      throw new Error("GIFT_EMPTY");
    }

    const granted = await grantRewardInTransaction({
      userId,
      rewardType: "GIFT_CODE",
      sourceType: "GIFT_CODE",
      sourceId: gift.id,
      creditAmount,
      xpAmount,
      proDays,
      metadata: {
        giftCodeId: gift.id,
        code: normalizedCode,
        description: gift.description || null
      },
      client
    });

    if (!granted.granted && !granted.duplicate) {
      throw new Error("GIFT_GRANT_FAILED");
    }
    if (granted.duplicate) throw new Error("GIFT_ALREADY_USED");

    await client.query(
      `INSERT INTO gift_code_usages (gift_code_id, user_id, reward_id, metadata)
       VALUES ($1, $2, $3, $4::JSONB)`,
      [gift.id, userId, granted.reward.id, JSON.stringify({ code: normalizedCode })]
    );

    await client.query(
      "UPDATE gift_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1",
      [gift.id]
    );

    await client.query("COMMIT");
    return {
      description: gift.description || null,
      creditAmount: granted.creditAmount,
      xpAmount: granted.xpAmount,
      proDays: granted.proDays
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getUserRewards(userId, limit = 10) {
  const db = getPool();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  const result = await db.query(
    `SELECT reward_type, credit_amount, xp_amount, pro_days, created_at, metadata
     FROM rewards
     WHERE user_id = $1 AND status = 'GRANTED'
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return result.rows;
}

module.exports = { normalizeCode, redeemGiftCode, getUserRewards };
