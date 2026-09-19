"use strict";
const express = require("express");
const controller = require("../controllers/authController");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { registerSchema, loginSchema, changePasswordSchema } = require("./validators");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), controller.register);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/logout", requireAuth, controller.logout);
router.get("/me", requireAuth, controller.me);
router.patch("/password", requireAuth, validate(changePasswordSchema), controller.changePassword);

module.exports = router;
