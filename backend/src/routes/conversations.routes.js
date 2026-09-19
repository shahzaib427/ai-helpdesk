"use strict";
const express = require("express");
const controller = require("../controllers/conversationController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const {
  startConversationSchema,
  addMessageSchema,
  listConversationsQuerySchema,
  updateConversationStatusSchema,
  idParamSchema,
} = require("./validators");

const router = express.Router();

router.use(requireAuth);

// GET / and GET /:id branch by role inside the service: a customer only ever
// sees their own threads, staff see the queue. No separate admin-only route
// is needed here.
router.get("/", validate(listConversationsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.post("/", requireRole(ROLES.CUSTOMER), validate(startConversationSchema), controller.start);

router.post(
  "/:id/messages",
  validate(idParamSchema, "params"),
  validate(addMessageSchema),
  controller.addMessage
);

router.post(
  "/:id/handoff",
  requireRole(ROLES.CUSTOMER),
  validate(idParamSchema, "params"),
  controller.requestHandoff
);

router.post(
  "/:id/take-over",
  requireRole(ROLES.AGENT, ROLES.ADMIN),
  validate(idParamSchema, "params"),
  controller.takeOver
);

router.patch(
  "/:id/status",
  requireRole(ROLES.AGENT, ROLES.ADMIN),
  validate(idParamSchema, "params"),
  validate(updateConversationStatusSchema),
  controller.updateStatus
);

module.exports = router;
