"use strict";
const { z } = require("zod");
const {
  ROLES,
  CONVERSATION_STATUS,
  TICKET_STATUS,
  TICKET_PRIORITY,
  ORDER_STATUS,
  DOCUMENT_STATUS,
} = require("../config/constants");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address").max(160),
  password,
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  phone: z.string().max(32).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: password,
});

const createUserSchema = z.object({
  email: z.string().email().max(160),
  password,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.nativeEnum(ROLES),
  department: z.string().max(80).optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(ROLES).optional(),
  search: z.string().max(120).optional(),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const startConversationSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(4000),
  subject: z.string().max(180).optional(),
});

const addMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(4000),
});

const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(CONVERSATION_STATUS).optional(),
  mine: z.coerce.boolean().optional(),
});

const updateConversationStatusSchema = z.object({
  status: z.nativeEnum(CONVERSATION_STATUS),
});

/* ---------- Products ---------- */

const createProductSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(48),
  name: z.string().min(1, "Name is required").max(160),
  description: z.string().max(4000).optional(),
  category: z.string().max(80).optional(),
  price: z.coerce.number().nonnegative("Price cannot be negative"),
  currency: z.string().length(3).optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  warrantyMonths: z.coerce.number().int().nonnegative().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().max(80).optional(),
  search: z.string().max(120).optional(),
  includeInactive: z.coerce.boolean().optional(),
});

/* ---------- Orders ---------- */

const orderItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(999),
});

const createOrderSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  items: z.array(orderItemSchema).min(1, "An order needs at least one item"),
  currency: z.string().length(3).optional(),
});

const updateOrderSchema = z.object({
  status: z.nativeEnum(ORDER_STATUS).optional(),
  trackingNumber: z.string().max(64).optional(),
  carrier: z.string().max(60).optional(),
  estimatedDelivery: z.string().max(10).optional(),
});

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ORDER_STATUS).optional(),
  search: z.string().max(120).optional(),
});

/* ---------- Tickets ---------- */

const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(180),
  description: z.string().min(1, "Description is required").max(4000),
  category: z.string().max(60).optional(),
  priority: z.nativeEnum(TICKET_PRIORITY).optional(),
  conversationId: z.coerce.number().int().positive().optional(),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(TICKET_STATUS).optional(),
  priority: z.nativeEnum(TICKET_PRIORITY).optional(),
  category: z.string().max(60).optional(),
  assignedAgentId: z.coerce.number().int().positive().nullable().optional(),
});

const addTicketNoteSchema = z.object({
  content: z.string().min(1, "Note cannot be empty").max(2000),
});

const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(TICKET_STATUS).optional(),
  priority: z.nativeEnum(TICKET_PRIORITY).optional(),
  mine: z.coerce.boolean().optional(),
});

/* ---------- Customers (staff lookup) ---------- */

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).optional(),
});

/* ---------- Knowledge base ---------- */

const uploadKnowledgeDocumentSchema = z.object({
  category: z.string().max(60).optional(),
});

const listKnowledgeDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(DOCUMENT_STATUS).optional(),
  category: z.string().max(60).optional(),
  search: z.string().max(120).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  idParamSchema,
  startConversationSchema,
  addMessageSchema,
  listConversationsQuerySchema,
  updateConversationStatusSchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  createOrderSchema,
  updateOrderSchema,
  listOrdersQuerySchema,
  createTicketSchema,
  updateTicketSchema,
  addTicketNoteSchema,
  listTicketsQuerySchema,
  listCustomersQuerySchema,
  uploadKnowledgeDocumentSchema,
  listKnowledgeDocumentsQuerySchema,
};
