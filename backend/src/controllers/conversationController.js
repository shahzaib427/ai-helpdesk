"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { ROLES } = require("../config/constants");
const conversationService = require("../services/conversationService");

// Customers see only their own threads; agents/admins see the staff queue.
const list = asyncHandler(async (req, res) => {
  const isStaff = req.user.role === ROLES.AGENT || req.user.role === ROLES.ADMIN;
  const { conversations, meta } = isStaff
    ? await conversationService.listForStaff(req.user, req.query)
    : await conversationService.listForCustomer(req.user, req.query);
  return sendSuccess(res, { message: "Conversations", data: { conversations }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const conversation = await conversationService.getDetail(req.params.id, req.user);
  return sendSuccess(res, { message: "Conversation", data: { conversation } });
});

// Customer-only: opens a new thread with its first message.
const start = asyncHandler(async (req, res) => {
  const conversation = await conversationService.startConversation(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Conversation started", data: { conversation } });
});

const addMessage = asyncHandler(async (req, res) => {
  const conversation = await conversationService.addMessage(req.params.id, req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Message sent", data: { conversation } });
});

// Customer-only: asks for a human. Turns the AI off and queues it for staff.
const requestHandoff = asyncHandler(async (req, res) => {
  const conversation = await conversationService.requestHandoff(req.params.id, req.user);
  return sendSuccess(res, { message: "Connecting you with a human agent", data: { conversation } });
});

// Staff-only: claims a conversation out of the queue.
const takeOver = asyncHandler(async (req, res) => {
  const conversation = await conversationService.takeOver(req.params.id, req.user);
  return sendSuccess(res, { message: "Conversation taken over", data: { conversation } });
});

const updateStatus = asyncHandler(async (req, res) => {
  const conversation = await conversationService.updateStatus(req.params.id, req.user, req.body);
  return sendSuccess(res, { message: "Status updated", data: { conversation } });
});

module.exports = { list, getOne, start, addMessage, requestHandoff, takeOver, updateStatus };
