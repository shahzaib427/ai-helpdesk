"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Product",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      sku: { type: DataTypes.STRING(48), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.STRING(80), allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
      stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      warrantyMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "products", indexes: [{ fields: ["category"] }, { fields: ["is_active"] }] }
  );
};
