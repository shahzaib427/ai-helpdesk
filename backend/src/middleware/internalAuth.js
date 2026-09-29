"use strict";
const ApiError = require("../utils/ApiError");
const config = require("../config/env");

// Guards /api/internal/*. The AI service has no user session and never will
// — it authenticates with a shared secret instead of a JWT. Deliberately a
// separate middleware from requireAuth rather than a special "service" role
// on the user table: there is no user behind this request at all, and
// pretending otherwise would be more confusing, not less.
function requireInternalKey(req, res, next) {
  const provided = req.headers["x-internal-api-key"];
  if (!provided || provided !== config.internalApiKey) {
    return next(ApiError.unauthorized("Invalid or missing internal API key"));
  }
  return next();
}

module.exports = { requireInternalKey };
