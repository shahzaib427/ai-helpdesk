import client from "./client";

export const conversationsApi = {
  list: (params) => client.get("/conversations", { params }).then((r) => r.data),
  get: (id) => client.get(`/conversations/${id}`).then((r) => r.data.data.conversation),
  start: (payload) => client.post("/conversations", payload).then((r) => r.data.data.conversation),
  sendMessage: (id, content) =>
    client.post(`/conversations/${id}/messages`, { content }).then((r) => r.data.data.conversation),
  requestHandoff: (id) =>
    client.post(`/conversations/${id}/handoff`).then((r) => r.data.data.conversation),
  takeOver: (id) => client.post(`/conversations/${id}/take-over`).then((r) => r.data.data.conversation),
  updateStatus: (id, status) =>
    client.patch(`/conversations/${id}/status`, { status }).then((r) => r.data.data.conversation),
};
