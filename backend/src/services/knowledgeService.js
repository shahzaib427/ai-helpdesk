"use strict";
const fs = require("fs/promises");
const path = require("path");
const { Op } = require("sequelize");
const { sequelize, KnowledgeDocument, KnowledgeChunk, User } = require("../models");
const { DOCUMENT_STATUS } = require("../config/constants");
const ApiError = require("../utils/ApiError");
const aiClient = require("./aiClient");
const logger = require("../utils/logger");

function toSummary(doc) {
  return {
    id: doc.id,
    filename: doc.originalName,
    fileType: doc.fileType,
    category: doc.category,
    status: doc.status,
    chunkCount: doc.chunkCount,
    sizeBytes: doc.sizeBytes,
    uploadedBy: doc.uploader ? `${doc.uploader.firstName} ${doc.uploader.lastName}` : null,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt,
    indexedAt: doc.indexedAt,
  };
}

async function list({ page = 1, limit = 20, status, category, search }) {
  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) where.originalName = { [Op.iLike]: `%${search}%` };

  const { rows, count } = await KnowledgeDocument.findAndCountAll({
    where,
    include: [{ model: User, as: "uploader", required: false }],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    documents: rows.map(toSummary),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getById(id) {
  const doc = await KnowledgeDocument.findByPk(id, {
    include: [
      { model: User, as: "uploader", required: false },
      { model: KnowledgeChunk, as: "chunks", required: false, separate: true, order: [["chunkIndex", "ASC"]] },
    ],
  });
  if (!doc) throw ApiError.notFound("Document not found");
  return { ...toSummary(doc), chunks: doc.chunks };
}

// The actual pipeline: read the file back off disk, send its text to the AI
// service, and persist whatever chunks come back. Shared by upload and
// re-index, since re-indexing is just "run ingestion again" once the old
// chunks are cleared.
async function runIngestion(doc) {
  doc.status = DOCUMENT_STATUS.PROCESSING;
  doc.errorMessage = null;
  await doc.save();

  try {
    const text = await fs.readFile(doc.filePath, "utf-8");
    const result = await aiClient.ingestDocument({
      documentId: doc.id,
      filename: doc.originalName,
      category: doc.category,
      text,
    });

    await sequelize.transaction(async (tx) => {
      await KnowledgeChunk.destroy({ where: { documentId: doc.id }, transaction: tx });
      if (result.chunks?.length) {
        await KnowledgeChunk.bulkCreate(
          result.chunks.map((c) => ({
            documentId: doc.id,
            chunkIndex: c.chunk_index,
            content: c.text,
            pageNumber: c.page_number,
            vectorId: c.chunk_uid,
          })),
          { transaction: tx }
        );
      }
      doc.status = DOCUMENT_STATUS.READY;
      doc.chunkCount = result.chunk_count;
      doc.indexedAt = new Date();
      await doc.save({ transaction: tx });
    });
  } catch (err) {
    // Ingestion failing (AI service down, bad encoding, whatever) is an
    // expected, recoverable outcome — not a 500. The document stays on disk
    // so a retry (re-index) doesn't need a fresh upload.
    logger.error(`Ingestion failed for document ${doc.id}:`, err.message);
    doc.status = DOCUMENT_STATUS.FAILED;
    doc.errorMessage = err.message;
    await doc.save();
  }

  return doc;
}

async function upload(user, file, { category }) {
  const fileType = path.extname(file.originalname).slice(1).toLowerCase();

  const doc = await KnowledgeDocument.create({
    filename: file.filename,
    originalName: file.originalname,
    filePath: file.path,
    fileType,
    sizeBytes: file.size,
    category: category || null,
    uploadedBy: user.id,
    status: DOCUMENT_STATUS.PROCESSING,
  });

  await runIngestion(doc);
  return getById(doc.id);
}

async function reindex(id) {
  const doc = await KnowledgeDocument.findByPk(id);
  if (!doc) throw ApiError.notFound("Document not found");

  // Clear whatever is currently in the vector store for this document before
  // re-ingesting, so a re-index never leaves stale + fresh chunks side by
  // side. Best-effort: if the AI service happens to be down, proceed anyway
  // — runIngestion will fail cleanly and mark the document FAILED rather
  // than silently leaving old chunks in place.
  try {
    await aiClient.removeDocument(id);
  } catch (err) {
    logger.error(`Could not clear existing vectors for document ${id} before reindex:`, err.message);
  }

  await runIngestion(doc);
  return getById(doc.id);
}

async function remove(id) {
  const doc = await KnowledgeDocument.findByPk(id);
  if (!doc) throw ApiError.notFound("Document not found");

  try {
    await aiClient.removeDocument(id);
  } catch (err) {
    // Same reasoning as reindex: don't let an unreachable AI service block
    // deleting a document the admin explicitly asked to remove.
    logger.error(`Could not remove vectors for document ${id}:`, err.message);
  }

  await fs.unlink(doc.filePath).catch(() => {});
  await doc.destroy(); // cascades to knowledge_chunks via the FK

  return { id };
}

module.exports = { list, getById, upload, reindex, remove };
