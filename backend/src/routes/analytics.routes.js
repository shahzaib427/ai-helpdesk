"use strict";
const express = require("express");
const controller = require("../controllers/analyticsController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/overview", controller.overview);
router.get("/charts", controller.charts);

module.exports = router;
