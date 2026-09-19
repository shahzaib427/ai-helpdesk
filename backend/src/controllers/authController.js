"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const authService = require("../services/authService");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, { statusCode: 201, message: "Account created", data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, { message: "Signed in", data: result });
});

// Tokens are stateless, so logout is a client-side token drop. The endpoint
// exists so the client has one place to call and we can add a token
// denylist later without changing the frontend.
const logout = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: "Signed out", data: null });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user);
  return sendSuccess(res, { message: "Current user", data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body);
  return sendSuccess(res, { message: "Password updated", data: null });
});

module.exports = { register, login, logout, me, changePassword };
