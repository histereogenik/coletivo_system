import axios, { AxiosHeaders, type AxiosRequestConfig } from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.sistemacoletivo.com.br";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const isUnsafeMethod = (method?: string) =>
  ["post", "put", "patch", "delete"].includes((method || "").toLowerCase());

export async function ensureCsrfCookie() {
  if (getCookie("csrftoken")) {
    return getCookie("csrftoken");
  }

  await api.get("/api/auth/csrf/");
  return getCookie("csrftoken");
}

api.interceptors.request.use((config) => {
  config.withCredentials = true;

  if (isUnsafeMethod(config.method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set("X-CSRFToken", csrfToken);
      config.headers = headers;
    }
  }

  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];
const logoutAndClear = async () => {
  try {
    await ensureCsrfCookie();
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
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
      _csrfRetry?: boolean;
    };
    const hasAuth = sessionStorage.getItem("hasAuth");
    const code = error.response?.data?.code;
    const method = originalRequest?.method?.toLowerCase();
    const detail = String(error.response?.data?.detail ?? "");

    if (
      originalRequest &&
      error.response?.status === 403 &&
      isUnsafeMethod(method) &&
      detail.includes("CSRF") &&
      !originalRequest._csrfRetry
    ) {
      originalRequest._csrfRetry = true;
      await ensureCsrfCookie();
      return api(originalRequest);
    }

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
        await api.post("/api/auth/cookie/token/refresh/");
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
