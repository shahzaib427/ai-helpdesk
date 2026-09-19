"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Phase 4 supports .txt only, matching the AI service's loader registry —
// uploading a .pdf here would just fail later at ingestion with a less
// useful error, so it's rejected at the door instead.
const ALLOWED_EXTENSIONS = new Set([".txt"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB is generous for a policy doc

const uploadDir = path.resolve(__dirname, "../../uploads/knowledge");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Prefix with a timestamp so two uploads of "policy.txt" never collide;
    // keep the original name in the suffix so the file stays identifiable
    // on disk during debugging.
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(ApiError.badRequest(`Unsupported file type "${ext}". Only .txt is supported right now.`));
    return;
  }
  cb(null, true);
}

const uploadKnowledgeFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
}).single("file");

// Wraps multer's callback style so a rejected upload (wrong type, too large,
// no file at all) reaches the standard error handler instead of multer's own
// default response format.
function handleUpload(req, res, next) {
  uploadKnowledgeFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest(`File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`));
      }
      return next(ApiError.badRequest(err.message));
    }
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest("No file was uploaded."));
    return next();
  });
}

module.exports = { handleUpload, uploadDir, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES };
