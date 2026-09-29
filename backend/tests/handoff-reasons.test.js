"use strict";
process.env.NODE_ENV = "test";

// aiClient is mocked here (not left absent, unlike conversations.test.js)
// because these tests need to control exactly which handoff_reason comes
// back from the AI, to verify each reason maps to the right ticket
// priority and category.
jest.mock("../src/services/aiClient");

const request = require("supertest");
const { sequelize, User, Ticket, Conversation } = require("../src/models");
const aiClient = require("../src/services/aiClient");

let app;
let token;

async function registerAndLogin(email) {
  await request(app)
    .post("/api/auth/register")
    .send({ email, password: "Password123", firstName: "Kai", lastName: "Customer" });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
  return res.body.data.token;
}

beforeAll(async () => {
  app = require("../src/app");
  await sequelize.sync({ force: true });
  token = await registerAndLogin("p7.customer@example.com");
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await sequelize.close();
});

async function startConversationWithReason(handoffReason, extraFields = {}) {
  aiClient.requestReply.mockResolvedValue({
    reply: "A reply.",
    provider: "echo",
    model: "echo-1",
    latency_ms: 5,
    intent: "knowledge_question",
    used_rag: false,
    sources: [],
    tool_used: null,
    handoff_required: true,
    handoff_reason: handoffReason,
    ...extraFields,
  });

  const res = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({ message: "Some message that triggers a handoff" });

  return res.body.data.conversation;
}

describe("Reason-based handoff priority mapping", () => {
  it("sensitive_refund creates an URGENT, billing-category ticket", async () => {
    const conversation = await startConversationWithReason("sensitive_refund");
    expect(conversation.status).toBe("WAITING_AGENT");

    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("URGENT");
    expect(ticket.category).toBe("billing");
    expect(ticket.createdByAi).toBe(true);
  });

  it("customer_frustration creates a HIGH priority ticket", async () => {
    const conversation = await startConversationWithReason("customer_frustration");
    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("HIGH");
  });

  it("tool_failure creates a HIGH priority, technical-category ticket", async () => {
    const conversation = await startConversationWithReason("tool_failure");
    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("HIGH");
    expect(ticket.category).toBe("technical");
  });

  it("no_confident_answer creates a MEDIUM priority ticket", async () => {
    const conversation = await startConversationWithReason("no_confident_answer");
    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("MEDIUM");
  });

  it("explicit_request (from AI-detected text, not the button) creates a MEDIUM ticket", async () => {
    const conversation = await startConversationWithReason("explicit_request");
    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("MEDIUM");
  });

  it("an unrecognised reason falls back to the default (explicit_request) mapping", async () => {
    const conversation = await startConversationWithReason("some_future_reason_not_yet_mapped");
    const ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("MEDIUM");
  });

  it("the SYSTEM message explains why, not just that a handoff happened", async () => {
    const conversation = await startConversationWithReason("sensitive_refund");
    const full = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${token}`);
    const systemMessages = full.body.data.conversation.messages.filter((m) => m.senderType === "SYSTEM");
    const handoffMessage = systemMessages.find((m) => m.content.toLowerCase().includes("duplicate"));
    expect(handoffMessage).toBeDefined();
  });

  it("a second, more urgent reason raises an already-open ticket's priority instead of leaving it stuck", async () => {
    const conversation = await startConversationWithReason("no_confident_answer");
    let ticket = await Ticket.findOne({ where: { conversationId: conversation.id } });
    expect(ticket.priority).toBe("MEDIUM");

    // Conversation is already WAITING_AGENT, so a second message with a
    // higher-urgency reason should not create a second ticket, just raise
    // the existing one's priority.
    aiClient.requestReply.mockResolvedValue({
      reply: "Another reply.",
      provider: "echo",
      model: "echo-1",
      latency_ms: 5,
      intent: "refund_request",
      used_rag: false,
      sources: [],
      tool_used: null,
      handoff_required: true,
      handoff_reason: "sensitive_refund",
    });
    await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "also I was charged twice" });

    const tickets = await Ticket.findAll({ where: { conversationId: conversation.id } });
    expect(tickets.length).toBe(1); // still just one ticket
    ticket = tickets[0];
    expect(ticket.priority).toBe("URGENT"); // raised, not left at MEDIUM
  });

  it("no handoff_required leaves the conversation ACTIVE with no ticket", async () => {
    aiClient.requestReply.mockResolvedValue({
      reply: "Sure, here's the answer.",
      provider: "echo",
      model: "echo-1",
      latency_ms: 5,
      intent: "general_conversation",
      used_rag: false,
      sources: [],
      tool_used: null,
      handoff_required: false,
      handoff_reason: null,
    });

    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "just saying hi" });

    expect(res.body.data.conversation.status).toBe("ACTIVE");
    const ticket = await Ticket.findOne({ where: { conversationId: res.body.data.conversation.id } });
    expect(ticket).toBeNull();
  });
});
