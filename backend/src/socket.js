"use strict";
const { Server } = require("socket.io");
const config = require("./config/env");
const { verifyAccessToken } = require("./utils/jwt");
const { User } = require("./models");
const { ROLES } = require("./config/constants");

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin.split(",").map((o) => o.trim()),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing token"));
      const payload = verifyAccessToken(token);
      const user = await User.findByPk(payload.sub);
      if (!user || !user.isActive) return next(new Error("Invalid session"));
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;

    if (user.role === ROLES.AGENT || user.role === ROLES.ADMIN) {
      socket.join("staff");
    }
    socket.join(`user:${user.id}`);

    socket.on("conversation:join", (conversationId) => {
      socket.join(conversationRoom(conversationId));
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(conversationRoom(conversationId));
    });

    // Relayed, not stored — typing state is ephemeral. Broadcast to
    // everyone else in the room except the sender, so a customer sees
    // "Agent is typing…" and vice versa, never their own typing echoed back.
    socket.on("typing:start", (conversationId) => {
      socket.to(conversationRoom(conversationId)).emit("typing:start", {
        conversationId,
        senderType: user.role === ROLES.CUSTOMER ? "CUSTOMER" : "AGENT",
        name: user.firstName,
      });
    });

    socket.on("typing:stop", (conversationId) => {
      socket.to(conversationRoom(conversationId)).emit("typing:stop", { conversationId });
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized — call initSocket() first");
  return io;
}

function conversationRoom(id) {
  return `conversation:${id}`;
}

module.exports = { initSocket, getIO, conversationRoom };