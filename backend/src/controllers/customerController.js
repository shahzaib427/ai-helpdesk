"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const customerService = require("../services/customerService");

const list = asyncHandler(async (req, res) => {
  const { customers, meta } = await customerService.list(req.query);
  return sendSuccess(res, { message: "Customers", data: { customers }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await customerService.getDetail(req.params.id);
  return sendSuccess(res, { message: "Customer", data: { customer } });
});

module.exports = { list, getOne };
