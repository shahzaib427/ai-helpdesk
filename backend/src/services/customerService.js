"use strict";
const { Op } = require("sequelize");
const { Customer, User, Order, Ticket, Conversation } = require("../models");
const ApiError = require("../utils/ApiError");

function toSummary(customer) {
  return {
    id: customer.id,
    firstName: customer.user?.firstName,
    lastName: customer.user?.lastName,
    email: customer.user?.email,
    phone: customer.phone,
    city: customer.city,
    country: customer.country,
    createdAt: customer.createdAt,
  };
}

async function list({ page = 1, limit = 20, search }) {
  const userWhere = {};
  if (search) {
    userWhere[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await Customer.findAndCountAll({
    include: [{ model: User, as: "user", where: userWhere, required: true }],
    limit,
    offset: (page - 1) * limit,
    order: [["createdAt", "DESC"]],
  });

  return {
    customers: rows.map(toSummary),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

// Everything an agent needs on screen before replying to someone: who they
// are, and a short recent history rather than their entire lifetime record.
async function getDetail(id) {
  const customer = await Customer.findByPk(id, { include: [{ model: User, as: "user" }] });
  if (!customer) throw ApiError.notFound("Customer not found");

  const [orders, tickets, conversations] = await Promise.all([
    Order.findAll({ where: { customerId: id }, order: [["placedAt", "DESC"]], limit: 10 }),
    Ticket.findAll({ where: { customerId: id }, order: [["createdAt", "DESC"]], limit: 10 }),
    Conversation.findAll({ where: { customerId: id }, order: [["createdAt", "DESC"]], limit: 10 }),
  ]);

  return { ...toSummary(customer), orders, tickets, conversations };
}

module.exports = { list, getDetail };
