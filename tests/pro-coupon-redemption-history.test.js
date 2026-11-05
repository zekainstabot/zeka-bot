const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PURCHASE_SERVICE_PATH = path.join(
  process.cwd(),
  "services",
  "pro-purchase.service.js"
);

const REPORT_SERVICE_PATH = path.join(
  process.cwd(),
  "services",
  "pro-coupon-report.service.js"
);

const POOL_MODULE_PATH = require.resolve(
  "../database/pool"
);

let mockDatabase = null;

require.cache[POOL_MODULE_PATH] = {
  id: POOL_MODULE_PATH,
  filename: POOL_MODULE_PATH,
  loaded: true,
  exports: {
    getPool() {
      if (!mockDatabase) {
        throw new Error("MOCK_DATABASE_NOT_CONFIGURED");
      }

      return mockDatabase;
    },
  },
};

delete require.cache[
  require.resolve("../services/pro-coupon-report.service")
];

const {
  getCouponUsageReport,
} = require("../services/pro-coupon-report.service");

function readPurchaseService() {
  return fs.readFileSync(
    PURCHASE_SERVICE_PATH,
    "utf8"
  );
}

function readReportService() {
  return fs.readFileSync(
    REPORT_SERVICE_PATH,
    "utf8"
  );
}

function createMockDatabase() {
  const calls = [];

  return {
    calls,

    async query(sql, params = []) {
      calls.push({
        sql,
        params,
      });

      if (
        sql.includes("FROM pro_discount_coupons") &&
        sql.includes("WHERE id = $1")
      ) {
        return {
          rows: [
            {
              id: "12",
              code: "TEST20",
              discount_percent: 20,
              max_uses: 100,
              usage_count: 3,
              is_active: true,
              starts_at: null,
              expires_at: null,
              created_at: new Date(),
            },
          ],
        };
      }

      if (
        sql.includes("LEFT JOIN LATERAL")
      ) {
        return {
          rows: [
            {
              purchase_request_id: "101",
              telegram_user_id: "50001",
              username: "test_user",
              display_name: "Test User",
              duration_months: 3,
              price_amount: 48000,
              base_price_amount: 60000,
              discount_percent: 20,
              purchase_status: "CANCELLED",
              purchase_created_at: new Date(
                "2026-11-01T10:00:00Z"
              ),
              redemption_created_at: new Date(
                "2026-11-01T10:00:00Z"
              ),
              released_at: new Date(
                "2026-11-01T11:00:00Z"
              ),
            },
          ],
        };
      }

      if (
        sql.includes("COUNT(*) FILTER")
      ) {
        return {
          rows: [
            {
              total: "1",
              approved_count: "0",
              pending_count: "0",
              rejected_count: "0",
              cancelled_count: "1",
            },
          ],
        };
      }

      throw new Error(
        "UNEXPECTED_QUERY: " + sql
      );
    },
  };
}

// --------------------------------------------------
// Purchase service history tests
// --------------------------------------------------

test(
  "purchase service records coupon history before deleting redemption",
  () => {
    const source = readPurchaseService();

    const insertIndex = source.indexOf(
      "INSERT INTO pro_discount_redemption_history"
    );

    const deleteIndex = source.indexOf(
      "DELETE FROM pro_discount_redemptions"
    );

    assert.notEqual(
      insertIndex,
      -1,
      "History INSERT query is missing"
    );

    assert.notEqual(
      deleteIndex,
      -1,
      "Redemption DELETE query is missing"
    );

    assert.ok(
      insertIndex < deleteIndex,
      "History must be inserted before redemption deletion"
    );
  }
);

test(
  "coupon history insertion prevents duplicate purchase history",
  () => {
    const source = readPurchaseService();

    assert.match(
      source,
      /ON CONFLICT\s*\(\s*purchase_request_id\s*\)\s*DO NOTHING/i
    );
  }
);

