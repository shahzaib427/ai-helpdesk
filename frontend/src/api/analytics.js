import client from "./client";

export const analyticsApi = {
  overview: () => client.get("/analytics/overview").then((r) => r.data.data),
  charts: () => client.get("/analytics/charts").then((r) => r.data.data),
};
