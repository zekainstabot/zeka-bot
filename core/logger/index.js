const levels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

function log(level, message, metadata = {}) {
  const normalizedLevel = String(level).toUpperCase();

  if (!levels.includes(normalizedLevel)) {
    throw new Error(`Invalid log level: ${level}`);
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: normalizedLevel,
      message,
      ...metadata,
    })
  );
}

module.exports = {
  debug: (message, metadata) => log("DEBUG", message, metadata),
  info: (message, metadata) => log("INFO", message, metadata),
  warn: (message, metadata) => log("WARN", message, metadata),
  error: (message, metadata) => log("ERROR", message, metadata),
  fatal: (message, metadata) => log("FATAL", message, metadata),
};
