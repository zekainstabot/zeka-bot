class AppError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "AppError";
    this.code = options.code || "APP_ERROR";
    this.status = options.status || 500;
    this.retryable = options.retryable || false;
    this.details = options.details || null;

    Error.captureStackTrace?.(this, AppError);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, {
      code: "VALIDATION_ERROR",
      status: 400,
      retryable: false,
      details,
    });

    this.name = "ValidationError";
  }
}

class NotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, {
      code: "NOT_FOUND",
      status: 404,
      retryable: false,
      details,
    });

    this.name = "NotFoundError";
  }
}

class TemporaryError extends AppError {
  constructor(message, details = null) {
    super(message, {
      code: "TEMPORARY_ERROR",
      status: 503,
      retryable: true,
      details,
    });

    this.name = "TemporaryError";
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  TemporaryError,
};
