import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import { AUTH_TOKEN_KEY } from "@/lib/auth/session";
import { useUserStore } from "@/store/userStore";

const COOKIE_OPTIONS = { expires: 7, path: "/", sameSite: "strict" as const };

interface AuthState {
  mobileNumber: string | null;
  token: string | null;
  isAuthenticated: boolean;
  returnUrl: string;
  loading: boolean;
  authError: string | null;
  hasHydrated: boolean;
  setAuth: (token: string, mobileNumber: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setReturnUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      mobileNumber: null,
      token: null,
      isAuthenticated: false,
      returnUrl: "",
      loading: false,
      authError: null,
      hasHydrated: false,

      setAuth: (token, mobileNumber) => {
        Cookies.set(AUTH_TOKEN_KEY, token, COOKIE_OPTIONS);
        set({
          token,
          mobileNumber,
          isAuthenticated: true,
          authError: null,
          loading: false,
        });
      },

      setLoading: (loading) => set({ loading }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setAuthError: (authError) => set({ authError }),

      setReturnUrl: (returnUrl) => set({ returnUrl }),

      logout: () => {
        Cookies.remove(AUTH_TOKEN_KEY, { path: "/" });
        useUserStore.getState().reset();
        set({
          token: null,
          mobileNumber: null,
          isAuthenticated: false,
          returnUrl: "",
          loading: false,
          authError: null,
        });
      },
    }),
    {
      name: "pitchside-auth",
      partialize: (state) => ({
        mobileNumber: state.mobileNumber,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        returnUrl: state.returnUrl,
      }),
      onRehydrateStorage: () => (state) => {
        // Keep cookie in sync with persisted token on page load
        if (state?.token) {
          Cookies.set(AUTH_TOKEN_KEY, state.token, COOKIE_OPTIONS);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export function getToken(): string | null {
  return Cookies.get(AUTH_TOKEN_KEY) ?? null;
}
