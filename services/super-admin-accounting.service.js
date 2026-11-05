const { getClient } = require("../database/client");

const VALID_PERIODS = ["today", "month", "all"];

function normalizePeriod(period) {
  if (!VALID_PERIODS.includes(period)) {
    throw new Error("INVALID_FINANCE_PERIOD");
  }

  return period;
}

function normalizeLimit(limit) {
  const parsed = Number(limit);

  if (!Number.isSafeInteger(parsed)) {
    return 10;
  }

  return Math.max(1, Math.min(parsed, 50));
}

// --------------------------------------------------
// Add expense
// --------------------------------------------------

async function createExpense({
  category,
  description,
  amount,
  createdByTelegramId,
}) {
  const normalizedCategory = String(
    category || ""
  ).trim();

  const normalizedDescription = String(
    description || ""
  ).trim();

  const normalizedAmount = Number(amount);

  const normalizedCreator = String(
    createdByTelegramId || ""
  ).trim();

  if (
    !normalizedCategory ||
    normalizedCategory.length > 50
  ) {
    throw new Error("INVALID_EXPENSE_CATEGORY");
  }

  if (
    !normalizedDescription ||
    normalizedDescription.length > 500
  ) {
    throw new Error("INVALID_EXPENSE_DESCRIPTION");
  }

  if (
    !Number.isSafeInteger(normalizedAmount) ||
    normalizedAmount <= 0
  ) {
    throw new Error("INVALID_EXPENSE_AMOUNT");
  }

  if (!/^\d+$/.test(normalizedCreator)) {
    throw new Error("INVALID_EXPENSE_CREATOR");
  }

  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO finance_expenses (
        category,
        description,
        amount,
        currency,
        created_by_telegram_id
      )
      VALUES ($1, $2, $3, 'IRT', $4)
      RETURNING *
    `,
    [
      normalizedCategory,
      normalizedDescription,
      normalizedAmount,
      normalizedCreator,
    ]
  );

  return result.rows[0];
}

// --------------------------------------------------
// Finance report
// --------------------------------------------------

async function getFinanceReport(period = "all") {
  const safePeriod = normalizePeriod(period);

  const db = getClient();

  const result = await db.query(
    `
      WITH time_boundaries AS (
        SELECT
          (
            date_trunc(
              'day',
              NOW() AT TIME ZONE 'Asia/Tehran'
            ) AT TIME ZONE 'Asia/Tehran'
          ) AS today_start,

          (
            date_trunc(
              'month',
              NOW() AT TIME ZONE 'Asia/Tehran'
            ) AT TIME ZONE 'Asia/Tehran'
          ) AS month_start
      ),

      income_events AS (
        /*
         * درآمد Pro
         *
         * اشتراک فقط زمانی در این جدول ثبت می‌شود
         * که مدیر رسید خرید را تأیید کرده باشد.
         *
         * خریدهای Pro از payments خوانده نمی‌شوند
         * تا درآمد دوبار محاسبه نشود.
         */

        SELECT
          subscription.price AS amount,

          COALESCE(
            NULLIF(subscription.currency, ''),
            'IRT'
          ) AS currency,

          subscription.created_at AS event_at

        FROM pro_subscriptions subscription

        WHERE subscription.source_type = 'PURCHASE'
          AND subscription.price > 0
      ),

      filtered_income AS (
        SELECT *
        FROM income_events

        CROSS JOIN time_boundaries boundaries

        WHERE
          $1 = 'all'

          OR (
            $1 = 'today'
            AND event_at >= boundaries.today_start
          )

          OR (
            $1 = 'month'
            AND event_at >= boundaries.month_start
          )
      ),

      filtered_expenses AS (
        SELECT
          expense.amount,

          expense.currency,

          expense.created_at AS event_at

        FROM finance_expenses expense

        CROSS JOIN time_boundaries boundaries

        WHERE
          $1 = 'all'

          OR (
            $1 = 'today'
            AND expense.created_at >= boundaries.today_start
          )

          OR (
            $1 = 'month'
            AND expense.created_at >= boundaries.month_start
          )
      ),

      income_summary AS (
        SELECT
          currency,

          SUM(amount) AS total_income,

          COUNT(*) AS income_count

        FROM filtered_income

        GROUP BY currency
      ),

      expense_summary AS (
        SELECT
          currency,

          SUM(amount) AS total_expenses,

          COUNT(*) AS expense_count

        FROM filtered_expenses

        GROUP BY currency
      )

      SELECT
        COALESCE(
          income.currency,
          expense.currency
        ) AS currency,

        COALESCE(
          income.total_income,
          0
        ) AS total_income,

        COALESCE(
          expense.total_expenses,
          0
        ) AS total_expenses,

        COALESCE(
          income.income_count,
          0
        ) AS income_count,

        COALESCE(
          expense.expense_count,
          0
        ) AS expense_count

      FROM income_summary income

      FULL OUTER JOIN expense_summary expense
        ON expense.currency = income.currency

      ORDER BY currency ASC
    `,
    [safePeriod]
  );

  return result.rows.map((row) => {
    const income = Number(
      row.total_income || 0
    );

    const expenses = Number(
      row.total_expenses || 0
    );

    return {
      currency: row.currency,

      totalIncome: income,

      totalExpenses: expenses,

      netProfit: income - expenses,

      incomeCount: Number(
        row.income_count || 0
      ),

      expenseCount: Number(
        row.expense_count || 0
      ),
    };
  });
}

// --------------------------------------------------
// Latest expenses
// --------------------------------------------------

async function getLatestExpenses(limit = 10) {
  const db = getClient();

  const safeLimit = normalizeLimit(limit);

  const result = await db.query(
    `
      SELECT
        id,
        category,
        description,
        amount,
        currency,
        created_by_telegram_id,
        created_at

      FROM finance_expenses

      ORDER BY
        created_at DESC,
        id DESC

      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  createExpense,
  getFinanceReport,
  getLatestExpenses,
};
