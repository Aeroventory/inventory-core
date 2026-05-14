import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getMe, loginRequest } from "@/services/auth-endpoints";
import { setAuthTokenProvider, setUnauthorizedHandler } from "@/services/axios-config";
import { AuthUser } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  canAccessPlanner: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      initialized: false,
      login: async (username, password) => {
        set({ loading: true });
        try {
          const tokenResponse = await loginRequest(username, password);
          set({ token: tokenResponse.data.access_token });
          const userResponse = await getMe();
          set({
            user: userResponse.data,
            loading: false,
            initialized: true,
          });
        } catch (error) {
          set({ token: null, user: null, loading: false, initialized: true });
          throw error;
        }
      },
      logout: () => {
        set({ token: null, user: null, loading: false, initialized: true });
      },
      refreshUser: async () => {
        if (!get().token) {
          set({ user: null, loading: false, initialized: true });
          return;
        }

        set({ loading: true });
        try {
          const userResponse = await getMe();
          set({ user: userResponse.data, loading: false, initialized: true });
        } catch {
          get().logout();
        }
      },
      isAuthenticated: () => Boolean(get().token && get().user),
      isAdmin: () => get().user?.role === "admin",
      canAccessPlanner: () => {
        const role = get().user?.role;
        return role === "admin" || role === "planner";
      },
    }),
    {
      name: "inventory_core_auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token }),
    },
  ),
);

setAuthTokenProvider(() => useAuthStore.getState().token);
setUnauthorizedHandler(() => useAuthStore.getState().logout());
