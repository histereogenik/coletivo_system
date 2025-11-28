import axios from "axios";
import { getAccessToken, getRefreshToken, updateAccessToken, clearTokens } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        isRefreshing = false;
        return Promise.reject(error);
      }
      try {
        const { data } = await api.post<{ access: string }>("/api/auth/token/refresh/", {
          refresh,
        });
        updateAccessToken(data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        pendingRequests.forEach((cb) => cb(data.access));
        pendingRequests = [];
        return api(originalRequest);
      } catch (refreshErr) {
        clearTokens();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export { api };
