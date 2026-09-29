"use strict";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Customer, Product, Order, Conversation, Agent, AiLog } = require("../src/models");
const { ROLES, ORDER_STATUS, CONVERSATION_STATUS } = require("../src/config/constants");

let adminToken;
let customerToken;

async function createStaff(email, role) {
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("Password123", 10);
  await User.create({ email, passwordHash, firstName: "S", lastName: role, role });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
  return res.body.data.token;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  adminToken = await createStaff("p8.admin@example.com", ROLES.ADMIN);

  await request(app)
    .post("/api/auth/register")
    .send({ email: "p8.customer@example.com", password: "Password123", firstName: "P", lastName: "Eight" });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "p8.customer@example.com", password: "Password123" });
  customerToken = login.body.data.token;

  const customer = await Customer.findOne({ where: { userId: (await User.findOne({ where: { email: "p8.customer@example.com" } })).id } });

  // Two conversations: one AI-only, one that reached a human.
  await Conversation.create({ customerId: customer.id, status: CONVERSATION_STATUS.ACTIVE });
  const agentUser = await User.create({
    email: "p8.agent@example.com",
    passwordHash: await require("bcryptjs").hash("Password123", 10),
    firstName: "A",
    lastName: "Gent",
    role: ROLES.AGENT,
  });
  const agent = await Agent.create({ userId: agentUser.id, department: "General" });
  await Conversation.create({
    customerId: customer.id,
    status: CONVERSATION_STATUS.WITH_AGENT,
    assignedAgentId: agent.id,
  });

  await Product.create({ sku: "P8-SKU", name: "Analytics Widget", price: 5, stock: 1 });

  await AiLog.create({
    intent: "order_status",
    toolUsed: "get_order_status",
    sentiment: "NEUTRAL",
    latencyMs: 100,
    success: true,
  });
  await AiLog.create({
    intent: "refund_request",
    toolUsed: "get_refund_status",
    sentiment: "NEGATIVE",
    handoffReason: "sensitive_refund",
    latencyMs: 200,
    success: true,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Analytics access control", () => {
  it("blocks a customer with 403", async () => {
    const res = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/analytics/overview");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/analytics/overview", () => {
  it("returns real aggregated counts", async () => {
    const res = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.totalConversations).toBe(2);
    expect(data.humanHandoffs).toBe(1); // the WITH_AGENT one
    expect(data.aiResolutions).toBe(1); // the ACTIVE one
    expect(data.avgResponseTimeMs).toBe(150); // (100+200)/2
  });
});

describe("GET /api/analytics/charts", () => {
  it("returns all chart datasets with real data", async () => {
    const res = await request(app).get("/api/analytics/charts").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { data } = res.body;

    expect(data.topIntents.find((i) => i.intent === "order_status").count).toBe(1);
    expect(data.sentimentDistribution.find((s) => s.sentiment === "NEGATIVE").count).toBe(1);
    expect(data.toolUsage.find((t) => t.tool === "get_refund_status").count).toBe(1);
    expect(data.handoffReasons.find((h) => h.reason === "sensitive_refund").count).toBe(1);
    expect(data.resolutionBreakdown).toEqual({ ai: 1, human: 1 });
  });
});
