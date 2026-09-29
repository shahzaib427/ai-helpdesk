"use strict";
const express = require("express");
const { sequelize } = require("../models");
const authRoutes = require("./auth.routes");
const userRoutes = require("./users.routes");
const conversationRoutes = require("./conversations.routes");
const ticketRoutes = require("./tickets.routes");
const productRoutes = require("./products.routes");
const orderRoutes = require("./orders.routes");
const customerRoutes = require("./customers.routes");
const knowledgeRoutes = require("./knowledge.routes");
const internalRoutes = require("./internal.routes");
const analyticsRoutes = require("./analytics.routes");

const router = express.Router();

router.get("/health", async (req, res) => {
  let database = "up";
  try {
    await sequelize.authenticate();
  } catch (err) {
    database = "down";
  }
  return res.json({ success: true, message: "OK", data: { service: "backend", database } });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/conversations", conversationRoutes);
router.use("/tickets", ticketRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/customers", customerRoutes);
router.use("/knowledge", knowledgeRoutes);
router.use("/internal", internalRoutes);
router.use("/analytics", analyticsRoutes);

module.exports = router;
