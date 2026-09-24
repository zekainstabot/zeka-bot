const test = require("node:test");
const assert = require("node:assert/strict");

const requestService = require("../services/request.service");

test("request service exposes the expected API", () => {
  assert.equal(
    typeof requestService.createDownloadRequest,
    "function"
  );

  assert.equal(
    typeof requestService.getRequestById,
    "function"
  );

  assert.equal(
    typeof requestService.getRequestByRequestId,
    "function"
  );

  assert.equal(
    typeof requestService.updateRequestStatus,
    "function"
  );
});

test("getRequestById returns null for missing id", async () => {
  const result =
    await requestService.getRequestById(null);

  assert.equal(result, null);
});

test("getRequestByRequestId returns null for missing request id", async () => {
  const result =
    await requestService.getRequestByRequestId("");

  assert.equal(result, null);
});

test("getRequestById rejects invalid falsy ids", async () => {
  const values = [
    null,
    undefined,
    "",
    0,
    false,
  ];

  for (const value of values) {
    const result =
      await requestService.getRequestById(value);

    assert.equal(result, null);
  }
});

test("getRequestByRequestId rejects invalid falsy ids", async () => {
  const values = [
    null,
    undefined,
    "",
    0,
    false,
  ];

  for (const value of values) {
    const result =
      await requestService.getRequestByRequestId(value);

    assert.equal(result, null);
  }
});
