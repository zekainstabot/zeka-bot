const databaseConfig = require("../config/database");
const {
  getPool,
  testConnection,
  closePool,
} = require("./pool");

function getClient() {
  return getPool();
}

function setClient(databaseClient) {
  if (!databaseClient) {
    throw new Error("Database client is required");
  }

  if (typeof databaseClient.query !== "function") {
    throw new TypeError("Database client must provide a query() method");
  }

  return databaseClient;
}

async function checkConnection() {
  return testConnection();
}

async function close() {
  await closePool();
}

module.exports = {
  config: databaseConfig,
  getClient,
  setClient,
  checkConnection,
  close,
};
