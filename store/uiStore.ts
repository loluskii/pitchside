import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SportSlug, MarketType } from "@/types";
import type { SportsbookGlobalVars } from "./couponStore";

export type ActiveBetView = "open" | "settled";

interface UIState {
  // Navigation / sport context
  activeSport: SportSlug;
  activeMarket: MarketType;
  searchQuery: string;

  // Betslip visibility helpers
  showBetslipCount: boolean;

  // Bottom navigation / layout visibility
  showFooter: boolean;
  showMobileNavigation: boolean;

  // Bet history view toggle
  activeBetView: ActiveBetView;

  // Global sportsbook config fetched once at app init
  sportsbookGlobalVars: SportsbookGlobalVars | null;

  // ─── Actions ────────────────────────────────────────────────────────────

  setActiveSport: (sport: SportSlug) => void;
  setActiveMarket: (market: MarketType) => void;
  setSearchQuery: (query: string) => void;
  setShowBetslipCount: (v: boolean) => void;
  setShowFooter: (v: boolean) => void;
  setShowMobileNavigation: (v: boolean) => void;
  setActiveBetView: (view: ActiveBetView) => void;
  setSportsbookGlobalVars: (vars: SportsbookGlobalVars) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeSport: "football",
      activeMarket: "1x2",
      searchQuery: "",
      showBetslipCount: true,
      showFooter: true,
      showMobileNavigation: true,
      activeBetView: "open",
      sportsbookGlobalVars: null,

      setActiveSport: (activeSport) => set({ activeSport }),
      setActiveMarket: (activeMarket) => set({ activeMarket }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setShowBetslipCount: (showBetslipCount) => set({ showBetslipCount }),
      setShowFooter: (showFooter) => set({ showFooter }),
      setShowMobileNavigation: (showMobileNavigation) => set({ showMobileNavigation }),
      setActiveBetView: (activeBetView) => set({ activeBetView }),
      setSportsbookGlobalVars: (sportsbookGlobalVars) => set({ sportsbookGlobalVars }),
    }),
    {
      name: "pitchside-ui",
      partialize: (state) => ({
        activeSport: state.activeSport,
        activeMarket: state.activeMarket,
        activeBetView: state.activeBetView,
      }),
    }
  )
);
