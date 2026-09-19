"use strict";
const { Sequelize } = require("sequelize");
const config = require("./env");

// One shared Sequelize instance. Models register themselves against it.
const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: "postgres",
  logging: config.env === "development" ? (msg) => console.log(`[sql] ${msg}`) : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: { max: 10, min: 0, idle: 10000 },
});

async function connectDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

module.exports = { sequelize, connectDatabase };
