const databaseConfig = require("../config/database");

let client = null;

function getClient() {
  if (!client) {
    throw new Error("Database client has not been initialized");
  }

  return client;
}

function setClient(databaseClient) {
  if (!databaseClient) {
    throw new Error("Database client is required");
  }

  client = databaseClient;
}

async function close() {
  if (!client) {
    return;
  }

  if (typeof client.end === "function") {
    await client.end();
  }

  client = null;
}

module.exports = {
  config: databaseConfig,
  getClient,
  setClient,
  close,
};
