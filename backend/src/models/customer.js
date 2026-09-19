"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Customer",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
      phone: { type: DataTypes.STRING(32), allowNull: true },
      company: { type: DataTypes.STRING(120), allowNull: true },
      addressLine: { type: DataTypes.STRING(200), allowNull: true },
      city: { type: DataTypes.STRING(80), allowNull: true },
      country: { type: DataTypes.STRING(80), allowNull: true },
      postalCode: { type: DataTypes.STRING(20), allowNull: true },
    },
    { tableName: "customers" }
  );
};
