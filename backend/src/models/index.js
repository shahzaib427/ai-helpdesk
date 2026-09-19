"use strict";
const { sequelize } = require("../config/database");

const User = require("./user")(sequelize);
const Customer = require("./customer")(sequelize);
const Agent = require("./agent")(sequelize);
const Product = require("./product")(sequelize);
const Order = require("./order")(sequelize);
const OrderItem = require("./orderItem")(sequelize);
const Conversation = require("./conversation")(sequelize);
const Message = require("./message")(sequelize);
const Ticket = require("./ticket")(sequelize);
const KnowledgeDocument = require("./knowledgeDocument")(sequelize);
const KnowledgeChunk = require("./knowledgeChunk")(sequelize);
const AiLog = require("./aiLog")(sequelize);

/* ---------- Identity ---------- */
// A user row holds credentials; customer/agent hold the role-specific profile.
User.hasOne(Customer, { foreignKey: "userId", as: "customerProfile", onDelete: "CASCADE" });
Customer.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasOne(Agent, { foreignKey: "userId", as: "agentProfile", onDelete: "CASCADE" });
Agent.belongsTo(User, { foreignKey: "userId", as: "user" });

/* ---------- Commerce ---------- */
Customer.hasMany(Order, { foreignKey: "customerId", as: "orders", onDelete: "CASCADE" });
Order.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderItems", onDelete: "RESTRICT" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

/* ---------- Support ---------- */
Customer.hasMany(Conversation, { foreignKey: "customerId", as: "conversations", onDelete: "CASCADE" });
Conversation.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Agent.hasMany(Conversation, { foreignKey: "assignedAgentId", as: "conversations", onDelete: "SET NULL" });
Conversation.belongsTo(Agent, { foreignKey: "assignedAgentId", as: "assignedAgent" });

Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages", onDelete: "CASCADE" });
Message.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

Message.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });

Customer.hasMany(Ticket, { foreignKey: "customerId", as: "tickets", onDelete: "CASCADE" });
Ticket.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Agent.hasMany(Ticket, { foreignKey: "assignedAgentId", as: "tickets", onDelete: "SET NULL" });
Ticket.belongsTo(Agent, { foreignKey: "assignedAgentId", as: "assignedAgent" });

Conversation.hasMany(Ticket, { foreignKey: "conversationId", as: "tickets", onDelete: "SET NULL" });
Ticket.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

/* ---------- Knowledge base ---------- */
KnowledgeDocument.hasMany(KnowledgeChunk, { foreignKey: "documentId", as: "chunks", onDelete: "CASCADE" });
KnowledgeChunk.belongsTo(KnowledgeDocument, { foreignKey: "documentId", as: "document" });

KnowledgeDocument.belongsTo(User, { foreignKey: "uploadedBy", as: "uploader", constraints: false });

/* ---------- AI observability ---------- */
Conversation.hasMany(AiLog, { foreignKey: "conversationId", as: "aiLogs", onDelete: "CASCADE" });
AiLog.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

module.exports = {
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
  KnowledgeDocument,
  KnowledgeChunk,
  AiLog,
};
