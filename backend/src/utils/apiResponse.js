"use strict";

// All successful responses share this envelope: { success, message, data, meta }
function sendSuccess(res, { statusCode = 200, message = "OK", data = null, meta = undefined }) {
  return res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}

module.exports = { sendSuccess };
