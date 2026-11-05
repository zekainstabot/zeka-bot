const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDeliveryRecoveryService,
} = require("../services/delivery-recovery.service");

function createHarness({
  jobs = [],
  delivery = null,
  lock = true,
  consumeError = null,
  completeError = null,
  reservedCost = 2,
} = {}) {
  const calls = [];

  const lockClient = {
    async query(sql) {
      calls.push(
        sql.includes("pg_try_advisory_lock")
          ? "lock"
          : "unlock"
      );

      if (sql.includes("pg_try_advisory_lock")) {
        return {
          rows: [{ locked: lock }],
        };
      }

      return {
        rows: [{ unlocked: true }],
      };
    },

    release() {
      calls.push("release");
    },
  };

  const recover = createDeliveryRecoveryService({
    getPool: () => ({
      connect: async () => lockClient,
    }),

    jobRepository: {
      findSending: async () =>
        jobs.map((job) => ({
          reserved_cost: reservedCost,
          ...job,
        })),
    },

    deliveryRepository: {
      findByJobId: async () => delivery,
    },

    consumeCredit: async (jobId) => {
      calls.push(`consume:${jobId}`);

      if (consumeError) {
        throw consumeError;
      }

      return [];
    },

    markCompleted: async (jobId, data) => {
      calls.push(`complete:${jobId}:${data.finalCost}`);

      if (completeError) {
        throw completeError;
      }

      return {
        id: jobId,
        status: "COMPLETED",
      };
    },
  });

  return {
    recover,
    calls,
  };
}

test("recovery skips when another instance owns the lock", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    lock: false,
  });

  const result = await recover();

  assert.equal(result.skipped, true);
  assert.equal(result.recovered, 0);
  assert.equal(calls.includes("consume:1"), false);
  assert.equal(calls.includes("complete:1:2"), false);
  assert.ok(calls.includes("release"));
});

test("recovery does not consume or complete when delivery is missing", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: null,
  });

  const result = await recover();

  assert.equal(result.recovered, 0);
  assert.equal(calls.includes("consume:1"), false);
  assert.equal(
    calls.some((call) => call.startsWith("complete:")),
    false
  );
});

test("recovery does not resend or consume UNKNOWN deliveries", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: {
      status: "UNKNOWN",
    },
  });

  const result = await recover();

  assert.equal(result.recovered, 0);
  assert.equal(calls.includes("consume:1"), false);
  assert.equal(calls.includes("complete:1:2"), false);
});

test("SENT delivery consumes credit and completes the job", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: {
      status: "SENT",
      telegram_message_id: "123",
    },
  });

  const result = await recover();

  assert.equal(result.recovered, 1);

  assert.deepEqual(
    calls.filter((call) =>
      ["consume:1", "complete:1:2"].includes(call)
    ),
    ["consume:1", "complete:1:2"]
  );
});

test("credit consumption failure leaves the job for retry", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: {
      status: "SENT",
    },
    consumeError: new Error("Credit database failure"),
  });

  const result = await recover();

  assert.equal(result.recovered, 0);
  assert.equal(calls.includes("complete:1:2"), false);
});

test("completion failure leaves the job for retry and releases the lock", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: {
      status: "SENT",
      telegram_message_id: "123",
    },
    completeError: new Error("Completion database failure"),
  });

  const result = await recover();

  assert.equal(result.recovered, 0);
  assert.deepEqual(result.jobs, []);

  assert.ok(calls.includes("consume:1"));
  assert.ok(calls.includes("complete:1:2"));

  assert.ok(calls.includes("unlock"));
  assert.ok(calls.includes("release"));
});

test("zero-cost SENT delivery completes without consuming credit", async () => {
  const { recover, calls } = createHarness({
    jobs: [{ id: 1 }],
    delivery: {
      status: "SENT",
    },
    reservedCost: 0,
  });

  const result = await recover();

  assert.equal(result.recovered, 1);
  assert.equal(calls.includes("consume:1"), false);
  assert.equal(calls.includes("complete:1:0"), true);
});

test("recovery releases the database lock after processing", async () => {
  const { recover, calls } = createHarness({
    jobs: [],
  });

  await recover();

  assert.ok(calls.includes("unlock"));
  assert.ok(calls.includes("release"));
});
