"use strict";
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");
const { User } = require("../models");

// Verifies the bearer token and attaches the live user row to req.user.
// Reading from the DB (not just the token) means a deactivated user loses
// access immediately instead of when the token expires.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) throw ApiError.unauthorized("Missing bearer token");

    let payload;
    try {
      payload = verifyAccessToken(header.slice(7));
    } catch (err) {
      throw ApiError.unauthorized(
        err.name === "TokenExpiredError" ? "Session expired, sign in again" : "Invalid token"
      );
    }

    const user = await User.findByPk(payload.sub);
    if (!user) throw ApiError.unauthorized("Account no longer exists");
    if (!user.isActive) throw ApiError.forbidden("This account is deactivated");

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Usage: router.get("/", requireAuth, requireRole("ADMIN"), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}

module.exports = { requireAuth, requireRole };
