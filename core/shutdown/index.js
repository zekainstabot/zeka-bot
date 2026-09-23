const handlers = new Set();
let shuttingDown = false;

function register(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Shutdown handler must be a function");
  }

  handlers.add(handler);

  return () => handlers.delete(handler);
}

function isShuttingDown() {
  return shuttingDown;
}

async function shutdown(reason = "unknown") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const handler of [...handlers]) {
    try {
      await handler(reason);
    } catch (error) {
      console.error("Shutdown handler failed:", error);
    }
  }
}

function reset() {
  shuttingDown = false;
  handlers.clear();
}

module.exports = {
  register,
  shutdown,
  isShuttingDown,
  reset,
};
