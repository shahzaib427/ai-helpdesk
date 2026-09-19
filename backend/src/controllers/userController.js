"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const userService = require("../services/userService");

const list = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.query);
  return sendSuccess(res, { message: "Users", data: { users }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  return sendSuccess(res, { message: "User", data: { user } });
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  return sendSuccess(res, { statusCode: 201, message: "User created", data: { user } });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  return sendSuccess(res, { message: "User updated", data: { user } });
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, req.user.id);
  return sendSuccess(res, { message: "User deactivated", data: { user } });
});

module.exports = { list, getOne, create, update, deactivate };
