"use strict";
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const required = ["JWT_SECRET", "DB_DATABASE", "DB_USER", "INTERNAL_API_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(
    `Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`
  );
}

const isTest = process.env.NODE_ENV === "test";

module.exports = {
  env: process.env.NODE_ENV || "development",
  isTest,
  port: Number(process.env.PORT || 5000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    name: isTest
      ? process.env.DB_TEST_DATABASE || `${process.env.DB_DATABASE}_test`
      : process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:5001",
  // Shared secret the AI service presents to reach /api/internal/*. The AI
  // service is never a logged-in user, so it can't carry a JWT — this is
  // the only other door into protected data, and it opens onto a
  // deliberately narrow, tool-shaped set of endpoints, not the full API.
  internalApiKey: process.env.INTERNAL_API_KEY,
};
