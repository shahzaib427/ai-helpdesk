"use strict";
const config = require("../config/env");

// Deliberately tiny. Never log passwords, tokens or full request bodies.
const logger = {
  info: (...args) => !config.isTest && console.log("[info]", ...args),
  warn: (...args) => !config.isTest && console.warn("[warn]", ...args),
  error: (...args) => console.error("[error]", ...args),
};

module.exports = logger;
