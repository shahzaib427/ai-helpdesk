"use strict";
const jwt = require("jsonwebtoken");
const config = require("../config/env");

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signAccessToken, verifyAccessToken };
