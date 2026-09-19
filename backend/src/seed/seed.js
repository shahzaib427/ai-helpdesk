"use strict";
/**
 * Loads realistic demo data so every screen has something to show.
 * Safe to re-run: it truncates the tables it owns first.
 *
 *   npm run db:seed
 *
 * Demo passwords are printed at the end. They are for local development only.
 */
const bcrypt = require("bcryptjs");
const {
  sequelize,
  User,
  Customer,
  Agent,
  Product,
  Order,
  OrderItem,
  Conversation,
  Message,
  Ticket,
} = require("../models");
const {
  ROLES,
  ORDER_STATUS,
  TICKET_STATUS,
  TICKET_PRIORITY,
  CONVERSATION_STATUS,
  SENDER_TYPE,
} = require("../config/constants");
const config = require("../config/env");
const logger = require("../utils/logger");

const DEMO_PASSWORD = "Password123";

const CUSTOMER_NAMES = [
  ["Amara", "Okafor"], ["Bilal", "Rahman"], ["Chen", "Wei"], ["Dana", "Kovacs"],
  ["Elias", "Nordstrom"], ["Farida", "Haddad"], ["Grace", "Mwangi"], ["Hugo", "Silva"],
  ["Ines", "Moreau"], ["Jonas", "Berg"],
];

const AGENTS = [
  ["Priya", "Sharma", "Billing & Refunds"],
  ["Marcus", "Bell", "Orders & Shipping"],
  ["Leila", "Haddad", "Technical Support"],
];

