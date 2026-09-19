"use strict";
const express = require("express");
const controller = require("../controllers/ticketController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const {
  createTicketSchema,
  updateTicketSchema,
  addTicketNoteSchema,
  listTicketsQuerySchema,
  idParamSchema,
} = require("./validators");

const router = express.Router();

router.use(requireAuth);

// GET / and GET /:id branch by role inside the controller/service, same
// pattern as conversations: a customer only ever sees their own tickets.
router.get("/", validate(listTicketsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.post("/", requireRole(ROLES.CUSTOMER), validate(createTicketSchema), controller.create);

const staffOnly = requireRole(ROLES.AGENT, ROLES.ADMIN);

router.patch(
  "/:id/status",
  staffOnly,
  validate(idParamSchema, "params"),
  validate(updateTicketSchema.pick({ status: true }).required()),
  controller.updateStatus
);

router.patch(
  "/:id/priority",
  staffOnly,
  validate(idParamSchema, "params"),
  validate(updateTicketSchema.pick({ priority: true }).required()),
  controller.updatePriority
);

router.patch(
  "/:id/assign",
  staffOnly,
  validate(idParamSchema, "params"),
  validate(updateTicketSchema.pick({ assignedAgentId: true }).required()),
  controller.assign
);

router.post(
  "/:id/notes",
  staffOnly,
  validate(idParamSchema, "params"),
  validate(addTicketNoteSchema),
  controller.addNote
);

module.exports = router;
