"use client";

import Link from "next/link";
import {
  ChevronDown,
  Clock3,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  SportsbookFeatureIcon,
  type SportsbookFeatureIconKind,
} from "@/components/ui/SportsbookFeatureIcon";

export type OpenBetTicketSelection = {
  event: string;
  href?: string;
  id: string;
  isLive?: boolean;
  label: string;
  liveScore?: string;
  liveStatus?: string;
  odds: string;
  startTime?: string;
  status: string;
  statusKind?: "pending" | "ongoing" | "won" | "lost" | "void";
};

export function OpenBetTicket({
  betTypeLabel,
  betFeatures = [],
  cashoutAmountLabel,
  cashoutAvailable,
  cashoutLoading,
  expanded,
  hiddenCount,
  onCashout,
  onRebet,
  onToggle,
  potentialWinLabel,
  previewSelections,
  rebetAvailable,
  selections,
  stakeLabel,
}: {
  betTypeLabel: string;
  betFeatures?: SportsbookFeatureIconKind[];
  cashoutAmountLabel: string;
  cashoutAvailable: boolean;
  cashoutLoading?: boolean;
  expanded: boolean;
  hiddenCount: number;
  onCashout: () => void;
  onRebet: () => void;
  onToggle: () => void;
  potentialWinLabel: string;
  previewSelections: OpenBetTicketSelection[];
  rebetAvailable: boolean;
  selections: OpenBetTicketSelection[];
  stakeLabel: string;
}) {
  const fullDetailLabel = expanded ? "Hide match details" : "View match details";

  return (
    <article className="rounded-xl border border-white/6 bg-surface-elevated p-3 text-left">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold leading-none text-white">{betTypeLabel}</h3>
            {betFeatures.length ? (
              <div className="inline-flex items-center gap-1.5">
                {betFeatures.map((feature) => (
                  <SportsbookFeatureIcon
                    key={feature}
                    kind={feature}
                    variant="title"
                    className="h-[14px] w-[16px] shrink-0"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {rebetAvailable ? (
          <button
            type="button"
            onClick={onRebet}
            className="inline-flex items-center gap-2 text-base font-semibold text-white/80 transition"
          >
            <RotateCcw size={14} />
            Rebet
          </button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-white/8 pt-5">
        {expanded ? (
          selections.length ? (
            <div className="space-y-3">
              {selections.map((selection) => (
                <SelectionRow key={selection.id} selection={selection} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-lg font-semibold text-white">Selection details unavailable</p>
              <p className="mt-2 text-base leading-6 text-white/50">
                This ticket was returned without expanded selection rows.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {previewSelections.map((selection) => (
              <p key={selection.id} className="truncate text-md font-semibold text-white">
                {selection.event || selection.label}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="mt-5 flex w-full items-center justify-between border-t border-white/8 pt-4 text-left"
        >
          <span className="min-w-0 truncate text-md text-white/45">
            {!expanded && hiddenCount > 0
              ? `and ${hiddenCount} other match${hiddenCount === 1 ? "" : "es"}`
              : " "}
          </span>
          <span className="inline-flex items-center gap-2 text-lg font-semibold text-text-label">
            {fullDetailLabel}
            <ChevronDown size={16} className={`transition ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>
      </div>

      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xl">
          <span className="text-white/70">Stake</span>
          <span className="text-right text-2xl font-black text-white">{stakeLabel}</span>
          <span className="text-white/70">Pot. Win</span>
          <span className="text-right text-2xl font-black text-white">{potentialWinLabel}</span>
        </div>

        <button
          type="button"
          onClick={onCashout}
          disabled={!cashoutAvailable}
          className="app-button app-button-primary mt-4 w-full font-black disabled:bg-white/10 disabled:text-white/45"
        >
          {cashoutLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {cashoutLoading
            ? "Processing cashout"
            : cashoutAvailable
              ? `Cashout ${cashoutAmountLabel}`
              : "Cashout unavailable"}
        </button>
      </div>
    </article>
  );
}

function SelectionRow({ selection }: { selection: OpenBetTicketSelection }) {
  const appearance = getSelectionAppearance(selection);
  const content = (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/6 px-3 py-3 transition ${appearance.surfaceClassName} ${
        selection.href ? "hover:border-white/12 hover:bg-white/[0.06]" : ""
      }`}
    >
      <span className={`absolute inset-y-0 left-0 block w-[3px] ${appearance.railClassName}`} />
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xl font-bold text-white">
            {selection.label} @ {selection.odds}
          </span>
        </div>
        <p className="mt-2 text-md text-white/82">{selection.event}</p>
        {selection.isLive && selection.liveStatus ? (
          <div className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
            <span className="font-semibold text-[var(--primary-orange)]">{selection.liveStatus}</span>
            {selection.liveScore ? (
              <span className="font-semibold text-white/72">{selection.liveScore}</span>
            ) : null}
          </div>
        ) : selection.startTime ? (
          <div className="mt-2 inline-flex items-center gap-2 text-base text-white/45">
            <Clock3 size={14} />
            <span>{selection.startTime}</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!selection.href) {
    return content;
  }

  return (
    <Link href={selection.href} className="block">
      {content}
    </Link>
  );
}

function getSelectionAppearance(selection: OpenBetTicketSelection) {
  switch (selection.statusKind) {
    case "won":
      return {
        railClassName: "bg-[#15803D]",
        surfaceClassName: "bg-[#E2F5E9]/[0.08]",
      };
    case "lost":
      return {
        railClassName: "bg-[#D22B34]",
        surfaceClassName: "bg-[#D22B34]/[0.08]",
      };
    case "void":
      return {
        railClassName: "bg-[#DDDED9]",
        surfaceClassName: "bg-white/[0.03]",
      };
    case "ongoing":
      return {
        railClassName: "bg-[var(--lime)]",
        surfaceClassName: "bg-[var(--lime)]/[0.08]",
      };
    default:
      return {
        railClassName: "bg-white/18",
        surfaceClassName: "bg-white/[0.03]",
      };
  }
}
