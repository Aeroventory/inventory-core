import { AuthToken, AuthUser } from "@/types/auth";

import api from "./axios-config";

export const loginRequest = (username: string, password: string) => {
  const formData = new URLSearchParams();
  formData.set("username", username);
  formData.set("password", password);

  return api.post<AuthToken>("/auth/login", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

export const getMe = () => {
  return api.get<AuthUser>("/auth/me");
};
