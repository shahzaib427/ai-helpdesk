"use strict";
const { Op, fn, col, literal } = require("sequelize");
const { Customer, Conversation, Ticket, AiLog } = require("../models");
const { TICKET_STATUS, CONVERSATION_STATUS } = require("../config/constants");

const OPEN_TICKET_STATUSES = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.WAITING_CUSTOMER,
];
const RESOLVED_TICKET_STATUSES = [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED];

// A conversation "required a human" if it's currently waiting for one, is
// with one now, or ever had one assigned — assignedAgentId is set once by
// takeOver and never cleared afterward, so it stays a reliable permanent
// record even after the conversation is resolved. Everything else counts
// as the AI having handled it alone.
const REQUIRED_HUMAN_WHERE = {
  [Op.or]: [{ status: CONVERSATION_STATUS.WAITING_AGENT }, { assignedAgentId: { [Op.ne]: null } }],
};

async function getOverview() {
  const [totalCustomers, totalConversations, openTickets, resolvedTickets, humanHandoffs, avgLatency] =
    await Promise.all([
      Customer.count(),
      Conversation.count(),
      Ticket.count({ where: { status: { [Op.in]: OPEN_TICKET_STATUSES } } }),
      Ticket.count({ where: { status: { [Op.in]: RESOLVED_TICKET_STATUSES } } }),
      Conversation.count({ where: REQUIRED_HUMAN_WHERE }),
      AiLog.findOne({
        attributes: [[fn("AVG", col("latency_ms")), "avg"]],
        where: { success: true, latencyMs: { [Op.ne]: null } },
        raw: true,
      }),
    ]);

  const aiResolutions = totalConversations - humanHandoffs;
  const aiResolutionRate = totalConversations > 0 ? aiResolutions / totalConversations : 0;

  return {
    totalCustomers,
    totalConversations,
    openTickets,
    resolvedTickets,
    aiResolutions,
    humanHandoffs,
    avgResponseTimeMs: avgLatency?.avg ? Math.round(Number(avgLatency.avg)) : null,
    aiResolutionRate: Math.round(aiResolutionRate * 1000) / 1000,
  };
}

async function getConversationsOverTime(days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Conversation.findAll({
    attributes: [
      [fn("DATE", col("created_at")), "date"],
      [fn("COUNT", col("id")), "count"],
    ],
    where: { createdAt: { [Op.gte]: since } },
    group: [literal("DATE(created_at)")],
    order: [[literal("DATE(created_at)"), "ASC"]],
    raw: true,
  });
  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

async function getTicketsByCategory() {
  const rows = await Ticket.findAll({
    attributes: ["category", [fn("COUNT", col("id")), "count"]],
    group: ["category"],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });
  return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
}

async function getTopIntents(limit = 8) {
  const rows = await AiLog.findAll({
    attributes: ["intent", [fn("COUNT", col("id")), "count"]],
    where: { intent: { [Op.ne]: null } },
    group: ["intent"],
    order: [[literal("count"), "DESC"]],
    limit,
    raw: true,
  });
  return rows.map((r) => ({ intent: r.intent, count: Number(r.count) }));
}

async function getSentimentDistribution() {
  const rows = await AiLog.findAll({
    attributes: ["sentiment", [fn("COUNT", col("id")), "count"]],
    where: { sentiment: { [Op.ne]: null } },
    group: ["sentiment"],
    raw: true,
  });
  return rows.map((r) => ({ sentiment: r.sentiment, count: Number(r.count) }));
}

async function getToolUsage() {
  const rows = await AiLog.findAll({
    attributes: ["toolUsed", [fn("COUNT", col("id")), "count"]],
    where: { toolUsed: { [Op.ne]: null } },
    group: ["toolUsed"],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });
  return rows.map((r) => ({ tool: r.toolUsed, count: Number(r.count) }));
}

async function getHandoffReasons() {
  const rows = await AiLog.findAll({
    attributes: ["handoffReason", [fn("COUNT", col("id")), "count"]],
    where: { handoffReason: { [Op.ne]: null } },
    group: ["handoffReason"],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });
  return rows.map((r) => ({ reason: r.handoffReason, count: Number(r.count) }));
}

async function getCharts() {
  const [
    conversationsOverTime,
    ticketsByCategory,
    topIntents,
    sentimentDistribution,
    toolUsage,
    handoffReasons,
    overview,
  ] = await Promise.all([
    getConversationsOverTime(),
    getTicketsByCategory(),
    getTopIntents(),
    getSentimentDistribution(),
    getToolUsage(),
    getHandoffReasons(),
    getOverview(),
  ]);

  return {
    conversationsOverTime,
    ticketsByCategory,
    resolutionBreakdown: { ai: overview.aiResolutions, human: overview.humanHandoffs },
    topIntents,
    sentimentDistribution,
    toolUsage,
    handoffReasons,
  };
}

module.exports = { getOverview, getCharts };
