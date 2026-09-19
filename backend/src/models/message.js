"use strict";
const { DataTypes } = require("sequelize");
const { SENDER_TYPE, MESSAGE_TYPE } = require("../config/constants");

module.exports = (sequelize) => {
  return sequelize.define(
    "Message",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      conversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      // Null for AI and SYSTEM messages, which have no user behind them.
      senderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      senderType: { type: DataTypes.ENUM(...Object.values(SENDER_TYPE)), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      messageType: {
        type: DataTypes.ENUM(...Object.values(MESSAGE_TYPE)),
        allowNull: false,
        defaultValue: MESSAGE_TYPE.TEXT,
      },
      // Sources, tool calls, confidence scores. JSON keeps the schema stable
      // while the AI layer evolves in later phases.
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      tableName: "messages",
      updatedAt: false,
      indexes: [{ fields: ["conversation_id", "created_at"] }, { fields: ["sender_type"] }],
    }
  );
};
