"use strict";
const { Op } = require("sequelize");
const { Product } = require("../models");
const ApiError = require("../utils/ApiError");

async function list({ page = 1, limit = 20, category, search, includeInactive }) {
  const where = {};
  if (!includeInactive) where.isActive = true;
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { sku: { [Op.iLike]: `%${search}%` } }];
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [["name", "ASC"]],
  });

  return {
    products: rows,
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

async function getById(id) {
  const product = await Product.findByPk(id);
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

async function create(payload) {
  const existing = await Product.findOne({ where: { sku: payload.sku } });
  if (existing) throw ApiError.conflict("A product with that SKU already exists");
  return Product.create(payload);
}

async function update(id, updates) {
  const product = await getById(id);
  if (updates.sku && updates.sku !== product.sku) {
    const clash = await Product.findOne({ where: { sku: updates.sku } });
    if (clash) throw ApiError.conflict("A product with that SKU already exists");
  }
  Object.assign(product, updates);
  await product.save();
  return product;
}

// Products are never hard-deleted: order_items reference them permanently,
// and a retired product should still show correctly on past orders.
async function retire(id) {
  const product = await getById(id);
  product.isActive = false;
  await product.save();
  return product;
}

async function reactivate(id) {
  const product = await getById(id);
  product.isActive = true;
  await product.save();
  return product;
}

module.exports = { list, getById, create, update, retire, reactivate };
