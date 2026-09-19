"use strict";
const { DataTypes } = require("sequelize");
const { TICKET_STATUS, TICKET_PRIORITY } = require("../config/constants");

module.exports = (sequelize) => {
  return sequelize.define(
    "Ticket",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      conversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      assignedAgentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      subject: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      category: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "general" },
      priority: {
        type: DataTypes.ENUM(...Object.values(TICKET_PRIORITY)),
        allowNull: false,
        defaultValue: TICKET_PRIORITY.MEDIUM,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(TICKET_STATUS)),
        allowNull: false,
        defaultValue: TICKET_STATUS.OPEN,
      },
      createdByAi: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      // Staff-only notes: [{ authorId, authorName, content, createdAt }, ...].
      // Never serialised into a customer-facing response.
      internalNotes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    },
    {
      tableName: "tickets",
      indexes: [
        { fields: ["customer_id"] },
        { fields: ["assigned_agent_id"] },
        { fields: ["status", "priority"] },
      ],
    }
  );
};
