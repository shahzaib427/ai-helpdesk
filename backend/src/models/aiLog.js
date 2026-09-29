"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "AiLog",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      conversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      messageId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      provider: { type: DataTypes.STRING(60), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      intent: { type: DataTypes.STRING(60), allowNull: true },
      toolUsed: { type: DataTypes.STRING(60), allowNull: true },
      sentiment: { type: DataTypes.STRING(10), allowNull: true },
      handoffReason: { type: DataTypes.STRING(30), allowNull: true },
      retrievedChunks: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      latencyMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      success: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      error: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "ai_logs",
      updatedAt: false,
      indexes: [
        { fields: ["conversation_id"] },
        { fields: ["intent"] },
        { fields: ["success"] },
        { fields: ["sentiment"] },
      ],
    }
  );
};
