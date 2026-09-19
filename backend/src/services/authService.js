"use strict";
const bcrypt = require("bcryptjs");
const { sequelize, User, Customer, Agent } = require("../models");
const { ROLES } = require("../config/constants");
const ApiError = require("../utils/ApiError");
const { signAccessToken } = require("../utils/jwt");
const config = require("../config/env");

// Shape sent to the client. Never includes passwordHash.
function toPublicUser(user, profile = null) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    profile,
  };
}

async function loadProfile(user) {
  if (user.role === ROLES.CUSTOMER) {
    return Customer.findOne({ where: { userId: user.id } });
  }
  if (user.role === ROLES.AGENT) {
    return Agent.findOne({ where: { userId: user.id } });
  }
  return null;
}

// Public self-registration always creates a CUSTOMER. Agents and admins are
// created by an admin (Phase 1: via the seed script / user routes), so a
// stranger can never escalate their own role through the register endpoint.
async function register({ email, password, firstName, lastName, phone }) {
  const normalisedEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ where: { email: normalisedEmail } });
  if (existing) throw ApiError.conflict("An account with that email already exists");

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  // User + profile must be created together or not at all.
  const user = await sequelize.transaction(async (tx) => {
    const created = await User.create(
      { email: normalisedEmail, passwordHash, firstName, lastName, role: ROLES.CUSTOMER },
      { transaction: tx }
    );
    await Customer.create({ userId: created.id, phone: phone || null }, { transaction: tx });
    return created;
  });

  const profile = await loadProfile(user);
  return { user: toPublicUser(user, profile), token: signAccessToken(user) };
}

async function login({ email, password }) {
  const user = await User.scope("withPassword").findOne({
    where: { email: email.trim().toLowerCase() },
  });

  // Same message for unknown email and wrong password: do not leak which
  // addresses are registered.
  const invalid = ApiError.unauthorized("Email or password is incorrect");
  if (!user) throw invalid;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw invalid;
  if (!user.isActive) throw ApiError.forbidden("This account is deactivated");

  user.lastLoginAt = new Date();
  await user.save();

  const profile = await loadProfile(user);
  return { user: toPublicUser(user, profile), token: signAccessToken(user) };
}

async function getCurrentUser(user) {
  const profile = await loadProfile(user);
  return toPublicUser(user, profile);
}

async function changePassword(user, { currentPassword, newPassword }) {
  const withHash = await User.scope("withPassword").findByPk(user.id);
  const matches = await bcrypt.compare(currentPassword, withHash.passwordHash);
  if (!matches) throw ApiError.badRequest("Current password is incorrect");

  withHash.passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await withHash.save();
}

module.exports = { register, login, getCurrentUser, changePassword, toPublicUser, loadProfile };
