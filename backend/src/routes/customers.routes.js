"use strict";
const express = require("express");
const controller = require("../controllers/customerController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const { listCustomersQuerySchema, idParamSchema } = require("./validators");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.AGENT, ROLES.ADMIN));

router.get("/", validate(listCustomersQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

module.exports = router;
