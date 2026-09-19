"use strict";
const express = require("express");
const controller = require("../controllers/userController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  idParamSchema,
} = require("./validators");

const router = express.Router();

// Everything under /api/users is admin-only.
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/", validate(listUsersQuerySchema, "query"), controller.list);
router.post("/", validate(createUserSchema), controller.create);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateUserSchema), controller.update);
router.delete("/:id", validate(idParamSchema, "params"), controller.deactivate);

module.exports = router;
