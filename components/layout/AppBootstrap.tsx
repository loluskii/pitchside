"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";

export function AppBootstrap() {
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const mobileNumber = useAuthStore((state) => state.mobileNumber);
  const token = useAuthStore((state) => state.token);
  const refreshCurrentUser = useUserStore((state) => state.refreshCurrentUser);
  const resetUser = useUserStore((state) => state.reset);

  useEffect(() => {
    if (!hasMounted) return;

    const couponStore = useCouponStore.getState();
    couponStore.startBetslipRealtimeSync();
    void couponStore.ensureConfigLoaded().then(() => {
      const globalVars = useCouponStore.getState().globalVars;
      if (globalVars) {
        useUIStore.getState().setSportsbookGlobalVars(globalVars);
      }
    });

    return () => {
      couponStore.stopBetslipRealtimeSync();
    };
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || !authHasHydrated) return undefined;

    if (!isAuthenticated) {
      resetUser();
      return undefined;
    }

    refreshCurrentUser(mobileNumber ?? undefined)
      .catch(() => {
        // Keep the persisted session visible if the profile refresh is briefly unavailable.
      });

    return undefined;
  }, [authHasHydrated, hasMounted, isAuthenticated, mobileNumber, refreshCurrentUser, resetUser, token]);

  return null;
}
