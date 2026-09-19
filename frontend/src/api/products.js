import client from "./client";

export const productsApi = {
  list: (params) => client.get("/products", { params }).then((r) => r.data),
  get: (id) => client.get(`/products/${id}`).then((r) => r.data.data.product),
  create: (payload) => client.post("/products", payload).then((r) => r.data.data.product),
  update: (id, payload) => client.patch(`/products/${id}`, payload).then((r) => r.data.data.product),
  retire: (id) => client.delete(`/products/${id}`).then((r) => r.data.data.product),
  reactivate: (id) => client.post(`/products/${id}/reactivate`).then((r) => r.data.data.product),
};
