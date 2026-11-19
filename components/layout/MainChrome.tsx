"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BetSlipLauncher } from "@/components/layout/BetSlipLauncher";
import { BackToTopButton } from "@/components/layout/BackToTopButton";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { Header } from "@/components/layout/Header";
import { PageFooter } from "@/components/layout/PageFooter";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";
import { useUIStore } from "@/store/uiStore";
import { useUserStore } from "@/store/userStore";

const BetSlip = dynamic(
  () => import("@/components/betting/BetSlip").then((mod) => mod.BetSlip),
  { ssr: false, loading: () => null },
);

const NotificationPrompt = dynamic(
  () => import("@/components/layout/NotificationPrompt").then((mod) => mod.NotificationPrompt),
  { ssr: false, loading: () => null },
);

export function MainChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showMobileNavigation = useUIStore((state) => state.showMobileNavigation);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUserId = useUserStore((state) => state.currentUser?.id ?? null);
  const couponIsOpen = useCouponStore((state) => state.isOpen);
  const couponDialog = useCouponStore((state) => state.dialog);
  const isChromelessRoute =
    pathname === "/live" ||
    /^\/sports\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/live\/[^/]+\/[^/]+$/.test(pathname);
  const isSportsHubRoute = pathname === "/sports";
  const isAccountRoute = pathname === "/account";
  const shouldShowHeader = !isChromelessRoute && !isAccountRoute;
  const shouldShowFooter =
    !isChromelessRoute && !isSportsHubRoute && pathname !== "/my-bets" && !isAccountRoute;
  const shouldHideBackToTop = couponIsOpen || Boolean(couponDialog);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    Object.assign(window, {
      __PITCHSIDE_DEV_STORES__: {
        authStore: useAuthStore,
        couponStore: useCouponStore,
        uiStore: useUIStore,
        userStore: useUserStore,
      },
    });

    return () => {
      delete (window as Window & { __PITCHSIDE_DEV_STORES__?: unknown }).__PITCHSIDE_DEV_STORES__;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return undefined;

    const couponStore = useCouponStore.getState();
    couponStore.startAbandonedBetslipTracker();

    return () => {
      couponStore.stopAbandonedBetslipTracker();
    };
  }, [currentUserId, isAuthenticated]);

  return (
    <>
      {shouldShowHeader ? <Header /> : null}
      <main
        className={cn(
          "flex flex-col gap-y-3 px-2.5 pt-3",
          isAccountRoute && "p-0 gap-y-0",
          !isChromelessRoute && showMobileNavigation && "pb-20",
        )}
      >
        {children}
        {shouldShowFooter ? <PageFooter /> : null}
      </main>
      {!isChromelessRoute && showMobileNavigation ? <MobileNavigation /> : null}
      <BetSlipLauncher />
      <BetSlip />
      <NotificationPrompt />
      <BackToTopButton blocked={shouldHideBackToTop} />
    </>
  );
}
