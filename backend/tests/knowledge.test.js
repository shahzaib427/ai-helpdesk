"use strict";
process.env.NODE_ENV = "test";

// The AI service's ingest/remove calls are mocked here rather than left to
// hit a real (probably absent) AI service, so both the success path (a
// document reaching READY with real chunks) and the failure path (a
// document reaching FAILED with a clear error) can be tested deliberately,
// instead of only ever exercising whichever one happens to occur.
jest.mock("../src/services/aiClient");

const request = require("supertest");
const fs = require("fs");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");
const { ROLES } = require("../src/config/constants");
const aiClient = require("../src/services/aiClient");
const { uploadDir } = require("../src/middleware/upload");

let adminToken;
let agentToken;
let customerToken;

async function createStaff(email, role) {
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("Password123", 10);
  await User.create({ email, passwordHash, firstName: "Staff", lastName: role, role });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
  return res.body.data.token;
}

async function registerCustomer(email) {
  await request(app)
    .post("/api/auth/register")
    .send({ email, password: "Password123", firstName: "Kim", lastName: "Customer" });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
  return res.body.data.token;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  adminToken = await createStaff("p4.admin@example.com", ROLES.ADMIN);
  agentToken = await createStaff("p4.agent@example.com", ROLES.AGENT);
  customerToken = await registerCustomer("p4.customer@example.com");
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await sequelize.close();
  // Clean up anything actually written to disk during upload tests.
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

describe("Access control", () => {
  it("blocks a customer from the knowledge base with 403", async () => {
    const res = await request(app).get("/api/knowledge").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks an agent from the knowledge base with 403", async () => {
    const res = await request(app).get("/api/knowledge").set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Upload and ingestion", () => {
  it("rejects a non-.txt file with 400 before it ever reaches ingestion", async () => {
    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("%PDF-fake"), "policy.pdf");

    expect(res.status).toBe(400);
    expect(aiClient.ingestDocument).not.toHaveBeenCalled();
  });

  it("rejects a request with no file with 400", async () => {
    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("category", "policy");
    expect(res.status).toBe(400);
  });

  it("uploads a .txt file, ingests it, and reaches READY with real chunk rows", async () => {
    aiClient.ingestDocument.mockResolvedValue({
      document_id: 1,
      chunk_count: 2,
      chunks: [
        { chunk_uid: "1:0", chunk_index: 0, text: "First chunk.", page_number: null },
        { chunk_uid: "1:1", chunk_index: 1, text: "Second chunk.", page_number: null },
      ],
    });

    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("category", "policy")
      .attach("file", Buffer.from("Return policy.\n\nSecond paragraph."), "return_policy.txt");

    expect(res.status).toBe(201);
    const { document } = res.body.data;
    expect(document.status).toBe("READY");
    expect(document.chunkCount).toBe(2);
    expect(document.chunks).toHaveLength(2);
    expect(document.chunks[0].content).toBe("First chunk.");
    expect(aiClient.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "return_policy.txt", category: "policy" })
    );
  });

  it("marks a document FAILED when the AI service call fails, and keeps the file for retry", async () => {
    aiClient.ingestDocument.mockRejectedValue(new Error("AI service unreachable"));

    const res = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("Some content."), "unreachable.txt");

    expect(res.status).toBe(201); // upload itself succeeded; ingestion is what failed
    expect(res.body.data.document.status).toBe("FAILED");
    expect(res.body.data.document.errorMessage).toMatch(/unreachable/);
    expect(res.body.data.document.chunkCount).toBe(0);
  });
});

describe("Listing and filtering", () => {
  it("lists documents with status filtering", async () => {
    const res = await request(app)
      .get("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ status: "FAILED" });

    expect(res.status).toBe(200);
    expect(res.body.data.documents.every((d) => d.status === "FAILED")).toBe(true);
  });
});

describe("Re-index", () => {
  it("clears old chunks and replaces them with newly ingested ones", async () => {
    aiClient.ingestDocument.mockResolvedValue({
      document_id: 1,
      chunk_count: 2,
      chunks: [
        { chunk_uid: "1:0", chunk_index: 0, text: "First chunk.", page_number: null },
        { chunk_uid: "1:1", chunk_index: 1, text: "Second chunk.", page_number: null },
      ],
    });
    const upload = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("Original content."), "reindex-me.txt");
    const docId = upload.body.data.document.id;

    aiClient.removeDocument.mockResolvedValue({ document_id: docId, removed: 2 });
    aiClient.ingestDocument.mockResolvedValue({
      document_id: docId,
      chunk_count: 1,
      chunks: [{ chunk_uid: `${docId}:0`, chunk_index: 0, text: "Re-indexed content.", page_number: null }],
    });

    const res = await request(app)
      .post(`/api/knowledge/${docId}/reindex`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(aiClient.removeDocument).toHaveBeenCalledWith(docId);
    expect(res.body.data.document.chunkCount).toBe(1);
    expect(res.body.data.document.chunks).toHaveLength(1);
    expect(res.body.data.document.chunks[0].content).toBe("Re-indexed content.");
  });

  it("proceeds with re-ingestion even if clearing old vectors fails", async () => {
    aiClient.ingestDocument.mockResolvedValue({
      document_id: 99,
      chunk_count: 1,
      chunks: [{ chunk_uid: "99:0", chunk_index: 0, text: "chunk", page_number: null }],
    });
    const upload = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("content"), "resilient.txt");
    const docId = upload.body.data.document.id;

    aiClient.removeDocument.mockRejectedValue(new Error("AI service down"));
    aiClient.ingestDocument.mockResolvedValue({
      document_id: docId,
      chunk_count: 1,
      chunks: [{ chunk_uid: `${docId}:0`, chunk_index: 0, text: "still works", page_number: null }],
    });

    const res = await request(app)
      .post(`/api/knowledge/${docId}/reindex`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.document.status).toBe("READY");
  });
});

describe("Delete", () => {
  it("deletes a document, its chunks, and its file even if the AI service call fails", async () => {
    aiClient.ingestDocument.mockResolvedValue({ document_id: 5, chunk_count: 0, chunks: [] });
    const upload = await request(app)
      .post("/api/knowledge")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("to be deleted"), "delete-me.txt");
    const docId = upload.body.data.document.id;

    aiClient.removeDocument.mockRejectedValue(new Error("AI service down"));

    const del = await request(app)
      .delete(`/api/knowledge/${docId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/knowledge/${docId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(get.status).toBe(404);
  });
});
