"use strict";
const express = require("express");
const controller = require("../controllers/orderController");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../config/constants");
const { createOrderSchema, updateOrderSchema, listOrdersQuerySchema, idParamSchema } = require("./validators");

const router = express.Router();

router.use(requireAuth);

// Customers see only their own orders (enforced in the service); staff see
// and can search all of them. Mutating an order is admin-only, matching how
// this project treats orders as admin-managed catalog data rather than
// something support staff edit directly.
router.get("/", validate(listOrdersQuerySchema, "query"), controller.list);
router.get("/by-number/:orderNumber", controller.getByNumber);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.use(requireRole(ROLES.ADMIN));
router.post("/", validate(createOrderSchema), controller.create);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateOrderSchema), controller.update);

module.exports = router;
