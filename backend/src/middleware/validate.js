"use strict";
const ApiError = require("../utils/ApiError");

// Validates req[source] against a zod schema and replaces it with the parsed
// value, so controllers always receive clean, typed input.
const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join(".") || source,
      message: i.message,
    }));
    return next(ApiError.unprocessable("Validation failed", details));
  }
  req[source] = result.data;
  return next();
};

module.exports = validate;
