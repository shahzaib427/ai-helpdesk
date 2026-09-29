"use strict";
const { Op } = require("sequelize");
const { sequelize, Order, OrderItem, Product, Customer } = require("../models");
const { ROLES, ORDER_STATUS } = require("../config/constants");
const ApiError = require("../utils/ApiError");

async function getCustomerProfile(user) {
  const profile = await Customer.findOne({ where: { userId: user.id } });
  if (!profile) throw ApiError.forbidden("No customer profile for this account");
  return profile;
}

function nextOrderNumber() {
  // Demo-friendly: matches the seeded "5000+" range so tool-calling examples
  // in later phases (e.g. "order #5012") keep working against real data.
  return String(5000 + Math.floor(Math.random() * 900000));
}

// Customers only ever see their own orders; staff can list and search all.
async function list(user, { page = 1, limit = 20, status, search }) {
  const where = {};
  if (status) where.status = status;

  if (user.role === ROLES.CUSTOMER) {
    const profile = await getCustomerProfile(user);
    where.customerId = profile.id;
  } else if (search) {
    where[Op.or] = [
      { orderNumber: { [Op.iLike]: `%${search}%` } },
      { trackingNumber: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [{ model: Customer, as: "customer", include: ["user"] }],
    order: [["placedAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    orders: rows.map((order) => ({
      ...order.toJSON(),
      customerName: order.customer?.user
        ? `${order.customer.user.firstName} ${order.customer.user.lastName}`
        : null,
    })),
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getById(id, user) {
  const order = await Order.findByPk(id, {
    include: [
      { model: Customer, as: "customer", include: ["user"] },
      { model: OrderItem, as: "items", include: ["product"] },
    ],
  });
  if (!order) throw ApiError.notFound("Order not found");

  if (user.role === ROLES.CUSTOMER) {
    const profile = await getCustomerProfile(user);
    if (order.customerId !== profile.id) throw ApiError.forbidden();
  }

  return order;
}

// Looked up by order-status-style tools in later phases as well as the UI,
// so it lives here rather than only being reachable by primary key.
async function getByOrderNumber(orderNumber, user) {
  const order = await Order.findOne({
    where: { orderNumber: String(orderNumber) },
    include: [
      { model: Customer, as: "customer", include: ["user"] },
      { model: OrderItem, as: "items", include: ["product"] },
    ],
  });
  if (!order) throw ApiError.notFound("Order not found");

  if (user.role === ROLES.CUSTOMER) {
    const profile = await getCustomerProfile(user);
    if (order.customerId !== profile.id) throw ApiError.forbidden();
  }

  return order;
}

// Admin-only: simulates placing an order so the catalog has live data to
// demo the order-status tool against in Phase 6, without a real checkout.
async function create({ customerId, items, currency = "USD" }) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) throw ApiError.badRequest("Unknown customer");

  return sequelize.transaction(async (tx) => {
    const order = await Order.create(
      { orderNumber: nextOrderNumber(), customerId, currency, status: ORDER_STATUS.PENDING },
      { transaction: tx }
    );

    let total = 0;
    for (const { productId, quantity } of items) {
      const product = await Product.findByPk(productId, { transaction: tx });
      if (!product) throw ApiError.badRequest(`Product ${productId} does not exist`);
      if (!product.isActive) throw ApiError.badRequest(`${product.name} is no longer available`);

      await OrderItem.create(
        { orderId: order.id, productId, quantity, unitPrice: product.price },
        { transaction: tx }
      );
      total += Number(product.price) * quantity;
    }

    order.totalAmount = total.toFixed(2);
    await order.save({ transaction: tx });
    return order;
  });
}

async function update(id, updates) {
  const order = await Order.findByPk(id);
  if (!order) throw ApiError.notFound("Order not found");

  if (updates.status === ORDER_STATUS.SHIPPED && !order.shippedAt) order.shippedAt = new Date();
  if (updates.status === ORDER_STATUS.DELIVERED && !order.deliveredAt) order.deliveredAt = new Date();

  Object.assign(order, updates);
  await order.save();
  return order;
}

// ---- Internal/tool-calling variants ----
// The AI service has no logged-in user, only a customerId it was told by
// Node (the customer whose conversation this is). These functions take that
// customerId directly rather than a user object, and enforce the same
// ownership check inline rather than through getCustomerProfile — a rogue
// prompt asking about a different customer's order number is refused the
// same way a browser request would be, just via a different parameter shape.

async function getByOrderNumberForCustomer(orderNumber, customerId) {
  const order = await Order.findOne({
    where: { orderNumber: String(orderNumber) },
    include: [{ model: OrderItem, as: "items", include: ["product"] }],
  });
  if (!order || order.customerId !== customerId) return null;
  return order;
}

async function listForCustomerId(customerId, limit = 5) {
  return Order.findAll({
    where: { customerId },
    order: [["placedAt", "DESC"]],
    limit,
  });
}

module.exports = {
  list,
  getById,
  getByOrderNumber,
  create,
  update,
  getByOrderNumberForCustomer,
  listForCustomerId,
};
