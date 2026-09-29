import { io } from "socket.io-client";
import { tokenStore } from "./api/client";

let socket;

// One shared connection for the whole app, created lazily on first use and
// authenticated with the same JWT the REST client already stores.
export function getSocket() {
  if (socket) return socket;

  const token = tokenStore.get();
  const url = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

  socket = io(url, {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}