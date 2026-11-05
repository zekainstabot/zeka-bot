const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

function readProjectFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);

  assert.equal(
    fs.existsSync(filePath),
    true,
    `Missing file: ${relativePath}`
  );

  return fs.readFileSync(filePath, "utf8");
}

function extractFunction(source, functionName) {
  const functionStart = source.indexOf(
    `async function ${functionName}`
  );

  assert.notEqual(
    functionStart,
    -1,
    `Missing function: ${functionName}`
  );

  const nextFunction = source.indexOf(
    "\nasync function ",
    functionStart + 1
  );

  return source.slice(
    functionStart,
    nextFunction === -1 ? undefined : nextFunction
  );
}

// --------------------------------------------------
// Finance accounting safety
// --------------------------------------------------

test(
  "accounting income uses confirmed Pro subscriptions only",
  () => {
    const source = readProjectFile(
      "services/super-admin-accounting.service.js"
    );

    assert.match(
      source,
      /FROM\s+pro_subscriptions\s+subscription/i
    );

    assert.match(
      source,
      /subscription\.source_type\s*=\s*'PURCHASE'/i
    );

    assert.match(
      source,
      /subscription\.price\s*>\s*0/i
    );
  }
);

test(
  "accounting does not count unverified payment statuses",
  () => {
    const source = readProjectFile(
      "services/super-admin-accounting.service.js"
    );

    assert.doesNotMatch(
      source,
      /FROM\s+payments\s+payment/i
    );

    assert.doesNotMatch(
      source,
      /'SUCCEEDED'|'COMPLETED'|'VERIFIED'|'SUCCESS'|'PAID'/i
    );
  }
);

test(
  "accounting keeps income and expenses separated by currency",
  () => {
    const source = readProjectFile(
      "services/super-admin-accounting.service.js"
    );

    assert.match(
      source,
      /GROUP BY currency/i
    );

    assert.match(
      source,
      /expense\.currency\s*=\s*income\.currency/i
    );

    assert.match(
      source,
      /FULL OUTER JOIN/i
    );

    assert.match(
      source,
      /netProfit:\s*income\s*-\s*expenses/
    );
  }
);

