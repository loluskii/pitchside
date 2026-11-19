import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchCurrentUserProfile } from "@/lib/auth/user-profile";

export interface UserProfile {
  id: string | number;
  username: string;
  mobileNumber?: string;
  phone?: string;
  email?: string;
  availableBalance: number;
  sportBonusBalance: number;
  casinoBonusBalance: number;
  virtualBonusBalance: number;
  trustBalance: number;
  currency?: string;
  kycStatus?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  gender?: string;
  dateOfBirth?: string;
  [key: string]: unknown;
}

export interface ActiveBonus {
  id?: string | number;
  bonusType?: string;
  amount?: number;
  expiresAt?: string;
  [key: string]: unknown;
}

function formatBalance(value: number | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UserState {
  currentUser: UserProfile | null;
  activeBonus: ActiveBonus | null;
  activeCashback: ActiveBonus | null;
  casinoActiveBonus: ActiveBonus | null;
  error: string | null;

  setCurrentUser: (user: UserProfile) => void;
  refreshCurrentUser: (fallbackUsername?: string) => Promise<UserProfile>;
  setActiveBonus: (bonus: ActiveBonus | null) => void;
  setActiveCashback: (cashback: ActiveBonus | null) => void;
  setCasinoActiveBonus: (bonus: ActiveBonus | null) => void;
  updateBalance: (balance: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  currentUser: null,
  activeBonus: null,
  activeCashback: null,
  casinoActiveBonus: null,
  error: null,
};

let currentUserRefreshKey = "";
let currentUserRefreshPromise: Promise<UserProfile> | null = null;
let currentUserRefreshRequestId = 0;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setCurrentUser: (currentUser) => set({ currentUser, error: null }),

      refreshCurrentUser: (fallbackUsername) => {
        const existingUser = get().currentUser;
        const refreshKey = fallbackUsername ?? existingUser?.username ?? "";

        if (currentUserRefreshPromise && currentUserRefreshKey === refreshKey) {
          return currentUserRefreshPromise;
        }

        currentUserRefreshKey = refreshKey;
        const requestId = currentUserRefreshRequestId + 1;
        currentUserRefreshRequestId = requestId;
        currentUserRefreshPromise = fetchCurrentUserProfile(
          fallbackUsername ?? existingUser?.username,
        )
          .then((currentUser) => {
            if (requestId === currentUserRefreshRequestId) {
              set({ currentUser, error: null });
            }
            return currentUser;
          })
          .catch((error) => {
            if (requestId === currentUserRefreshRequestId) {
              set({
                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to load your account details.",
              });
            }
            throw error;
          })
          .finally(() => {
            if (requestId === currentUserRefreshRequestId) {
              currentUserRefreshKey = "";
              currentUserRefreshPromise = null;
            }
          });

        return currentUserRefreshPromise;
      },

      setActiveBonus: (activeBonus) => set({ activeBonus }),

      setActiveCashback: (activeCashback) => set({ activeCashback }),

      setCasinoActiveBonus: (casinoActiveBonus) => set({ casinoActiveBonus }),

      updateBalance: (balance) =>
        set((state) =>
          state.currentUser
            ? { currentUser: { ...state.currentUser, availableBalance: balance } }
            : {}
        ),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: "pitchside-user",
      partialize: (state) => ({
        currentUser: state.currentUser,
        activeBonus: state.activeBonus,
        activeCashback: state.activeCashback,
        casinoActiveBonus: state.casinoActiveBonus,
      }),
    }
  )
);

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectBalance = (state: UserState) =>
  formatBalance(state.currentUser?.availableBalance);

export const selectSportBonusBalance = (state: UserState) =>
  formatBalance(state.currentUser?.sportBonusBalance);

export const selectCasinoBonusBalance = (state: UserState) =>
  formatBalance(state.currentUser?.casinoBonusBalance);

export const selectVirtualBonusBalance = (state: UserState) =>
  formatBalance(state.currentUser?.virtualBonusBalance);

export const selectTrustBalance = (state: UserState) =>
  formatBalance(state.currentUser?.trustBalance);

export const selectRawBalance = (state: UserState) =>
  Number(state.currentUser?.availableBalance ?? 0);
