"use strict";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

const customer = {
  email: "test.customer@example.com",
  password: "Password123",
  firstName: "Test",
  lastName: "Customer",
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /api/auth/register", () => {
  it("creates a customer account and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send(customer);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(app).post("/api/auth/register").send(customer);
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with 422", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...customer, email: "weak@example.com", password: "short" });

    expect(res.status).toBe(422);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: customer.email, password: customer.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: customer.email, password: "WrongPassword1" });

    expect(res.status).toBe(401);
  });
});

describe("Authorization", () => {
  let customerToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: customer.email, password: customer.password });
    customerToken = res.body.data.token;
  });

  it("returns the current user from /api/auth/me", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(customer.email);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("blocks a customer from the admin-only users route with 403", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it("denies access once the account is deactivated", async () => {
    await User.update({ isActive: false }, { where: { email: customer.email } });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    await User.update({ isActive: true }, { where: { email: customer.email } });
  });
});

describe("Unknown routes", () => {
  it("returns 404 in the standard error envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
