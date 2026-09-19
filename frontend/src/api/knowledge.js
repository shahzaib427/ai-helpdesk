import client from "./client";

export const knowledgeApi = {
  list: (params) => client.get("/knowledge", { params }).then((r) => r.data),
  get: (id) => client.get(`/knowledge/${id}`).then((r) => r.data.data.document),
  upload: (file, category) => {
    const formData = new FormData();
    formData.append("file", file);
    if (category) formData.append("category", category);
    // Override the instance's default JSON Content-Type so the browser sets
    // multipart/form-data with the correct boundary itself. Passing that
    // header explicitly here (rather than letting axios auto-detect
    // FormData) would omit the boundary and break parsing on the server.
    return client
      .post("/knowledge", formData, { headers: { "Content-Type": undefined } })
      .then((r) => r.data.data.document);
  },
  reindex: (id) => client.post(`/knowledge/${id}/reindex`).then((r) => r.data.data.document),
  remove: (id) => client.delete(`/knowledge/${id}`).then((r) => r.data),
};
