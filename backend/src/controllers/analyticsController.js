"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const analyticsService = require("../services/analyticsService");

const overview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOverview();
  return sendSuccess(res, { message: "Analytics overview", data });
});

const charts = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCharts();
  return sendSuccess(res, { message: "Analytics charts", data });
});

module.exports = { overview, charts };
