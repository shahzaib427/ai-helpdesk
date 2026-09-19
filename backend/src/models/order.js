"use strict";
const { DataTypes } = require("sequelize");
const { ORDER_STATUS } = require("../config/constants");

module.exports = (sequelize) => {
  return sequelize.define(
    "Order",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      orderNumber: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      status: {
        type: DataTypes.ENUM(...Object.values(ORDER_STATUS)),
        allowNull: false,
        defaultValue: ORDER_STATUS.PENDING,
      },
      totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
      trackingNumber: { type: DataTypes.STRING(64), allowNull: true },
      carrier: { type: DataTypes.STRING(60), allowNull: true },
      placedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      estimatedDelivery: { type: DataTypes.DATEONLY, allowNull: true },
      deliveredAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "orders", indexes: [{ fields: ["customer_id"] }, { fields: ["status"] }] }
  );
};
