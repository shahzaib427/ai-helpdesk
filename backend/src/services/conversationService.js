"use strict";
const { sequelize, Conversation, Message, Customer, Agent, AiLog, Ticket } = require("../models");
const { ROLES, CONVERSATION_STATUS, SENDER_TYPE, MESSAGE_TYPE } = require("../config/constants");
const ApiError = require("../utils/ApiError");
const aiClient = require("./aiClient");
const logger = require("../utils/logger");

const FALLBACK_REPLY =
  "AI support is temporarily unavailable. Your message has been saved and a support ticket can be created.";

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

// Loads a conversation and checks the requester is allowed to see it.
// Customers only see their own; agents and admins see any (an agent needs to
// see an unassigned conversation in order to take it over).
async function loadConversation(id, user, { withMessages = false } = {}) {
  const conversation = await Conversation.findByPk(id, {
    include: withMessages ? [{ model: Message, as: "messages", order: [["createdAt", "ASC"]] }] : [],
  });
  if (!conversation) throw ApiError.notFound("Conversation not found");

  if (user.role === ROLES.CUSTOMER) {
    const profile = await getCustomerProfile(user);
    if (conversation.customerId !== profile.id) throw ApiError.forbidden();
  }

  if (withMessages && conversation.messages) {
    conversation.messages.sort((a, b) => a.createdAt - b.createdAt);
  }

  return conversation;
}

function toSummary(conversation) {
  return {
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    aiEnabled: conversation.aiEnabled,
    assignedAgentId: conversation.assignedAgentId,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
  };
}

