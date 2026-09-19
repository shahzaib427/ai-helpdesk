"use strict";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const config = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (!config.isTest) app.use(morgan("dev"));

app.use("/api", apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