test(
  "coupon usage count decreases only after successful redemption deletion",
  () => {
    const source = readPurchaseService();

    const deleteIndex = source.indexOf(
      "DELETE FROM pro_discount_redemptions"
    );

    const guardIndex = source.indexOf(
      "if (!deleteResult.rows.length)"
    );

    const decrementIndex = source.indexOf(
      "usage_count = GREATEST(usage_count - 1, 0)"
    );

    assert.notEqual(deleteIndex, -1);
    assert.notEqual(guardIndex, -1);
    assert.notEqual(decrementIndex, -1);

    assert.ok(
      deleteIndex < guardIndex,
      "Delete must happen before checking its result"
    );

    assert.ok(
      guardIndex < decrementIndex,
      "Usage count must be decremented after successful deletion"
    );
  }
);

test(
  "cancelled requests release coupon with CANCELLED status",
  () => {
    const source = readPurchaseService();

    assert.match(
      source,
      /releaseCouponRedemption\s*\(\s*client\s*,\s*cancelledRequest\.id\s*,\s*"CANCELLED"\s*\)/s
    );
  }
);

test(
  "rejected requests release coupon with REJECTED status",
  () => {
    const source = readPurchaseService();

    assert.match(
      source,
      /if\s*\(\s*decision\s*===\s*"REJECTED"\s*\)\s*\{\s*await\s+releaseCouponRedemption\s*\(\s*client\s*,\s*request\.id\s*,\s*"REJECTED"\s*\)/s
    );
  }
);

test(
  "coupon release accepts only REJECTED and CANCELLED statuses",
  () => {
    const source = readPurchaseService();

    assert.match(
      source,
      /!\["REJECTED",\s*"CANCELLED"\]\.includes\s*\(\s*purchaseStatus\s*\)/
    );
  }
);

// --------------------------------------------------
// Coupon report tests
// --------------------------------------------------

test(
  "coupon report includes active and released redemptions",
  async () => {
    mockDatabase = createMockDatabase();

    const report = await getCouponUsageReport(
      "12",
      {
        limit: 10,
        offset: 0,
      }
    );

    assert.ok(report);

    assert.equal(
      report.redemptions.length,
      1
    );

    assert.equal(
      report.redemptions[0].purchase_status,
      "CANCELLED"
    );

    assert.ok(
      report.redemptions[0].released_at
    );

    assert.equal(
      report.summary.cancelled,
      1
    );
  }
);

test(
  "coupon report uses history and active redemption tables",
  async () => {
    mockDatabase = createMockDatabase();

    await getCouponUsageReport("12");

    const usageQuery = mockDatabase.calls.find(
      (call) =>
        call.sql.includes("LEFT JOIN LATERAL")
    );

    assert.ok(
      usageQuery,
      "Usage query was not executed"
    );

    assert.match(
      usageQuery.sql,
      /FROM pro_discount_redemptions/i
    );

    assert.match(
      usageQuery.sql,
      /FROM pro_discount_redemption_history/i
    );

    assert.match(
      usageQuery.sql,
      /UNION ALL/i
    );
  }
);

test(
  "coupon report selects only one redemption event per purchase request",
  async () => {
    mockDatabase = createMockDatabase();

    await getCouponUsageReport("12");

    const usageQuery = mockDatabase.calls.find(
      (call) =>
        call.sql.includes("LEFT JOIN LATERAL")
    );

    assert.ok(usageQuery);

    assert.match(
      usageQuery.sql,
      /ORDER BY events\.source_priority DESC/i
    );

    assert.match(
      usageQuery.sql,
      /LIMIT 1/i
    );
  }
);

test(
  "coupon report preserves pagination parameters",
  async () => {
    mockDatabase = createMockDatabase();

    await getCouponUsageReport(
      "12",
      {
        limit: 5,
        offset: 10,
      }
    );

    const usageQuery = mockDatabase.calls.find(
      (call) =>
        call.sql.includes("LEFT JOIN LATERAL")
    );

    assert.ok(usageQuery);

    assert.deepEqual(
      usageQuery.params,
      ["12", "TEST20", 5, 10]
    );
  }
);

test(
  "coupon report rejects invalid coupon identifiers",
  async () => {
    await assert.rejects(
      () => getCouponUsageReport("invalid"),
      {
        message: "INVALID_COUPON_ID",
      }
    );
  }
);

test(
  "coupon report rejects invalid pagination",
  async () => {
    await assert.rejects(
      () =>
        getCouponUsageReport(
          "12",
          {
            limit: 0,
            offset: 0,
          }
        ),
      {
        message: "INVALID_REPORT_LIMIT",
      }
    );
  }
);
