"use strict";
const { Op } = require("sequelize");
const { sequelize, Ticket, Customer, Agent, Conversation } = require("../models");
const { ROLES, TICKET_STATUS } = require("../config/constants");
const ApiError = require("../utils/ApiError");

async function getCustomerProfile(user) {
  const profile = await Customer.findOne({ where: { userId: user.id } });
  if (!profile) throw ApiError.forbidden("No customer profile for this account");
  return profile;
}

async function getAgentProfile(user) {
  const profile = await Agent.findOne({ where: { userId: user.id } });
  if (!profile) throw ApiError.forbidden("No agent profile for this account");
  return profile;
}

// internalNotes never reaches a customer response, regardless of how the
// record was loaded. Centralising this in one function is what makes that a
// guarantee rather than something every call site has to remember.
function forCustomer(ticket) {
  const { internalNotes, ...rest } = ticket.toJSON();
  return rest;
}

async function loadTicket(id, user) {
  const ticket = await Ticket.findByPk(id, {
    include: [{ model: Customer, as: "customer", include: ["user"] }],
  });
  if (!ticket) throw ApiError.notFound("Ticket not found");

  if (user.role === ROLES.CUSTOMER) {
    const profile = await getCustomerProfile(user);
    if (ticket.customerId !== profile.id) throw ApiError.forbidden();
  }

  return ticket;
}

function toSummary(ticket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdByAi: ticket.createdByAi,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    customerName: ticket.customer?.user
      ? `${ticket.customer.user.firstName} ${ticket.customer.user.lastName}`
      : undefined,
  };
}

async function listForCustomer(user, { page = 1, limit = 20, status }) {
  const profile = await getCustomerProfile(user);
  const where = { customerId: profile.id };
  if (status) where.status = status;

  const { rows, count } = await Ticket.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    tickets: rows.map(toSummary),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

// Agents see their own tickets plus the unassigned queue, unless `mine` narrows
// it. Admins see everything. Both can filter by status/priority/category.
async function listForStaff(user, { page = 1, limit = 20, status, priority, category, mine }) {
  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  if (user.role === ROLES.AGENT) {
    const profile = await getAgentProfile(user);
    if (mine) {
      where.assignedAgentId = profile.id;
    } else {
      where[Op.or] = [{ assignedAgentId: profile.id }, { assignedAgentId: null }];
    }
  }

  // Priority is an enum, so a plain alphabetical sort would not put URGENT
  // ahead of HIGH. This ranks by actual severity instead.
  const priorityRank = sequelize.literal(
    "CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END"
  );

  const { rows, count } = await Ticket.findAndCountAll({
    where,
    include: [{ model: Customer, as: "customer", include: ["user"] }],
    order: [[priorityRank, "ASC"], ["createdAt", "ASC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    tickets: rows.map(toSummary),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getForCustomer(id, user) {
  const ticket = await loadTicket(id, user);
  return forCustomer(ticket);
}

async function getForStaff(id, user) {
  return loadTicket(id, user);
}

async function create(user, { subject, description, category, priority, conversationId }) {
  const profile = await getCustomerProfile(user);

  if (conversationId) {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation || conversation.customerId !== profile.id) {
      throw ApiError.badRequest("That conversation does not belong to you");
    }
  }

  const ticket = await Ticket.create({
    customerId: profile.id,
    conversationId: conversationId || null,
    subject,
    description,
    category: category || "general",
    priority: priority || "MEDIUM",
  });

  return forCustomer(ticket);
}

async function updateStatus(id, user, { status }) {
  const ticket = await loadTicket(id, user);
  ticket.status = status;
  if ([TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED].includes(status) && !ticket.resolvedAt) {
    ticket.resolvedAt = new Date();
  }
  if (![TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED].includes(status)) {
    ticket.resolvedAt = null;
  }
  await ticket.save();
  return ticket;
}

async function updatePriority(id, user, { priority }) {
  const ticket = await loadTicket(id, user);
  ticket.priority = priority;
  await ticket.save();
  return ticket;
}

async function assign(id, user, { assignedAgentId }) {
  const ticket = await loadTicket(id, user);
  if (assignedAgentId !== null && assignedAgentId !== undefined) {
    const agent = await Agent.findByPk(assignedAgentId);
    if (!agent) throw ApiError.badRequest("Unknown agent");
  }
  ticket.assignedAgentId = assignedAgentId;
  await ticket.save();
  return ticket;
}

// A note only staff ever see. Kept as an append-only JSON array on the
// ticket itself rather than a separate table, since Phase 3 doesn't need
// per-note querying — just a chronological log attached to the ticket.
async function addInternalNote(id, user, { content }) {
  const ticket = await loadTicket(id, user);
  const notes = Array.isArray(ticket.internalNotes) ? ticket.internalNotes : [];
  notes.push({
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    content,
    createdAt: new Date().toISOString(),
  });
  ticket.internalNotes = notes;
  await ticket.save();
  return ticket;
}

module.exports = {
  listForCustomer,
  listForStaff,
  getForCustomer,
  getForStaff,
  create,
  updateStatus,
  updatePriority,
  assign,
  addInternalNote,
};
