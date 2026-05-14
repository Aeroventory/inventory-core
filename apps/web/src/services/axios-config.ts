import axios from "axios";

let authTokenProvider: (() => string | null) | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const setAuthTokenProvider = (provider: () => string | null) => {
  authTokenProvider = provider;
};

export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8003",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = authTokenProvider?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login")) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export default api;
