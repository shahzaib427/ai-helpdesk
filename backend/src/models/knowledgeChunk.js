"use strict";
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "KnowledgeChunk",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      documentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      chunkIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      pageNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      tokenCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      // Position/id of this chunk inside the FAISS index. Kept here so the
      // vector store can be rebuilt from the database at any time.
      vectorId: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      tableName: "knowledge_chunks",
      updatedAt: false,
      indexes: [{ fields: ["document_id", "chunk_index"] }, { fields: ["vector_id"] }],
    }
  );
};
