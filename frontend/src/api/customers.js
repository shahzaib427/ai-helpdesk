import client from "./client";

export const customersApi = {
  list: (params) => client.get("/customers", { params }).then((r) => r.data),
  get: (id) => client.get(`/customers/${id}`).then((r) => r.data.data.customer),
};
