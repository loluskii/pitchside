"use client";

import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCouponStore } from "@/store/couponStore";
import { useUIStore } from "@/store/uiStore";

export function BetSlipLauncher() {
  const pathname = usePathname();
  const showMobileNavigation = useUIStore((state) => state.showMobileNavigation);
  const { selections, toggleOpen, recordAbandonedBetslipInteraction } = useCouponStore();
  const selectionCount = selections.length;
  const isChromelessRoute =
    pathname === "/live" ||
    /^\/sports\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/live\/[^/]+\/[^/]+$/.test(pathname);

  // if (selectionCount === 0) return null;

  return (
    <button
      onClick={() => {
        recordAbandonedBetslipInteraction();
        toggleOpen();
      }}
      className={cn(
        "app-floating-action fixed right-[max(0.75rem,calc(50%-232px+18px))] z-sticky bg-[#EEEFEC] text-white shadow-md",
        showMobileNavigation && !isChromelessRoute
          ? "betslip-launcher-above-nav"
          : "bottom-5",
      )}
      type="button"
      aria-label={`Open bet slip with ${selectionCount} selection${selectionCount === 1 ? "" : "s"}`}
    >
      <Ticket size={18} className="text-white" />
      {
        selectionCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CBEA4E] px-1 text-xs font-black text-white">
            {selectionCount}
          </span>
        )
      }
    </button>
  );
}
