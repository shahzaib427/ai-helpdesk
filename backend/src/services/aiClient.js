"use strict";
/**
 * The only place in the Node backend that talks to the AI service.
 * If the AI service is down or times out, callers get a clear error rather
 * than a hang, so the conversation flow can fall back gracefully.
 */
const config = require("../config/env");
const logger = require("../utils/logger");

const TIMEOUT_MS = 15000;

async function requestReply({ message, conversationId, customerId, history }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(`${config.aiServiceUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversation_id: conversationId, customer_id: customerId, history }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `AI service responded ${res.status}`);
    }

    const data = await res.json();
    return { ...data, latency_ms: data.latency_ms ?? Date.now() - started };
  } catch (err) {
    logger.error("AI service call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Ingestion can take longer than a chat reply — embedding a multi-page
// document on CPU is slower than generating one echo/LLM response — so it
// gets a longer timeout than requestReply's.
const INGEST_TIMEOUT_MS = 60000;

async function ingestDocument({ documentId, filename, category, text }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.aiServiceUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, filename, category, text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `AI service responded ${res.status}`);
    }

    return res.json();
  } catch (err) {
    logger.error("AI service ingest call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Best-effort by design: if the AI service is unreachable when a document is
// deleted or re-indexed, the caller still removes the Postgres rows — an
// orphaned vector with no matching document row is inert and gets cleaned up
// the next time anyone re-indexes, so this never blocks a delete.
async function removeDocument(documentId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${config.aiServiceUrl}/ingest/${documentId}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `AI service responded ${res.status}`);
    }
    return res.json();
  } catch (err) {
    logger.error("AI service remove call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { requestReply, ingestDocument, removeDocument };