async function listForCustomer(user, { page = 1, limit = 20 }) {
  const profile = await getCustomerProfile(user);
  const { rows, count } = await Conversation.findAndCountAll({
    where: { customerId: profile.id },
    order: [["lastMessageAt", "DESC"], ["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
  return {
    conversations: rows.map(toSummary),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

// Agents see conversations waiting for a human plus their own assigned ones
// unless `mine=true`, which narrows to just their own. Admins see everything.
async function listForStaff(user, { page = 1, limit = 20, status, mine }) {
  const where = {};
  if (status) where.status = status;

  if (user.role === ROLES.AGENT) {
    const profile = await getAgentProfile(user);
    where[require("sequelize").Op.or] = mine
      ? [{ assignedAgentId: profile.id }]
      : [{ assignedAgentId: profile.id }, { status: CONVERSATION_STATUS.WAITING_AGENT }];
  }

  const { rows, count } = await Conversation.findAndCountAll({
    where,
    include: [{ model: Customer, as: "customer", include: ["user"] }],
    order: [["lastMessageAt", "DESC"], ["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    conversations: rows.map((c) => ({
      ...toSummary(c),
      customerName: c.customer?.user ? `${c.customer.user.firstName} ${c.customer.user.lastName}` : null,
    })),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getDetail(id, user) {
  const conversation = await loadConversation(id, user, { withMessages: true });
  return conversation;
}

// Fire-and-record: ask the AI service for a reply, save it, log the attempt.
// Any failure becomes a SYSTEM fallback message rather than a broken chat.
async function requestAiReply(conversation, recentMessages) {
  const history = recentMessages
    .filter((m) => m.senderType === SENDER_TYPE.CUSTOMER || m.senderType === SENDER_TYPE.AI)
    .slice(-10)
    .map((m) => ({ role: m.senderType === SENDER_TYPE.CUSTOMER ? "user" : "assistant", content: m.content }));

  const lastCustomerMessage = history.filter((h) => h.role === "user").slice(-1)[0];

  try {
    const result = await aiClient.requestReply({
      message: lastCustomerMessage?.content || "",
      conversationId: conversation.id,
      customerId: conversation.customerId,
      history: history.slice(0, -1),
    });

    await Message.create({
      conversationId: conversation.id,
      senderType: SENDER_TYPE.AI,
      content: result.reply,
      messageType: MESSAGE_TYPE.TEXT,
      metadata: { provider: result.provider, model: result.model, sources: result.sources || [] },
    });

    await AiLog.create({
      conversationId: conversation.id,
      provider: result.provider,
      model: result.model,
      intent: result.intent,
      latencyMs: result.latency_ms,
      retrievedChunks: (result.sources || []).length,
      success: true,
    });
  } catch (err) {
    await Message.create({
      conversationId: conversation.id,
      senderType: SENDER_TYPE.SYSTEM,
      content: FALLBACK_REPLY,
      messageType: MESSAGE_TYPE.TEXT,
    });
    await AiLog.create({ conversationId: conversation.id, success: false, error: err.message });
  }

  conversation.lastMessageAt = new Date();
  await conversation.save();
}

// Creates the conversation and its opening message in one transaction, then
// (outside the transaction, so a slow AI call doesn't hold a DB lock) asks
// the AI for the first reply.
async function startConversation(user, { subject, message }) {
  const profile = await getCustomerProfile(user);

  const conversation = await sequelize.transaction(async (tx) => {
    const created = await Conversation.create(
      { customerId: profile.id, subject: subject || message.slice(0, 70), lastMessageAt: new Date() },
      { transaction: tx }
    );
    await Message.create(
      { conversationId: created.id, senderId: user.id, senderType: SENDER_TYPE.CUSTOMER, content: message },
      { transaction: tx }
    );
    return created;
  });

  await requestAiReply(conversation, [{ senderType: SENDER_TYPE.CUSTOMER, content: message }]);
  return loadConversation(conversation.id, user, { withMessages: true });
}

// Adds a message to an existing thread. A customer message triggers an AI
// reply only while the AI is still handling the conversation; once an agent
// has taken it over, customer messages just wait for that agent.
async function addMessage(id, user, { content }) {
  const conversation = await loadConversation(id, user);

  if ([CONVERSATION_STATUS.RESOLVED, CONVERSATION_STATUS.CLOSED].includes(conversation.status)) {
    throw ApiError.badRequest("This conversation is closed. Start a new one to keep chatting.");
  }

  let senderType;
  if (user.role === ROLES.CUSTOMER) {
    senderType = SENDER_TYPE.CUSTOMER;
  } else {
    senderType = SENDER_TYPE.AGENT;
    if (conversation.status !== CONVERSATION_STATUS.WITH_AGENT) {
      throw ApiError.badRequest("Take this conversation over before replying to the customer");
    }
  }

  await Message.create({ conversationId: conversation.id, senderId: user.id, senderType, content });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  if (senderType === SENDER_TYPE.CUSTOMER && conversation.aiEnabled) {
    const recent = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });
    await requestAiReply(conversation, recent.reverse());
  }

  return loadConversation(conversation.id, user, { withMessages: true });
}

// The customer asks to speak to a person. Turns the AI off for this thread,
// puts it in the queue agents watch, and opens a ticket if one doesn't
// already exist for this conversation, so the request shows up in both
// places an agent might look.
async function requestHandoff(id, user) {
  const conversation = await loadConversation(id, user, { withMessages: true });
  conversation.status = CONVERSATION_STATUS.WAITING_AGENT;
  conversation.aiEnabled = false;
  await conversation.save();

  await Message.create({
    conversationId: conversation.id,
    senderType: SENDER_TYPE.SYSTEM,
    content: "You've been moved to the human support queue. An agent will join shortly.",
    messageType: MESSAGE_TYPE.HANDOFF,
  });

  const existingTicket = await Ticket.findOne({ where: { conversationId: conversation.id } });
  if (!existingTicket) {
    const firstCustomerMessage = conversation.messages?.find((m) => m.senderType === SENDER_TYPE.CUSTOMER);
    await Ticket.create({
      customerId: conversation.customerId,
      conversationId: conversation.id,
      subject: conversation.subject || "Support request",
      description: firstCustomerMessage?.content || "Customer requested a human agent.",
      category: "general",
      createdByAi: false,
    });
  }

  return loadConversation(conversation.id, user, { withMessages: true });
}

// An agent (or admin, acting as one) claims a conversation.
async function takeOver(id, user) {
  const agentProfile = user.role === ROLES.AGENT ? await getAgentProfile(user) : null;
  const conversation = await Conversation.findByPk(id);
  if (!conversation) throw ApiError.notFound("Conversation not found");

  conversation.assignedAgentId = agentProfile?.id ?? conversation.assignedAgentId;
  conversation.aiEnabled = false;
  conversation.status = CONVERSATION_STATUS.WITH_AGENT;
  await conversation.save();

  await Message.create({
    conversationId: conversation.id,
    senderType: SENDER_TYPE.SYSTEM,
    content: `${user.firstName} has joined the conversation.`,
  });

  return loadConversation(conversation.id, user, { withMessages: true });
}

async function updateStatus(id, user, { status }) {
  const conversation = await Conversation.findByPk(id);
  if (!conversation) throw ApiError.notFound("Conversation not found");

  conversation.status = status;
  if (status === CONVERSATION_STATUS.RESOLVED || status === CONVERSATION_STATUS.CLOSED) {
    conversation.aiEnabled = false;
  }
  await conversation.save();
  return loadConversation(conversation.id, user, { withMessages: true });
}

module.exports = {
  listForCustomer,
  listForStaff,
  getDetail,
  startConversation,
  addMessage,
  requestHandoff,
  takeOver,
  updateStatus,
};
