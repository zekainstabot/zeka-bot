const { getPool } = require("../database/pool");
const rewardRepository = require("../repositories/reward.repository");
const creditRepository = require("../repositories/credit.repository");

function generateRewardId() {
  return `rwd_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`
    .slice(0, 32);
}

async function grantRewardInTransaction({
  userId,
  rewardType,
  sourceType,
  sourceId,
  creditAmount = 0,
  xpAmount = 0,
  proDays = 0,
  metadata = {},
  client,
}) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!rewardType) {
    throw new Error(
      "Reward type is required"
    );
  }

  if (!client) {
    throw new Error(
      "Database client is required"
    );
  }

  const credit =
    Number(creditAmount);

  const xp =
    Number(xpAmount);

  const pro =
    Number(proDays);

  if (
    !Number.isFinite(credit) ||
    credit < 0
  ) {
    throw new Error(
      "Invalid reward credit amount"
    );
  }

  if (
    !Number.isInteger(xp) ||
    xp < 0
  ) {
    throw new Error(
      "Invalid reward XP amount"
    );
  }

  if (
    !Number.isInteger(pro) ||
    pro < 0
  ) {
    throw new Error(
      "Invalid reward Pro days"
    );
  }

  if (
    credit === 0 &&
    xp === 0 &&
    pro === 0
  ) {
    return {
      granted: false,
      reward: null,
      creditAmount: 0,
      xpAmount: 0,
      proDays: 0,
    };
  }

  if (
    sourceType &&
    sourceId
  ) {
    const existing =
      await rewardRepository.findBySource(
        {
          userId,
          sourceType,
          sourceId,
          rewardType,
        },
        client
      );

    if (existing) {
      return {
        granted: false,
        duplicate: true,
        reward: existing,
        creditAmount:
          Number(
            existing.credit_amount || 0
          ),
        xpAmount:
          Number(
            existing.xp_amount || 0
          ),
        proDays:
          Number(
            existing.pro_days || 0
          ),
      };
    }
  }

  const reward =
    await rewardRepository.create(
      {
        userId,
        rewardId:
          generateRewardId(),
        rewardType,
        sourceType,
        sourceId,
        creditAmount: credit,
        xpAmount: xp,
        proDays: pro,
        status: "GRANTED",
        metadata,
      },
      client
    );

  if (!reward) {
    if (
      sourceType &&
      sourceId
    ) {
      const existing =
        await rewardRepository.findBySource(
          {
            userId,
            sourceType,
            sourceId,
            rewardType,
          },
          client
        );

      if (existing) {
        return {
          granted: false,
          duplicate: true,
          reward: existing,
          creditAmount:
            Number(
              existing.credit_amount ||
                0
            ),
          xpAmount:
            Number(
              existing.xp_amount ||
                0
            ),
          proDays:
            Number(
              existing.pro_days ||
                0
            ),
        };
      }
    }

    throw new Error(
      "Failed to create reward"
    );
  }

  let grantedCredit = null;
  let grantedXp = 0;
  let grantedProDays = 0;

  if (credit > 0) {
    grantedCredit =
      await creditRepository.create(
        {
          userId,
          creditType: "REWARD",
          amount: credit,
          remainingAmount: credit,
          source: "OTHER",
          expiresAt: null,
        },
        client
      );

    await creditRepository.createLedgerEntry(
      {
        userId,
        creditAccountId:
          grantedCredit.id,
        entryType: "GRANT",
        amount: credit,
        balanceBefore: 0,
        balanceAfter: credit,
        referenceType: "REWARD",
        referenceId: reward.id,
        description:
          "Credit reward granted",
      },
      client
    );
  }

  if (xp > 0) {
    const userResult =
      await client.query(
        `
          SELECT id, xp, level
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId]
      );

    const user =
      userResult.rows[0];

    if (!user) {
      throw new Error(
        `User not found: ${userId}`
      );
    }

    const balanceBefore =
      Number(user.xp || 0);

    const balanceAfter =
      balanceBefore + xp;

    const levelResult =
      await client.query(
        `
          SELECT level_number
          FROM levels
          WHERE required_xp <= $1
            AND status = 'ACTIVE'
          ORDER BY required_xp DESC,
                   level_number DESC
          LIMIT 1
        `,
        [balanceAfter]
      );

    const newLevel =
      levelResult.rows[0]
        ?.level_number ??
      Number(user.level || 0);

    await client.query(
      `
        UPDATE users
        SET xp = $2,
            level = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        userId,
        balanceAfter,
        newLevel,
      ]
    );

    await client.query(
      `
        INSERT INTO xp_transactions (
          user_id,
          amount,
          source_type,
          source_id,
          balance_before,
          balance_after,
          description,
          metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::JSONB
        )
      `,
      [
        userId,
        xp,
        "REWARD",
        reward.id,
        balanceBefore,
        balanceAfter,
        "XP reward granted",
        JSON.stringify(
          metadata || {}
        ),
      ]
    );

    grantedXp = xp;
  }

  if (pro > 0) {
    const userResult =
      await client.query(
        `
          SELECT id, is_pro, pro_expires_at
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId]
      );

    const user =
      userResult.rows[0];

    if (!user) {
      throw new Error(
        `User not found: ${userId}`
      );
    }

    const now =
      new Date();

    const currentExpiry =
      user.pro_expires_at &&
      new Date(
        user.pro_expires_at
      ) > now
        ? new Date(
            user.pro_expires_at
          )
        : now;

    const newExpiry =
      new Date(
        currentExpiry
      );

    newExpiry.setUTCDate(
      newExpiry.getUTCDate() +
        pro
    );

    await client.query(
      `
        UPDATE users
        SET is_pro = TRUE,
            pro_expires_at = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        userId,
        newExpiry,
      ]
    );

    grantedProDays = pro;
  }

  return {
    granted: true,
    duplicate: false,
    reward,
    creditAmount: credit,
    xpAmount: grantedXp,
    proDays:
      grantedProDays,
  };
}

async function grantReward({
  userId,
  rewardType,
  sourceType,
  sourceId,
  creditAmount = 0,
  xpAmount = 0,
  proDays = 0,
  metadata = {},
}) {
  const pool =
    getPool();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const result =
      await grantRewardInTransaction(
        {
          userId,
          rewardType,
          sourceType,
          sourceId,
          creditAmount,
          xpAmount,
          proDays,
          metadata,
          client,
        }
      );

    await client.query(
      "COMMIT"
    );

    return result;
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  grantReward,
  grantRewardInTransaction,
};
