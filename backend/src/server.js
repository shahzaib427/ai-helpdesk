"use strict";
const app = require("./app");
const config = require("./config/env");
const { connectDatabase } = require("./config/database");
const logger = require("./utils/logger");

async function start() {
  try {
    await connectDatabase();
    logger.info(`Connected to PostgreSQL database "${config.db.name}"`);

    app.listen(config.port, () => {
      logger.info(`Backend listening on http://localhost:${config.port} (${config.env})`);
    });
  } catch (err) {
    logger.error("Failed to start backend:", err.message);
    process.exit(1);
  }
}

start();
