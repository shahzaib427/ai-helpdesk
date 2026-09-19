"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const productService = require("../services/productService");

const list = asyncHandler(async (req, res) => {
  const { products, meta } = await productService.list(req.query);
  return sendSuccess(res, { message: "Products", data: { products }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.id);
  return sendSuccess(res, { message: "Product", data: { product } });
});

const create = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body);
  return sendSuccess(res, { statusCode: 201, message: "Product created", data: { product } });
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  return sendSuccess(res, { message: "Product updated", data: { product } });
});

const retire = asyncHandler(async (req, res) => {
  const product = await productService.retire(req.params.id);
  return sendSuccess(res, { message: "Product retired", data: { product } });
});

const reactivate = asyncHandler(async (req, res) => {
  const product = await productService.reactivate(req.params.id);
  return sendSuccess(res, { message: "Product reactivated", data: { product } });
});

module.exports = { list, getOne, create, update, retire, reactivate };
