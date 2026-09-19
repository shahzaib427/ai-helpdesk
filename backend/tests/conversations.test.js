"use strict";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Agent } = require("../src/models");
const { ROLES } = require("../src/config/constants");

const customerA = {
  email: "conv.customerA@example.com",
  password: "Password123",
  firstName: "Amy",
  lastName: "Customer",
};
const customerB = {
  email: "conv.customerB@example.com",
  password: "Password123",
  firstName: "Ben",
  lastName: "Customer",
};

let tokenA;
let tokenB;
let agentToken;
let conversationId;

async function registerAndLogin(payload) {
  await request(app).post("/api/auth/register").send(payload);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });
  return res.body.data.token;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  tokenA = await registerAndLogin(customerA);
  tokenB = await registerAndLogin(customerB);

  // Agent accounts are created by an admin in the real flow (see users.test),
  // so here we insert one directly rather than routing through registration,
  // which always produces a CUSTOMER.
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("Password123", 10);
  const agentUser = await User.create({
    email: "conv.agent@example.com",
    passwordHash,
    firstName: "Grace",
    lastName: "Agent",
    role: ROLES.AGENT,
  });
  await Agent.create({ userId: agentUser.id, department: "General Support" });

  const agentLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "conv.agent@example.com", password: "Password123" });
  agentToken = agentLogin.body.data.token;
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /api/conversations", () => {
  it("starts a conversation with an opening message and a fallback AI reply", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "What is your return policy?" });

    expect(res.status).toBe(201);
    const { conversation } = res.body.data;
    expect(conversation.messages.length).toBeGreaterThanOrEqual(2);
    expect(conversation.messages[0].senderType).toBe("CUSTOMER");
    // No AI service is running in the test environment, so the second
    // message must be the honest fallback rather than a silent failure.
    expect(["AI", "SYSTEM"]).toContain(conversation.messages[1].senderType);

    conversationId = conversation.id;
  });

  it("rejects an empty message with 422", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "" });
    expect(res.status).toBe(422);
  });

  it("rejects an agent starting a conversation with 403", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ message: "hello" });
    expect(res.status).toBe(403);
  });
});

describe("Conversation access control", () => {
  it("lets the owning customer read their conversation", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversation.id).toBe(conversationId);
  });

  it("blocks a different customer from reading it with 403", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("lets staff read any conversation", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
  });

  it("lists only the customer's own conversations under GET /api/conversations", async () => {
    const res = await request(app)
      .get("/api/conversations")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversations.every((c) => c.id !== conversationId)).toBe(true);
  });
});

describe("Messaging and handoff", () => {
  it("lets the customer send a follow-up message", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ content: "Any update?" });
    expect(res.status).toBe(201);
  });

  it("blocks an agent from replying before taking the conversation over", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ content: "Hi, this is Grace" });
    expect(res.status).toBe(400);
  });

  it("moves the conversation to the human queue on handoff", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/handoff`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversation.status).toBe("WAITING_AGENT");
    expect(res.body.data.conversation.aiEnabled).toBe(false);
  });

  it("lets an agent take the conversation over", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/take-over`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversation.status).toBe("WITH_AGENT");
  });

  it("now lets the agent reply", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ content: "Hi, this is Grace, how can I help?" });
    expect(res.status).toBe(201);
  });

  it("lets the agent close the conversation", async () => {
    const res = await request(app)
      .patch(`/api/conversations/${conversationId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.conversation.status).toBe("RESOLVED");
  });

  it("refuses a new message on a resolved conversation with 400", async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ content: "Still there?" });
    expect(res.status).toBe(400);
  });
});
