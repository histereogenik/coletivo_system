import axios, { type AxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
});

api.interceptors.request.use((config) => {
  config.withCredentials = true;
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];
const logoutAndClear = async () => {
  try {
    await api.post("/api/auth/logout/", {}, { withCredentials: true });
  } catch {
    // ignore logout errors
  }
  sessionStorage.removeItem("hasAuth");
  pendingRequests = [];
  isRefreshing = false;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const hasAuth = sessionStorage.getItem("hasAuth");
    const code = error.response?.data?.code;
    const method = originalRequest?.method?.toLowerCase();

    // If token is explicitly invalid, logout and retry GETs as public
    if (error.response?.status === 401 && code === "token_not_valid") {
      await logoutAndClear();
      if (method === "get") {
        return api(originalRequest);
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && hasAuth && !originalRequest._retry) {
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
        await logoutAndClear();
        if (method === "get") {
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
