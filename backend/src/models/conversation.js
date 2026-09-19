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
    },
    {
      tableName: "conversations",
      indexes: [{ fields: ["customer_id"] }, { fields: ["assigned_agent_id"] }, { fields: ["status"] }],
    }
  );
};