test(
  "accounting supports Tehran day and month boundaries",
  () => {
    const source = readProjectFile(
      "services/super-admin-accounting.service.js"
    );

    assert.match(
      source,
      /Asia\/Tehran/
    );

    assert.match(
      source,
      /date_trunc\(\s*'day'/i
    );

    assert.match(
      source,
      /date_trunc\(\s*'month'/i
    );
  }
);

test(
  "expense creation validates amount and creator",
  () => {
    const source = readProjectFile(
      "services/super-admin-accounting.service.js"
    );

    assert.match(
      source,
      /INVALID_EXPENSE_AMOUNT/
    );

    assert.match(
      source,
      /INVALID_EXPENSE_CREATOR/
    );

    assert.match(
      source,
      /INSERT INTO finance_expenses/i
    );
  }
);

// --------------------------------------------------
// Credit amount validation
// --------------------------------------------------

test(
  "download credit reservation validates numeric amount",
  () => {
    const source = readProjectFile(
      "services/credit.service.js"
    );

    const reserveFunction = extractFunction(
      source,
      "reserveCredit"
    );

    assert.match(
      reserveFunction,
      /Number\.isFinite\(normalizedAmount\)/
    );

    assert.match(
      reserveFunction,
      /normalizedAmount\s*<=\s*0/
    );

    assert.match(
      reserveFunction,
      /let remainingToReserve\s*=\s*normalizedAmount/
    );
  }
);

test(
  "game credit reservation validates numeric amount",
  () => {
    const source = readProjectFile(
      "services/credit.service.js"
    );

    const reserveFunction = extractFunction(
      source,
      "reserveGameCredit"
    );

    assert.match(
      reserveFunction,
      /Number\.isFinite\(normalizedAmount\)/
    );

    assert.match(
      reserveFunction,
      /normalizedAmount\s*<=\s*0/
    );

    assert.match(
      reserveFunction,
      /let remainingToReserve\s*=\s*normalizedAmount/
    );
  }
);

// --------------------------------------------------
// Credit concurrency safety
// --------------------------------------------------

test(
  "credit reservation locks available accounts",
  () => {
    const source = readProjectFile(
      "repositories/credit.repository.js"
    );

    assert.match(
      source,
      /async function findAvailablePackages/
    );

    assert.match(
      source,
      /remaining_amount\s*>\s*0/i
    );

    assert.match(
      source,
      /FOR UPDATE/i
    );
  }
);

test(
  "download and game reservations use database transactions",
  () => {
    const source = readProjectFile(
      "services/credit.service.js"
    );

    const transactionCount = (
      source.match(/await client\.query\("BEGIN"\)/g) || []
    ).length;

    const commitCount = (
      source.match(/await client\.query\("COMMIT"\)/g) || []
    ).length;

    const rollbackCount = (
      source.match(/await client\.query\("ROLLBACK"\)/g) || []
    ).length;

    assert.ok(
      transactionCount >= 2,
      "Download and game reservations must use transactions"
    );

    assert.ok(
      commitCount >= 2,
      "Reservation transactions must commit"
    );

    assert.ok(
      rollbackCount >= 2,
      "Reservation transactions must rollback on errors"
    );
  }
);

test(
  "download and game reservations use the transaction client for account locks",
  () => {
    const source = readProjectFile(
      "services/credit.service.js"
    );

    const lockCalls = source.match(
      /findAvailablePackages\(\s*userId,\s*client\s*\)/g
    ) || [];

    assert.equal(
      lockCalls.length,
      2,
      "Both reservation paths must lock accounts using their transaction client"
    );
  }
);

test(
  "credit reservations update accounts and create reservation records in the same transaction",
  () => {
    const source = readProjectFile(
      "services/credit.service.js"
    );

    assert.match(
      source,
      /updateRemaining\(\s*account\.id,\s*newRemaining,\s*client\s*\)/s
    );

    assert.match(
      source,
      /creditReservationRepository\.create\([\s\S]*?client\s*\)/s
    );
  }
);

test(
  "credit reservation state changes are conditional",
  () => {
    const source = readProjectFile(
      "repositories/credit.reservation.repository.js"
    );

    assert.match(
      source,
      /WHERE id = \$1\s+AND status = 'RESERVED'[\s\S]*?RETURNING \*/i
    );

    assert.match(
      source,
      /async function markConsumed/
    );

    assert.match(
      source,
      /async function markReleased/
    );
  }
);

// --------------------------------------------------
// Database uniqueness constraints
// --------------------------------------------------

test(
  "active download reservations have a unique job constraint",
  () => {
    const migration = readProjectFile(
      "database/migrations/125_add_active_credit_reservation_job_unique.sql"
    );

    assert.match(
      migration,
      /CREATE UNIQUE INDEX/i
    );

    assert.match(
      migration,
      /ON credit_reservations\(job_id\)/i
    );

    assert.match(
      migration,
      /WHERE status = 'RESERVED'/i
    );
  }
);

test(
  "active game reservations have a unique session constraint",
  () => {
    const migration = readProjectFile(
      "database/migrations/131_add_game_session_to_credit_reservations.sql"
    );

    assert.match(
      migration,
      /CREATE UNIQUE INDEX/i
    );

    assert.match(
      migration,
      /ON credit_reservations\(game_session_id\)/i
    );

    assert.match(
      migration,
      /status = 'RESERVED'/i
    );
  }
);

// --------------------------------------------------
// Finance expense migration
// --------------------------------------------------

test(
  "finance expense migration contains required accounting fields",
  () => {
    const migration = readProjectFile(
      "database/migrations/176_create_finance_expenses.sql"
    );

    const requiredFields = [
      "category",
      "description",
      "amount",
      "currency",
      "created_by_telegram_id",
      "created_at",
    ];

    for (const field of requiredFields) {
      assert.match(
        migration,
        new RegExp(`\\b${field}\\b`, "i"),
        `Missing finance expense field: ${field}`
      );
    }

    assert.match(
      migration,
      /CHECK\s*\(\s*amount\s*>\s*0\s*\)/i
    );
  }
);
