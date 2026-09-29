"use strict";
const { sequelize, Conversation, Message, Customer, Agent, AiLog, Ticket } = require("../models");
const { ROLES, CONVERSATION_STATUS, SENDER_TYPE, MESSAGE_TYPE } = require("../config/constants");
const ApiError = require("../utils/ApiError");
const aiClient = require("./aiClient");
const logger = require("../utils/logger");
const { getIO, conversationRoom } = require("../socket");

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
    handoffReason: conversation.handoffReason, // <-- add this line
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
      customerId: c.customerId,
      customerName: c.customer?.user ? `${c.customer.user.firstName} ${c.customer.user.lastName}` : null,
    })),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getDetail(id, user) {
  const conversation = await loadConversation(id, user, { withMessages: true });
  return conversation;
}

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

    const aiMessage = await Message.create({
      conversationId: conversation.id,
      senderType: SENDER_TYPE.AI,
      content: result.reply,
      messageType: MESSAGE_TYPE.TEXT,
      metadata: {
        provider: result.provider,
        model: result.model,
        sources: result.sources || [],
        intent: result.intent,
        toolUsed: result.tool_used || null,
        sentiment: result.sentiment || null,
      },
    });

    getIO().to(conversationRoom(conversation.id)).emit("message:new", aiMessage.toJSON());

    await AiLog.create({
      conversationId: conversation.id,
      provider: result.provider,
      model: result.model,
      intent: result.intent,
      toolUsed: result.tool_used || null,
      sentiment: result.sentiment || null,
      handoffReason: result.handoff_reason || null,
      latencyMs: result.latency_ms,
      retrievedChunks: (result.sources || []).length,
      success: true,
    });

    if (result.handoff_required) {
      await transitionToHuman(conversation, result.handoff_reason || null);
    }
  } catch (err) {
    const fallbackMessage = await Message.create({
      conversationId: conversation.id,
      senderType: SENDER_TYPE.SYSTEM,
      content: FALLBACK_REPLY,
      messageType: MESSAGE_TYPE.TEXT,
    });
    getIO().to(conversationRoom(conversation.id)).emit("message:new", fallbackMessage.toJSON());
    await AiLog.create({ conversationId: conversation.id, success: false, error: err.message });
  }

  conversation.lastMessageAt = new Date();
  await conversation.save();
}

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

  const message = await Message.create({ conversationId: conversation.id, senderId: user.id, senderType, content });
  getIO().to(conversationRoom(conversation.id)).emit("message:new", message.toJSON());

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

const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? 0;
}

const HANDOFF_REASONS = {
  explicit_request: {
    message: "You've been moved to the human support queue. An agent will join shortly.",
    priority: "MEDIUM",
    category: "general",
  },
  no_confident_answer: {
    message:
      "I wasn't able to find a confident answer to your question, so I've looped in a human agent who can help further.",
    priority: "MEDIUM",
    category: "general",
  },
  sensitive_refund: {
    message:
      "This may involve an incorrect or duplicate charge, so I've flagged it as urgent and looped in a human agent right away.",
    priority: "URGENT",
    category: "billing",
  },
  customer_frustration: {
    message: "I can see this hasn't gone smoothly, so I've brought in a human agent to help sort it out.",
    priority: "HIGH",
    category: "general",
  },
  tool_failure: {
    message: "I ran into a system issue trying to look that up, so I've brought in a human agent to help directly.",
    priority: "HIGH",
    category: "technical",
  },
};
const DEFAULT_HANDOFF = HANDOFF_REASONS.explicit_request;

async function transitionToHuman(conversation, reason = null) {
  if (conversation.status === CONVERSATION_STATUS.WAITING_AGENT || conversation.status === CONVERSATION_STATUS.WITH_AGENT) {
    return;
  }

  const { message: handoffMessage, priority, category } = HANDOFF_REASONS[reason] || DEFAULT_HANDOFF;

  conversation.status = CONVERSATION_STATUS.WAITING_AGENT;
  conversation.aiEnabled = false;
  conversation.handoffReason = reason;
  await conversation.save();

  const systemMessage = await Message.create({
    conversationId: conversation.id,
    senderType: SENDER_TYPE.SYSTEM,
    content: handoffMessage,
    messageType: MESSAGE_TYPE.HANDOFF,
    metadata: reason ? { handoffReason: reason } : null,
  });
  getIO().to(conversationRoom(conversation.id)).emit("message:new", systemMessage.toJSON());

  // Tell every agent watching the queue that a new conversation just landed,
  // so it appears in their list without a manual reload.
  getIO().to("staff").emit("queue:new", {
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt,
  });

  const existingTicket = await Ticket.findOne({ where: { conversationId: conversation.id } });
  if (!existingTicket) {
    const recent = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [["createdAt", "ASC"]],
      limit: 20,
    });
    const firstCustomerMessage = recent.find((m) => m.senderType === SENDER_TYPE.CUSTOMER);
    await Ticket.create({
      customerId: conversation.customerId,
      conversationId: conversation.id,
      subject: conversation.subject || "Support request",
      description: firstCustomerMessage?.content || "Customer requested a human agent.",
      category,
      priority,
      createdByAi: reason !== null,
    });
  } else if (HANDOFF_REASONS[reason] && priorityRank(priority) > priorityRank(existingTicket.priority)) {
    existingTicket.priority = priority;
    await existingTicket.save();
  }
}

async function requestHandoff(id, user) {
  const conversation = await loadConversation(id, user, { withMessages: true });
  await transitionToHuman(conversation);
  return loadConversation(conversation.id, user, { withMessages: true });
}

async function takeOver(id, user) {
  const agentProfile = user.role === ROLES.AGENT ? await getAgentProfile(user) : null;
  const conversation = await Conversation.findByPk(id);
  if (!conversation) throw ApiError.notFound("Conversation not found");

  conversation.assignedAgentId = agentProfile?.id ?? conversation.assignedAgentId;
  conversation.aiEnabled = false;
  conversation.status = CONVERSATION_STATUS.WITH_AGENT;
  await conversation.save();

  const joinMessage = await Message.create({
    conversationId: conversation.id,
    senderType: SENDER_TYPE.SYSTEM,
    content: `${user.firstName} has joined the conversation.`,
  });
  getIO().to(conversationRoom(conversation.id)).emit("message:new", joinMessage.toJSON());

  // Removes it from every other agent's "Waiting" list immediately.
  getIO().to("staff").emit("queue:claimed", { id: conversation.id });

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

  getIO().to(conversationRoom(conversation.id)).emit("conversation:update", { id: conversation.id, status });

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