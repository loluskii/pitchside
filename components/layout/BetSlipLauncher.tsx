"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCouponStore } from "@/store/couponStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Slip bar. Hidden while the slip is empty; once there are picks it docks just above
 * the bottom navigation (or the screen edge on chromeless routes) at full dock width,
 * so it never floats over an odds column.
 */
export function BetSlipLauncher() {
  const pathname = usePathname();
  const showMobileNavigation = useUIStore((state) => state.showMobileNavigation);
  const { selections, toggleOpen, recordAbandonedBetslipInteraction } = useCouponStore();
  const selectionCount = selections.length;
  const isChromelessRoute =
    pathname === "/live" ||
    /^\/sports\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/live\/[^/]+\/[^/]+$/.test(pathname);

  const hasSlip = selectionCount > 0;
  useEffect(() => {
    // A body class instead of a :has() selector, which would re-match on every DOM update.
    document.body.classList.toggle("has-slip", hasSlip);
    return () => document.body.classList.remove("has-slip");
  }, [hasSlip]);

  if (!hasSlip) return null;

  const totalOdds = selections.reduce((product, selection) => {
    const odds = Number(selection.odds);
    return Number.isFinite(odds) && odds > 1 ? product * odds : product;
  }, 1);

  return (
    <button
      onClick={() => {
        recordAbandonedBetslipInteraction();
        toggleOpen();
      }}
      className={cn(
        "slip-bar fixed left-1/2 z-sticky flex h-11 w-[calc(100%-36px)] max-w-[444px] -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-[var(--lime)] pl-2 pr-3 text-[var(--ink)] shadow-[0_10px_28px_rgba(18,26,22,0.28)]",
        showMobileNavigation && !isChromelessRoute ? "slip-bar-above-nav" : "slip-bar-bottom",
      )}
      type="button"
      aria-label={`Open bet slip with ${selectionCount} selection${selectionCount === 1 ? "" : "s"}`}
    >
      <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[var(--ink)] px-1.5 text-xs font-black text-[var(--lime)]">
        {selectionCount}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-bold">
        <Ticket size={16} /> Betslip
      </span>
      <span className="ml-auto font-mono text-sm font-bold tabular-nums">
        {selectionCount > 1 ? `${totalOdds.toFixed(2)} odds` : `@ ${totalOdds.toFixed(2)}`}
      </span>
      <ChevronUp size={18} />
    </button>
  );
}
