"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "OrderItem",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    { tableName: "order_items", indexes: [{ fields: ["order_id"] }, { fields: ["product_id"] }] }
  );
};
