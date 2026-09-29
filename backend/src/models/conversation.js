"use strict";
const { DataTypes } = require("sequelize");
const { CONVERSATION_STATUS } = require("../config/constants");

module.exports = (sequelize) => {
  return sequelize.define(
    "Conversation",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      assignedAgentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      subject: { type: DataTypes.STRING(180), allowNull: true },
      status: {
        type: DataTypes.ENUM(...Object.values(CONVERSATION_STATUS)),
        allowNull: false,
        defaultValue: CONVERSATION_STATUS.ACTIVE,
      },
      aiEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
      // Null means a customer explicitly clicked "Ask for a human" (Phase 2's
      // door, with no AI-determined reason). Any other value is one of
      // support_agent.py's router outcomes — the dashboard uses this to tell
      // "AI escalated this" apart from "customer asked directly" without
      // guessing from timing alone.
      handoffReason: { type: DataTypes.STRING(40), allowNull: true },
    },
    {
      tableName: "conversations",
      indexes: [{ fields: ["customer_id"] }, { fields: ["assigned_agent_id"] }, { fields: ["status"] }],
    }
  );
};