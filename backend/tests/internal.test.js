"use strict";
process.env.NODE_ENV = "test";
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "test-internal-key";

const request = require("supertest");
const app = require("../src/app");
const { sequelize, User, Customer, Product, Order } = require("../src/models");
const { ROLES, ORDER_STATUS } = require("../src/config/constants");

const KEY = process.env.INTERNAL_API_KEY;
let customerAId;
let customerBId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("Password123", 10);

  const userA = await User.create({
    email: "internal.a@example.com",
    passwordHash,
    firstName: "A",
    lastName: "Customer",
    role: ROLES.CUSTOMER,
  });
  const customerA = await Customer.create({ userId: userA.id });
  customerAId = customerA.id;

  const userB = await User.create({
    email: "internal.b@example.com",
    passwordHash,
    firstName: "B",
    lastName: "Customer",
    role: ROLES.CUSTOMER,
  });
  const customerB = await Customer.create({ userId: userB.id });
  customerBId = customerB.id;

  const product = await Product.create({ sku: "SKU-INT-1", name: "Test Widget", price: 9.99, stock: 5 });
  await Order.create({
    orderNumber: "8001",
    customerId: customerAId,
    status: ORDER_STATUS.SHIPPED,
    totalAmount: 9.99,
  });
  void product;
});

afterAll(async () => {
  await sequelize.close();
});

describe("Internal API authentication", () => {
  it("rejects a request with no key", async () => {
    const res = await request(app).get("/api/internal/orders").query({ customerId: customerAId });
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong key", async () => {
    const res = await request(app)
      .get("/api/internal/orders")
      .set("X-Internal-Api-Key", "wrong-key")
      .query({ customerId: customerAId });
    expect(res.status).toBe(401);
  });

  it("a user JWT alone is not accepted here", async () => {
    // No requireAuth on this router at all — only the internal key counts.
    const res = await request(app).get("/api/internal/orders").query({ customerId: customerAId });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/internal/orders/by-number/:orderNumber", () => {
  it("returns the order when it belongs to the given customer", async () => {
    const res = await request(app)
      .get("/api/internal/orders/by-number/8001")
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerAId });
    expect(res.status).toBe(200);
    expect(res.body.data.order.orderNumber).toBe("8001");
  });

  it("returns 404 when the order belongs to a different customer", async () => {
    const res = await request(app)
      .get("/api/internal/orders/by-number/8001")
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerBId });
    expect(res.status).toBe(404);
  });

  it("returns 400 without a customerId", async () => {
    const res = await request(app).get("/api/internal/orders/by-number/8001").set("X-Internal-Api-Key", KEY);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/internal/orders", () => {
  it("lists only the given customer's orders", async () => {
    const res = await request(app)
      .get("/api/internal/orders")
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerAId });
    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBe(1);
  });

  it("returns an empty list for a customer with no orders", async () => {
    const res = await request(app)
      .get("/api/internal/orders")
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerBId });
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
  });
});

describe("GET /api/internal/products", () => {
  it("searches the catalog with no customer scoping needed", async () => {
    const res = await request(app)
      .get("/api/internal/products")
      .set("X-Internal-Api-Key", KEY)
      .query({ search: "Widget" });
    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });
});

describe("POST /api/internal/tickets", () => {
  it("creates a ticket on behalf of a customer", async () => {
    const res = await request(app).post("/api/internal/tickets").set("X-Internal-Api-Key", KEY).send({
      customerId: customerAId,
      subject: "AI-created ticket",
      description: "Something went wrong.",
      category: "general",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.status).toBe("OPEN");
  });

  it("rejects a missing subject with 400", async () => {
    const res = await request(app)
      .post("/api/internal/tickets")
      .set("X-Internal-Api-Key", KEY)
      .send({ customerId: customerAId, description: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/internal/tickets/:id", () => {
  it("returns the ticket for its owning customer, 404 for another", async () => {
    const create = await request(app).post("/api/internal/tickets").set("X-Internal-Api-Key", KEY).send({
      customerId: customerAId,
      subject: "Lookup test",
      description: "Checking status lookup.",
    });
    const ticketId = create.body.data.ticket.id;

    const own = await request(app)
      .get(`/api/internal/tickets/${ticketId}`)
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerAId });
    expect(own.status).toBe(200);

    const other = await request(app)
      .get(`/api/internal/tickets/${ticketId}`)
      .set("X-Internal-Api-Key", KEY)
      .query({ customerId: customerBId });
    expect(other.status).toBe(404);
  });
});
