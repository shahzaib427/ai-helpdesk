import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "helpdesk.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn every failure into a plain Error with a message worth showing a person,
// plus field-level details when the backend sent them.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }

    const payload = error.response?.data;
    const normalised = new Error(
      payload?.message || error.message || "Could not reach the server"
    );
    normalised.status = error.response?.status;
    normalised.details = payload?.details || null;
    return Promise.reject(normalised);
  }
);

export default client;
