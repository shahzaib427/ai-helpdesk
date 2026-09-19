"use strict";
const { DataTypes } = require("sequelize");
const { DOCUMENT_STATUS } = require("../config/constants");

module.exports = (sequelize) => {
  return sequelize.define(
    "KnowledgeDocument",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      originalName: { type: DataTypes.STRING(255), allowNull: false },
      filePath: { type: DataTypes.STRING(500), allowNull: false },
      fileType: { type: DataTypes.STRING(12), allowNull: false },
      sizeBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      category: { type: DataTypes.STRING(60), allowNull: true },
      status: {
        type: DataTypes.ENUM(...Object.values(DOCUMENT_STATUS)),
        allowNull: false,
        defaultValue: DOCUMENT_STATUS.PROCESSING,
      },
      chunkCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      uploadedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      indexedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "knowledge_documents", indexes: [{ fields: ["status"] }] }
  );
};
