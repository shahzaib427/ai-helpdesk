"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const orderService = require("../services/orderService");

const list = asyncHandler(async (req, res) => {
  const { orders, meta } = await orderService.list(req.user, req.query);
  return sendSuccess(res, { message: "Orders", data: { orders }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id, req.user);
  return sendSuccess(res, { message: "Order", data: { order } });
});

// Looked up by order number rather than internal id, matching how a customer
// or a support agent actually refers to an order ("where's order 5012?").
const getByNumber = asyncHandler(async (req, res) => {
  const order = await orderService.getByOrderNumber(req.params.orderNumber, req.user);
  return sendSuccess(res, { message: "Order", data: { order } });
});

// Admin-only: simulates placing an order so there is live data to work
// against; there is no real checkout flow in this project.
const create = asyncHandler(async (req, res) => {
  const order = await orderService.create(req.body);
  return sendSuccess(res, { statusCode: 201, message: "Order created", data: { order } });
});

const update = asyncHandler(async (req, res) => {
  const order = await orderService.update(req.params.id, req.body);
  return sendSuccess(res, { message: "Order updated", data: { order } });
});

module.exports = { list, getOne, getByNumber, create, update };
