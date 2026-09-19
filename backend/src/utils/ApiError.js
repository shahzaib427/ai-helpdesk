"use strict";

// Every expected failure in the app is thrown as an ApiError so the error
// middleware can turn it into a consistent JSON response.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = "Bad request", details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = "Not authenticated") { return new ApiError(401, msg); }
  static forbidden(msg = "You do not have access to this resource") { return new ApiError(403, msg); }
  static notFound(msg = "Resource not found") { return new ApiError(404, msg); }
  static conflict(msg = "Resource already exists") { return new ApiError(409, msg); }
  static unprocessable(msg = "Validation failed", details) { return new ApiError(422, msg, details); }
  static internal(msg = "Something went wrong") { return new ApiError(500, msg); }
}

module.exports = ApiError;
