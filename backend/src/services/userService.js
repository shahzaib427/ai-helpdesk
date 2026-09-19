"use strict";
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize, User, Customer, Agent } = require("../models");
const { ROLES } = require("../config/constants");
const ApiError = require("../utils/ApiError");
const config = require("../config/env");
const { toPublicUser } = require("./authService");

async function listUsers({ page = 1, limit = 20, role, search }) {
  const where = {};
  if (role) where.role = role;
  if (search) {
    where[Op.or] = [
      { email: { [Op.like]: `%${search}%` } },
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName: { [Op.like]: `%${search}%` } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Customer, as: "customerProfile", required: false },
      { model: Agent, as: "agentProfile", required: false },
    ],
  });

  return {
    users: rows,
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getUserById(id) {
  const user = await User.findByPk(id, {
    include: [
      { model: Customer, as: "customerProfile", required: false },
      { model: Agent, as: "agentProfile", required: false },
    ],
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

// Admin-only creation path: this is how AGENT and ADMIN accounts come to exist.
async function createUser({ email, password, firstName, lastName, role, department }) {
  const normalisedEmail = email.trim().toLowerCase();
  if (await User.findOne({ where: { email: normalisedEmail } })) {
    throw ApiError.conflict("An account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  const user = await sequelize.transaction(async (tx) => {
    const created = await User.create(
      { email: normalisedEmail, passwordHash, firstName, lastName, role },
      { transaction: tx }
    );
    if (role === ROLES.CUSTOMER) {
      await Customer.create({ userId: created.id }, { transaction: tx });
    } else if (role === ROLES.AGENT) {
      await Agent.create(
        { userId: created.id, department: department || "General Support" },
        { transaction: tx }
      );
    }
    return created;
  });

  return toPublicUser(user);
}

async function updateUser(id, updates) {
  const user = await getUserById(id);
  const allowed = ["firstName", "lastName", "isActive"];
  allowed.forEach((field) => {
    if (updates[field] !== undefined) user[field] = updates[field];
  });
  await user.save();
  return user;
}

async function deactivateUser(id, actingUserId) {
  if (Number(id) === Number(actingUserId)) {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }
  const user = await getUserById(id);
  user.isActive = false;
  await user.save();
  return user;
}

module.exports = { listUsers, getUserById, createUser, updateUser, deactivateUser };
