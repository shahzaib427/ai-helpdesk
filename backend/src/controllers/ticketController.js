"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { ROLES } = require("../config/constants");
const ticketService = require("../services/ticketService");

const list = asyncHandler(async (req, res) => {
  const isStaff = req.user.role === ROLES.AGENT || req.user.role === ROLES.ADMIN;
  const query = { ...req.query, mine: req.query.mine === "true" }; // <-- fix here
  const { tickets, meta } = isStaff
    ? await ticketService.listForStaff(req.user, query)
    : await ticketService.listForCustomer(req.user, query);
  return sendSuccess(res, { message: "Tickets", data: { tickets }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const isStaff = req.user.role === ROLES.AGENT || req.user.role === ROLES.ADMIN;
  const ticket = isStaff
    ? await ticketService.getForStaff(req.params.id, req.user)
    : await ticketService.getForCustomer(req.params.id, req.user);
  return sendSuccess(res, { message: "Ticket", data: { ticket } });
});

const create = asyncHandler(async (req, res) => {
  const ticket = await ticketService.create(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Ticket created", data: { ticket } });
});

const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await ticketService.updateStatus(req.params.id, req.user, req.body);
  return sendSuccess(res, { message: "Status updated", data: { ticket } });
});

const updatePriority = asyncHandler(async (req, res) => {
  const ticket = await ticketService.updatePriority(req.params.id, req.user, req.body);
  return sendSuccess(res, { message: "Priority updated", data: { ticket } });
});

const assign = asyncHandler(async (req, res) => {
  const ticket = await ticketService.assign(req.params.id, req.user, req.body);
  return sendSuccess(res, { message: "Ticket reassigned", data: { ticket } });
});

const addNote = asyncHandler(async (req, res) => {
  const ticket = await ticketService.addInternalNote(req.params.id, req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: "Note added", data: { ticket } });
});

module.exports = { list, getOne, create, updateStatus, updatePriority, assign, addNote };
