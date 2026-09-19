"use strict";
const rateLimit = require("express-rate-limit");
const config = require("../config/env");

const base = { standardHeaders: true, legacyHeaders: false, skip: () => config.isTest };

// Generous ceiling for normal API traffic.
const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: "Too many requests, slow down" },
});

// Tight limit on credential endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many authentication attempts, try again later" },
});

module.exports = { apiLimiter, authLimiter };
