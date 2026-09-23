const queueConfig = {
  normal: {
    maxConcurrent: 3,
  },

  heavy: {
    maxProcessesPerHour: 2,
  },

  retry: {
    maxAttempts: 3,
    delayMs: 60_000,
  },

  cooldown: {
    downloadRequestMs: 20_000,
  },
};

module.exports = queueConfig;
