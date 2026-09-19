"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Agent",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
      department: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "General Support" },
      isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      maxOpenTickets: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 20 },
    },
    { tableName: "agents", indexes: [{ fields: ["is_available"] }] }
  );
};
