"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Dices,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useBetHistory } from "@/lib/query/hooks/useBets";
import { cn } from "@/lib/utils";
import { OPEN_BET_STATUSES } from "@/lib/utils/bet-history";
import { useAuthStore } from "@/store/authStore";

type NavigationIcon = ComponentType<{
  size?: number | string;
  className?: string;
}>;

type NavItemDefinition = {
  badge?: boolean;
  href: string;
  label: string;
  icon: NavigationIcon;
  active: (pathname: string) => boolean;
};

function SportsGridIcon({
  size = 20,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.1075 5.57624C11.3692 6.02707 11.5 6.25248 11.5 6.5C11.5 6.74752 11.3692 6.97293 11.1075 7.42376L9.85804 9.57624C9.59636 10.0271 9.46551 10.2525 9.25 10.3762C9.03449 10.5 8.7728 10.5 8.24943 10.5H5.75057C5.2272 10.5 4.96551 10.5 4.75 10.3762C4.53449 10.2525 4.40364 10.0271 4.14196 9.57624L2.89253 7.42376C2.63084 6.97293 2.5 6.74752 2.5 6.5C2.5 6.25248 2.63084 6.02707 2.89253 5.57624L4.14196 3.42376C4.40364 2.97293 4.53449 2.74752 4.75 2.62376C4.96551 2.5 5.2272 2.5 5.75057 2.5L8.24943 2.5C8.7728 2.5 9.03449 2.5 9.25 2.62376C9.46551 2.74752 9.59636 2.97293 9.85804 3.42376L11.1075 5.57624Z" />
      <path d="M21.1075 11.5762C21.3692 12.0271 21.5 12.2525 21.5 12.5C21.5 12.7475 21.3692 12.9729 21.1075 13.4238L19.858 15.5762C19.5964 16.0271 19.4655 16.2525 19.25 16.3762C19.0345 16.5 18.7728 16.5 18.2494 16.5H15.7506C15.2272 16.5 14.9655 16.5 14.75 16.3762C14.5345 16.2525 14.4036 16.0271 14.142 15.5762L12.8925 13.4238C12.6308 12.9729 12.5 12.7475 12.5 12.5C12.5 12.2525 12.6308 12.0271 12.8925 11.5762L14.142 9.42376C14.4036 8.97293 14.5345 8.74752 14.75 8.62376C14.9655 8.5 15.2272 8.5 15.7506 8.5L18.2494 8.5C18.7728 8.5 19.0345 8.5 19.25 8.62376C19.4655 8.74752 19.5964 8.97293 19.858 9.42376L21.1075 11.5762Z" />
      <path d="M11.1075 16.5762C11.3692 17.0271 11.5 17.2525 11.5 17.5C11.5 17.7475 11.3692 17.9729 11.1075 18.4238L9.85804 20.5762C9.59636 21.0271 9.46551 21.2525 9.25 21.3762C9.03449 21.5 8.7728 21.5 8.24943 21.5H5.75057C5.2272 21.5 4.96551 21.5 4.75 21.3762C4.53449 21.2525 4.40364 21.0271 4.14196 20.5762L2.89253 18.4238C2.63084 17.9729 2.5 17.7475 2.5 17.5C2.5 17.2525 2.63084 17.0271 2.89253 16.5762L4.14196 14.4238C4.40364 13.9729 4.53449 13.7475 4.75 13.6238C4.96551 13.5 5.2272 13.5 5.75057 13.5L8.24943 13.5C8.7728 13.5 9.03449 13.5 9.25 13.6238C9.46551 13.7475 9.59636 13.9729 9.85804 14.4238L11.1075 16.5762Z" />
    </svg>
  );
}

function isRouteActive(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function NavigationItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: NavItemDefinition) {
  const pathname = usePathname();
  const isActive = active(pathname);

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-1 shrink-0 flex-col items-center justify-center"
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={cn(
          "relative flex h-9 items-center justify-center gap-1.5 rounded-full px-3 transition-all duration-200",
          isActive ? "bg-[var(--lime)] text-[var(--ink)]" : "text-paper/60 group-hover:text-paper",
        )}
      >
        <Icon size={18} />
        {isActive ? <span className="text-[12px] font-semibold tracking-[-0.01em]">{label}</span> : null}
        {badge ? (
          <span className="nav-bets-badge absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--flare)] ring-2 ring-[var(--ink)]" />
        ) : null}
      </span>
      {isActive ? null : <span className="sr-only">{label}</span>}
    </Link>
  );
}

export function MobileNavigation() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: openBetsResponse } = useBetHistory(
    {
      page: 1,
      perPage: 1,
      status: OPEN_BET_STATUSES,
    },
    isAuthenticated,
  );
  const openBets = (openBetsResponse as { data?: { data?: unknown[] } } | undefined)?.data?.data;
  const hasOpenBets = isAuthenticated && Array.isArray(openBets) && openBets.length > 0;

  const navItems: NavItemDefinition[] = [
    {
      href: "/",
      label: "Home",
      icon: House,
      active: (currentPathname) => currentPathname === "/",
    },
    {
      href: "/sports",
      label: "Sports",
      icon: SportsGridIcon,
      active: (currentPathname) =>
        isRouteActive(currentPathname, "/sports") || isRouteActive(currentPathname, "/live"),
    },
    {
      href: "/casino",
      label: "Casino",
      icon: Dices,
      active: (currentPathname) => isRouteActive(currentPathname, "/casino"),
    },
    {
      href: "/my-bets",
      label: "Bets",
      icon: ReceiptText,
      badge: hasOpenBets,
      active: (currentPathname) => isRouteActive(currentPathname, "/my-bets"),
    },
    {
      href: "/account",
      label: "Me",
      icon: UserRound,
      active: (currentPathname) =>
        isRouteActive(currentPathname, "/account") ||
        isRouteActive(currentPathname, "/deposit") ||
        isRouteActive(currentPathname, "/withdraw"),
    },
  ];

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+10px)] left-1/2 z-[var(--z-nav)] w-[calc(100%-24px)] max-w-[456px] -translate-x-1/2 rounded-full bg-[var(--ink)] p-1.5 shadow-[0_12px_32px_rgba(18,26,22,0.28)]">
      <div className="flex items-center justify-between gap-1">
        {navItems.map((item) => (
          <NavigationItem key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}