const CATEGORIES = ["Audio", "Wearables", "Home", "Accessories", "Computing"];
const PRODUCT_NAMES = [
  "Aria Wireless Headphones", "Aria Earbuds Pro", "Nomad Bluetooth Speaker", "Studio Desk Mic",
  "Pulse Fitness Band", "Pulse Watch 2", "Orbit Sleep Tracker", "Aura Smart Lamp",
  "Aura Thermostat", "Hearth Air Purifier", "Cabin Door Sensor", "Vault Power Bank 20k",
  "Vault USB-C Hub", "Trail Laptop Sleeve", "Trail Backpack 24L", "Forge Mechanical Keyboard",
  "Forge Ergo Mouse", "Clarity 27\" Monitor", "Clarity Webcam 4K", "Anchor Laptop Stand",
];

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  // CASCADE lets Postgres truncate tables with foreign keys pointing at them
  // without deleting in a strict dependency order first.
  for (const model of [Message, Ticket, Conversation, OrderItem, Order, Product, Agent, Customer, User]) {
    await model.destroy({ where: {}, truncate: true, cascade: true, force: true });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptRounds);

  /* ---- Admin ---- */
  await User.create({
    email: "admin@helpdesk.local",
    passwordHash,
    firstName: "Sofia",
    lastName: "Reyes",
    role: ROLES.ADMIN,
  });

  /* ---- Agents ---- */
  const agents = [];
  for (const [firstName, lastName, department] of AGENTS) {
    const user = await User.create({
      email: `${firstName.toLowerCase()}@helpdesk.local`,
      passwordHash,
      firstName,
      lastName,
      role: ROLES.AGENT,
    });
    agents.push(await Agent.create({ userId: user.id, department }));
  }

  /* ---- Customers ---- */
  const customers = [];
  for (const [firstName, lastName] of CUSTOMER_NAMES) {
    const user = await User.create({
      email: `${firstName.toLowerCase()}@example.com`,
      passwordHash,
      firstName,
      lastName,
      role: ROLES.CUSTOMER,
    });
    customers.push(
      await Customer.create({
        userId: user.id,
        phone: `+1555${String(1000000 + rand(8999999)).slice(0, 7)}`,
        city: pick(["Lisbon", "Toronto", "Nairobi", "Berlin", "Lahore", "Austin"]),
        country: pick(["Portugal", "Canada", "Kenya", "Germany", "Pakistan", "USA"]),
      })
    );
  }

  /* ---- Products ---- */
  const products = [];
  for (let i = 0; i < PRODUCT_NAMES.length; i += 1) {
    products.push(
      await Product.create({
        sku: `SKU-${String(1001 + i)}`,
        name: PRODUCT_NAMES[i],
        description: `${PRODUCT_NAMES[i]} — everyday hardware from the demo catalogue, covered by the standard warranty.`,
        category: CATEGORIES[i % CATEGORIES.length],
        price: (19 + rand(400) + 0.99).toFixed(2),
        stock: rand(200),
        warrantyMonths: pick([12, 24]),
      })
    );
  }

  /* ---- Orders ---- */
  // Order numbers start at 5000 so the docs example ("order #5012") resolves.
  for (let i = 0; i < 30; i += 1) {
    const customer = pick(customers);
    const status = pick(Object.values(ORDER_STATUS));
    const placedAt = daysAgo(2 + rand(60));

    const order = await Order.create({
      orderNumber: String(5000 + i),
      customerId: customer.id,
      status,
      placedAt,
      currency: "USD",
      trackingNumber:
        status === ORDER_STATUS.SHIPPED || status === ORDER_STATUS.DELIVERED
          ? `TRK${10000 + rand(89999)}`
          : null,
      carrier: status === ORDER_STATUS.SHIPPED || status === ORDER_STATUS.DELIVERED ? "GlobalPost" : null,
      shippedAt: status === ORDER_STATUS.SHIPPED || status === ORDER_STATUS.DELIVERED ? placedAt : null,
      estimatedDelivery: status === ORDER_STATUS.SHIPPED ? daysAhead(2 + rand(6)) : null,
      deliveredAt: status === ORDER_STATUS.DELIVERED ? daysAgo(1 + rand(10)) : null,
    });

    let total = 0;
    const lineCount = 1 + rand(3);
    const used = new Set();
    for (let j = 0; j < lineCount; j += 1) {
      const product = pick(products);
      if (used.has(product.id)) continue;
      used.add(product.id);
      const quantity = 1 + rand(3);
      total += Number(product.price) * quantity;
      await OrderItem.create({
        orderId: order.id,
        productId: product.id,
        quantity,
        unitPrice: product.price,
      });
    }
    order.totalAmount = total.toFixed(2);
    await order.save();
  }

  /* ---- Conversations, messages and tickets ---- */
  const openers = [
    "Hi, what is your return policy on headphones?",
    "Where is my order? It was supposed to arrive last week.",
    "I was charged twice for the same order.",
    "Does the Pulse Watch 2 work with Android?",
    "I want to return an item I bought 10 days ago.",
    "Can I speak to a human please?",
    "How long does international shipping take?",
    "My speaker stopped charging after two months.",
    "Do you price match?",
    "How do I update the address on an order?",
  ];

  for (let i = 0; i < openers.length; i += 1) {
    const customer = customers[i % customers.length];
    const needsAgent = i % 3 === 0;

    const conversation = await Conversation.create({
      customerId: customer.id,
      subject: openers[i].slice(0, 70),
      status: needsAgent ? CONVERSATION_STATUS.WITH_AGENT : CONVERSATION_STATUS.RESOLVED,
      aiEnabled: !needsAgent,
      assignedAgentId: needsAgent ? pick(agents).id : null,
      lastMessageAt: daysAgo(rand(20)),
    });

    await Message.create({
      conversationId: conversation.id,
      senderId: customer.userId,
      senderType: SENDER_TYPE.CUSTOMER,
      content: openers[i],
    });
    await Message.create({
      conversationId: conversation.id,
      senderType: SENDER_TYPE.AI,
      content:
        "Thanks for reaching out — let me look that up for you. (Seeded placeholder; real AI replies arrive in Phase 5.)",
    });

    await Ticket.create({
      customerId: customer.id,
      conversationId: conversation.id,
      assignedAgentId: needsAgent ? conversation.assignedAgentId : pick(agents).id,
      subject: openers[i].slice(0, 70),
      description: openers[i],
      category: pick(["returns", "shipping", "billing", "product", "technical"]),
      priority: pick(Object.values(TICKET_PRIORITY)),
      status: pick(Object.values(TICKET_STATUS)),
    });
  }

  logger.info("Seed complete.");
  logger.info(`  Admin     admin@helpdesk.local / ${DEMO_PASSWORD}`);
  logger.info(`  Agent     priya@helpdesk.local / ${DEMO_PASSWORD}`);
  logger.info(`  Customer  amara@example.com    / ${DEMO_PASSWORD}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("Seed failed:", err.message);
    process.exit(1);
  });
