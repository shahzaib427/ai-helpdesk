"use strict";
// Creates/updates all tables from the Sequelize models.
// Phase 1 uses sync(); real migrations arrive in Phase 9.
const { sequelize } = require("../models");
const logger = require("../utils/logger");

async function sync() {
  const force = process.argv.includes("--force");
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force, alter: !force });
    logger.info(force ? "Tables dropped and recreated" : "Tables synced");
    process.exit(0);
  } catch (err) {
    logger.error("Sync failed:", err.message);
    process.exit(1);
  }
}

sync();
