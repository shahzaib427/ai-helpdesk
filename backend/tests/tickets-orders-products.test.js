"use strict";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Customer, Agent } = require("../src/models");
const { ROLES } = require("../src/config/constants");

let adminToken;
let customerToken;
let agentToken;
let productId;
let ticketId;

async function registerAndLogin(payload) {
  await request(app).post("/api/auth/register").send(payload);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });
  return res.body.data.token;
}

async function createStaff(email, role, extra = {}) {
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("Password123", 10);
  const user = await User.create({
    email,
    passwordHash,
    firstName: "Staff",
    lastName: role,
    role,
  });
  if (role === ROLES.AGENT) await Agent.create({ userId: user.id, department: "General Support" });

  const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
  return res.body.data.token;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  customerToken = await registerAndLogin({
    email: "p3.customer@example.com",
    password: "Password123",
    firstName: "Priya",
    lastName: "Shopper",
  });
  adminToken = await createStaff("p3.admin@example.com", ROLES.ADMIN);
  agentToken = await createStaff("p3.agent@example.com", ROLES.AGENT);
});

afterAll(async () => {
  await sequelize.close();
});

describe("Products", () => {
  it("blocks a customer from creating a product with 403", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ sku: "SKU-X1", name: "Test Widget", price: 19.99 });
    expect(res.status).toBe(403);
  });

  it("lets an admin create a product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-X1", name: "Test Widget", price: 19.99, stock: 10 });
    expect(res.status).toBe(201);
    productId = res.body.data.product.id;
  });

  it("rejects a duplicate SKU with 409", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-X1", name: "Duplicate", price: 5 });
    expect(res.status).toBe(409);
  });

  it("lets any signed-in role browse the catalog", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products.some((p) => p.id === productId)).toBe(true);
  });

  it("lets an admin retire a product, and it drops out of the default list", async () => {
    const retire = await request(app)
      .delete(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(retire.status).toBe(200);
    expect(retire.body.data.product.isActive).toBe(false);

    const list = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(list.body.data.products.some((p) => p.id === productId)).toBe(false);
  });
});

describe("Orders", () => {
  it("blocks a customer from creating an order with 403", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ customerId: 1, items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it("a customer only ever sees their own orders", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
  });
});

describe("Tickets", () => {
  it("lets a customer create a ticket", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Missing item in order", description: "One item was missing from my delivery." });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.status).toBe("OPEN");
    expect(res.body.data.ticket.internalNotes).toBeUndefined();
    ticketId = res.body.data.ticket.id;
  });

  it("rejects an empty description with 422", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "No description", description: "" });
    expect(res.status).toBe(422);
  });

  it("blocks an agent from creating a ticket with 403", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ subject: "x", description: "y" });
    expect(res.status).toBe(403);
  });

  it("blocks a customer from changing ticket status with 403", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(403);
  });

  it("lets an agent move the ticket to IN_PROGRESS", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.status).toBe("IN_PROGRESS");
  });

  it("lets an agent add an internal note", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ content: "Checked warehouse logs, item was short-shipped." });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.internalNotes.length).toBe(1);
  });

  it("never returns internal notes to the customer", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.internalNotes).toBeUndefined();
  });

  it("resolving the ticket stamps resolvedAt", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.resolvedAt).not.toBeNull();
  });
});

describe("Customer lookup", () => {
  it("blocks a customer from browsing the customer directory with 403", async () => {
    const res = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("lets an agent search customers and see recent tickets on the detail view", async () => {
    const list = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${agentToken}`)
      .query({ search: "p3.customer" });
    expect(list.status).toBe(200);
    expect(list.body.data.customers.length).toBeGreaterThan(0);

    const customerId = list.body.data.customers[0].id;
    const detail = await request(app)
      .get(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(detail.status).toBe(200);
    expect(Array.isArray(detail.body.data.customer.tickets)).toBe(true);
  });
});
