"use strict";
const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require("sequelize");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const config = require("../config/env");

module.exports = (err, req, res, next) => {
  let error = err;

  if (err instanceof UniqueConstraintError) {
    error = ApiError.conflict("A record with those details already exists");
  } else if (err instanceof ForeignKeyConstraintError) {
    error = ApiError.badRequest("Referenced record does not exist");
  } else if (err instanceof ValidationError) {
    error = ApiError.unprocessable(
      "Validation failed",
      err.errors.map((e) => ({ field: e.path, message: e.message }))
    );
  } else if (!(err instanceof ApiError)) {
    // Sequelize wraps the real driver error in .original/.parent — log that
    // too, or every DB failure just prints the word "Error" with nothing
    // useful to debug from.
    logger.error(err.original?.message || err.parent?.message || err.message || "Unknown error");
    logger.error(err.stack);
    error = ApiError.internal();
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(config.env === "development" && error.statusCode === 500 ? { stack: err.stack } : {}),
  });
};