import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
});

api.interceptors.request.use((config) => {
  config.withCredentials = true;
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push(() => {
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await api.post<{ access: string }>("/api/auth/cookie/token/refresh/");
        pendingRequests.forEach((cb) => cb());
        pendingRequests = [];
        return api(originalRequest);
      } catch (refreshErr) {
        // Clear cookies server-side and retry GETs without auth to allow public access
        try {
          await api.post("/api/auth/logout/", {}, { withCredentials: true });
        } catch (_) {
          // ignore logout errors
        }
        pendingRequests = [];
        if (originalRequest.method?.toLowerCase() === "get") {
          return api(originalRequest);
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export { api };
