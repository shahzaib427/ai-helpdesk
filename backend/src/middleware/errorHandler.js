"use strict";
const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require("sequelize");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const config = require("../config/env");

// Last middleware in the chain. Converts anything thrown into the standard
// error envelope: { success: false, message, details }
// eslint-disable-next-line no-unused-vars
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
    logger.error(err.stack || err.message);
    error = ApiError.internal();
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(config.env === "development" && error.statusCode === 500 ? { stack: err.stack } : {}),
  });
};
