"use strict";
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { requireInternalKey } = require("../middleware/internalAuth");
const orderService = require("../services/orderService");
const ticketService = require("../services/ticketService");
const productService = require("../services/productService");

const router = express.Router();

// Nothing under here goes through requireAuth — the caller is the AI
// service, not a browser with a session. requireInternalKey is the entire
// authorization story for this router, which is exactly why it's kept
// narrow: six read/write shapes that mirror the six tools in
// ai-service/app/tools, not a backdoor into the general API.
router.use(requireInternalKey);

router.get(
  "/orders/by-number/:orderNumber",
  asyncHandler(async (req, res) => {
    const customerId = Number(req.query.customerId);
    if (!customerId) throw ApiError.badRequest("customerId is required");

    const order = await orderService.getByOrderNumberForCustomer(req.params.orderNumber, customerId);
    if (!order) throw ApiError.notFound("No order with that number for this customer");
    return sendSuccess(res, { message: "Order", data: { order } });
  })
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const customerId = Number(req.query.customerId);
    if (!customerId) throw ApiError.badRequest("customerId is required");

    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const orders = await orderService.listForCustomerId(customerId, limit);
    return sendSuccess(res, { message: "Orders", data: { orders } });
  })
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const { products } = await productService.list({
      page: 1,
      limit,
      search: req.query.search || undefined,
    });
    return sendSuccess(res, { message: "Products", data: { products } });
  })
);

router.post(
  "/tickets",
  asyncHandler(async (req, res) => {
    const { customerId, subject, description, category, conversationId } = req.body;
    if (!customerId || !subject || !description) {
      throw ApiError.badRequest("customerId, subject and description are required");
    }

    const ticket = await ticketService.createForCustomerId(Number(customerId), {
      subject,
      description,
      category,
      conversationId,
    });
    return sendSuccess(res, { statusCode: 201, message: "Ticket created", data: { ticket } });
  })
);

router.get(
  "/tickets/:id",
  asyncHandler(async (req, res) => {
    const customerId = Number(req.query.customerId);
    if (!customerId) throw ApiError.badRequest("customerId is required");

    const ticket = await ticketService.getForCustomerId(req.params.id, customerId);
    if (!ticket) throw ApiError.notFound("No ticket with that id for this customer");
    return sendSuccess(res, { message: "Ticket", data: { ticket } });
  })
);

module.exports = router;
