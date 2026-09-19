"use strict";
const express = require("express");
const controller = require("../controllers/knowledgeController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { handleUpload } = require("../middleware/upload");
const { ROLES } = require("../config/constants");
const {
  uploadKnowledgeDocumentSchema,
  listKnowledgeDocumentsQuerySchema,
  idParamSchema,
} = require("./validators");

const router = express.Router();

// The knowledge base shapes what the AI is allowed to say, so managing it —
// uploading, deleting, re-indexing — is admin-only, same as the product
// catalog. There's no customer- or agent-facing route here.
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/", validate(listKnowledgeDocumentsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

// multer (handleUpload) runs before validate, since validate needs
// req.body populated, and only multer's multipart parser does that here.
router.post("/", handleUpload, validate(uploadKnowledgeDocumentSchema), controller.upload);

router.post("/:id/reindex", validate(idParamSchema, "params"), controller.reindex);
router.delete("/:id", validate(idParamSchema, "params"), controller.remove);

module.exports = router;
