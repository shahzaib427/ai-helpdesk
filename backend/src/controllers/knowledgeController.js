"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const knowledgeService = require("../services/knowledgeService");

const list = asyncHandler(async (req, res) => {
  const { documents, meta } = await knowledgeService.list(req.query);
  return sendSuccess(res, { message: "Knowledge documents", data: { documents }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const document = await knowledgeService.getById(req.params.id);
  return sendSuccess(res, { message: "Knowledge document", data: { document } });
});

const upload = asyncHandler(async (req, res) => {
  const document = await knowledgeService.upload(req.user, req.file, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Document uploaded and indexed", data: { document } });
});

const reindex = asyncHandler(async (req, res) => {
  const document = await knowledgeService.reindex(req.params.id);
  return sendSuccess(res, { message: "Document re-indexed", data: { document } });
});

const remove = asyncHandler(async (req, res) => {
  await knowledgeService.remove(req.params.id);
  return sendSuccess(res, { message: "Document deleted", data: null });
});

module.exports = { list, getOne, upload, reindex, remove };
