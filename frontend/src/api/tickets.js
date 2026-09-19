import client from "./client";

export const ticketsApi = {
  list: (params) => client.get("/tickets", { params }).then((r) => r.data),
  get: (id) => client.get(`/tickets/${id}`).then((r) => r.data.data.ticket),
  create: (payload) => client.post("/tickets", payload).then((r) => r.data.data.ticket),
  updateStatus: (id, status) =>
    client.patch(`/tickets/${id}/status`, { status }).then((r) => r.data.data.ticket),
  updatePriority: (id, priority) =>
    client.patch(`/tickets/${id}/priority`, { priority }).then((r) => r.data.data.ticket),
  assign: (id, assignedAgentId) =>
    client.patch(`/tickets/${id}/assign`, { assignedAgentId }).then((r) => r.data.data.ticket),
  addNote: (id, content) =>
    client.post(`/tickets/${id}/notes`, { content }).then((r) => r.data.data.ticket),
};
