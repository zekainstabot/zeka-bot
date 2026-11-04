const { getClient } = require("../database/client");

async function recordAction({
    adminUserId,
    adminTelegramUserId,
    targetUserId,
    targetTelegramUserId,
    action,
    details = {},
}) {
    if (!action) {
        throw new Error("ACTION_REQUIRED");
    }

    const db = getClient();

    const result = await db.query(
        `
            INSERT INTO admin_action_logs (
                admin_user_id,
                admin_telegram_user_id,
                target_user_id,
                target_telegram_user_id,
                action,
                details
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING *
        `,
        [
            adminUserId || null,
            adminTelegramUserId
                ? String(adminTelegramUserId)
                : null,
            targetUserId || null,
            targetTelegramUserId
                ? String(targetTelegramUserId)
                : null,
            action,
            JSON.stringify(details),
        ]
    );

    return result.rows[0];
}

async function getHistory({
    targetUserId,
    adminUserId,
    action,
    limit = 10,
    offset = 0,
} = {}) {
    const db = getClient();

    const conditions = [];
    const values = [];

    if (targetUserId) {
        values.push(targetUserId);
        conditions.push(
            `target_user_id = $${values.length}`
        );
    }

    if (adminUserId) {
        values.push(adminUserId);
        conditions.push(
            `admin_user_id = $${values.length}`
        );
    }

    if (action) {
        values.push(action);
        conditions.push(
            `action = $${values.length}`
        );
    }

    values.push(
        Math.min(Math.max(Number(limit) || 10, 1), 100)
    );

    const limitIndex = values.length;

    values.push(Math.max(Number(offset) || 0, 0));

    const offsetIndex = values.length;

    const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await db.query(
        `
            SELECT *
            FROM admin_action_logs
            ${where}
            ORDER BY created_at DESC, id DESC
            LIMIT $${limitIndex}
            OFFSET $${offsetIndex}
        `,
        values
    );

    return result.rows;
}

async function getTotalCount({
    targetUserId,
    adminUserId,
    action,
} = {}) {
    const db = getClient();

    const conditions = [];
    const values = [];

    if (targetUserId) {
        values.push(targetUserId);
        conditions.push(
            `target_user_id = $${values.length}`
        );
    }

    if (adminUserId) {
        values.push(adminUserId);
        conditions.push(
            `admin_user_id = $${values.length}`
        );
    }

    if (action) {
        values.push(action);
        conditions.push(
            `action = $${values.length}`
        );
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await db.query(
        `
            SELECT COUNT(*)::int AS total
            FROM admin_action_logs
            ${where}
        `,
        values
    );

    return Number(result.rows[0]?.total || 0);
}

module.exports = {
    recordAction,
    getHistory,
    getTotalCount,
};
