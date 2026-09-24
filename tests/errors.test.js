const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AppError,
  ValidationError,
  NotFoundError,
  TemporaryError,
} = require("../core/errors");

test("AppError exposes default properties", () => {
  const error = new AppError("Something went wrong");

  assert.equal(error.name, "AppError");
  assert.equal(error.message, "Something went wrong");
  assert.equal(error.code, "APP_ERROR");
  assert.equal(error.status, 500);
  assert.equal(error.retryable, false);
  assert.equal(error.details, null);
});

test("AppError accepts custom options", () => {
  const error = new AppError("Custom error", {
    code: "CUSTOM_ERROR",
    status: 422,
    retryable: true,
    details: {
      field: "url",
    },
  });

  assert.equal(error.code, "CUSTOM_ERROR");
  assert.equal(error.status, 422);
  assert.equal(error.retryable, true);

  assert.deepEqual(error.details, {
    field: "url",
  });
});

test("ValidationError has correct properties", () => {
  const error = new ValidationError(
    "Invalid URL",
    {
      field: "url",
    }
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.name, "ValidationError");
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.status, 400);
  assert.equal(error.retryable, false);

  assert.deepEqual(error.details, {
    field: "url",
  });
});

test("NotFoundError has correct properties", () => {
  const error = new NotFoundError(
    "User not found"
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.name, "NotFoundError");
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.status, 404);
  assert.equal(error.retryable, false);
});

test("TemporaryError is retryable", () => {
  const error = new TemporaryError(
    "Service temporarily unavailable"
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.name, "TemporaryError");
  assert.equal(error.code, "TEMPORARY_ERROR");
  assert.equal(error.status, 503);
  assert.equal(error.retryable, true);
});
