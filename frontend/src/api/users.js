import client from "./client";

export const usersApi = {
  list: (params) => client.get("/users", { params }).then((r) => r.data),
  create: (payload) => client.post("/users", payload).then((r) => r.data.data.user),
  update: (id, payload) => client.patch(`/users/${id}`, payload).then((r) => r.data.data.user),
  deactivate: (id) => client.delete(`/users/${id}`).then((r) => r.data),
};
