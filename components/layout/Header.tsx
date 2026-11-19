"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Mail, Search } from "lucide-react";
import { PitchsideLogo } from "@/components/brand/Logo";
import { preloadAuthModalViews, useAuthModal } from "@/components/auth/AuthModalProvider";
import { authApi, extractNotificationItems } from "@/lib/api/auth";
import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

function formatHeaderBalance(currency = "NGN", amount = 0) {
  const normalizedCurrency = currency.trim() || "NGN";
  const normalizedAmount = Number(amount ?? 0);

  void normalizedCurrency;
  return `${normalizedAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const currentUser = useUserStore((state) => state.currentUser);
  const { openCreateAccount, openLogin } = useAuthModal();

  const balanceLabel = formatHeaderBalance(
    currentUser?.currency ?? "NGN",
    currentUser?.availableBalance ?? 0,
  );
  const currentPath =
    typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}`;
  const { data: notificationPayload } = useQuery({
    queryKey: queryKeys.user.notifications,
    queryFn: authApi.getNotifications,
    enabled: hasMounted && authHasHydrated && isAuthenticated,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
  const hasNotifications = extractNotificationItems(notificationPayload).some(
    (notification) => Number(notification.status ?? 0) === 0,
  );

  return (
    <header className="app-header p-2">
      <Link href="/" aria-label="Go to home" className="inline-flex">
        <PitchsideLogo size={30} />
      </Link>
      <div className="header-actions">
        <button
          type="button"
          aria-label="Search"
          className="header-search-button"
          onClick={() => router.push("/search")}
        >
          <Search className="size-5" strokeWidth={2.2} />
        </button>
        {!hasMounted || !authHasHydrated ? (
          <div className="h-10" aria-hidden="true" />
        ) : isAuthenticated ? (
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] py-1.5 pl-1.5 pr-3.5 text-paper"
          >
            <span className="grid size-7 place-items-center rounded-full bg-[var(--lime)] font-heading text-[13px] font-extrabold text-[var(--ink)]">
              ₦
            </span>
            <span className="flex min-w-0 flex-col items-start leading-none py-1">
              <span className="font-mono text-[13px] font-semibold tabular-nums">
                {currentUser ? balanceLabel : "Loading..."}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <button
              type="button"
              onFocus={preloadAuthModalViews}
              onClick={() => openLogin(currentPath)}
              onPointerEnter={preloadAuthModalViews}
              onPointerDown={preloadAuthModalViews}
              className="custom-app-button btn-outline inline-flex items-center justify-center"
            >
              Log in
            </button>
            <button
              type="button"
              onFocus={preloadAuthModalViews}
              onClick={() => openCreateAccount(currentPath)}
              onPointerEnter={preloadAuthModalViews}
              onPointerDown={preloadAuthModalViews}
              className="custom-app-button btn-gradient inline-flex items-center justify-center"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </header>
  );
}
