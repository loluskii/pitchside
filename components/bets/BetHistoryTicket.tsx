"use client";

import { ChevronRight, Copy, RotateCcw } from "lucide-react";

export type BetHistoryTicketSelectionPreview = {
  event: string;
  id: string;
  label: string;
};

type BetHistoryTicketStatusTone = "cancelled" | "cashout" | "lost" | "pending" | "won";

const STATUS_TONE_STYLES: Record<
  BetHistoryTicketStatusTone,
  { badgeClassName: string; textClassName: string }
> = {
  cancelled: {
    badgeClassName: "bg-surface-warning text-text-gold",
    textClassName: "text-text-gold",
  },
  cashout: {
    badgeClassName: "bg-surface-warning text-text-gold",
    textClassName: "text-text-gold",
  },
  lost: {
    badgeClassName: "bg-[#D22B34] text-accent-pink",
    textClassName: "text-accent-pink",
  },
  pending: {
    badgeClassName: "bg-surface-icon text-text-blue",
    textClassName: "text-text-blue",
  },
  won: {
    badgeClassName: "bg-[#15803D] text-text-success",
    textClassName: "text-text-success",
  },
};

export function BetHistoryTicket({
  betTypeLabel,
  bookingCodeLabel,
  dateDayLabel,
  dateMonthLabel,
  dateTimeLabel,
  bookingCodeCopied,
  onCopyBookingCode,
  onClick,
  onRebet,
  previewSelections,
  rebetAvailable,
  returnCaption,
  returnLabel,
  selectionCountLabel,
  stakeLabel,
  statusLabel,
  statusTone,
  totalOddsLabel,
  showDateBadge = true,
}: {
  betTypeLabel: string;
  bookingCodeLabel: string;
  bookingCodeCopied?: boolean;
  dateDayLabel: string;
  dateMonthLabel: string;
  dateTimeLabel: string;
  onCopyBookingCode?: () => void;
  onClick: () => void;
  onRebet?: () => void;
  previewSelections: BetHistoryTicketSelectionPreview[];
  rebetAvailable: boolean;
  returnCaption: string;
  returnLabel: string;
  selectionCountLabel: string;
  stakeLabel: string;
  statusLabel: string;
  statusTone: BetHistoryTicketStatusTone;
  totalOddsLabel: string;
  showDateBadge?: boolean;
}) {
  const appearance = STATUS_TONE_STYLES[statusTone];
  const returnValueClassName = statusTone === "won" ? "text-accent-green" : "text-white";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="w-full text-left border-b border-white/6 pb-4"
    >
      <div className={`flex items-start ${showDateBadge ? "gap-4" : ""}`}>
        {showDateBadge ? (
          <div className="flex w-[56px] shrink-0 flex-col items-center rounded-2xl bg-surface-betslip px-2 py-3 text-center">
            <span className="text-6xl font-bold leading-none text-white">{dateDayLabel}</span>
            <span className="mt-2 text-base font-semibold uppercase tracking-[0.12em] text-white/42">
              {dateMonthLabel}
            </span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ECEDEA] px-3 py-1 text-sm font-black uppercase tracking-[0.12em] text-text-blue">
                  {betTypeLabel}
                </span>
                <span className={`text-md font-bold ${appearance.textClassName}`}>{statusLabel}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {previewSelections.map((selection) => (
              <p key={selection.id} className="truncate text-base font-semibold text-white/82">
                {selection.event || selection.label}
              </p>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-base">
            <StatTile label="Stake" value={stakeLabel} />
            <StatTile label={returnCaption} value={returnLabel} valueClassName={returnValueClassName} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {bookingCodeLabel ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyBookingCode?.();
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-base font-bold text-white/72"
                >
                  <Copy size={13} className="shrink-0" />
                  <span className="truncate">{bookingCodeCopied ? "Copied" : bookingCodeLabel}</span>
                </button>
              ) : null}
              {rebetAvailable && onRebet ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRebet();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--lime)] px-2.5 py-2 text-base font-black text-white"
                >
                  <RotateCcw size={13} />
                  Rebet
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 text-md font-black text-[var(--primary-orange)]">
                View details
                <ChevronRight size={16} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatTile({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F0F1EF] px-3 py-3">
      <p className="text-white/42">{label}</p>
      <p className={`mt-2 text-xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}
