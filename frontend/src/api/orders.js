import client from "./client";

export const ordersApi = {
  list: (params) => client.get("/orders", { params }).then((r) => r.data),
  get: (id) => client.get(`/orders/${id}`).then((r) => r.data.data.order),
  getByNumber: (orderNumber) =>
    client.get(`/orders/by-number/${orderNumber}`).then((r) => r.data.data.order),
  create: (payload) => client.post("/orders", payload).then((r) => r.data.data.order),
  update: (id, payload) => client.patch(`/orders/${id}`, payload).then((r) => r.data.data.order),
};
