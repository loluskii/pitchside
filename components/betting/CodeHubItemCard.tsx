"use client";

import { Share2 } from "lucide-react";

export type CodeHubItemCardSelection = {
  eventName: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  startTime: string;
};

export type CodeHubItemCardData = {
  code: string;
  totalOdds: number;
  selections: CodeHubItemCardSelection[];
};

type CodeHubItemCardProps = {
  item: CodeHubItemCardData;
  disabled?: boolean;
  onAdd: (code: string) => void;
  onShare?: (item: CodeHubItemCardData) => void;
};

export function CodeHubItemCard({
  disabled,
  item,
  onAdd,
  onShare,
}: CodeHubItemCardProps) {
  const handleShare = () => {
    if (onShare) {
      onShare(item);
      return;
    }

    if (navigator.share) {
      void navigator.share({
        title: "Pitchside booking code",
        text: `Booking code: ${item.code}`,
      });
      return;
    }

    void navigator.clipboard.writeText(item.code);
  };

  return (
    <div className="codes-card betslip-codes-card betslip-code-card">
      <div className="betslip-code-card-header">
        <div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAdd(item.code)}
            className="betslip-code-value disabled:opacity-45"
          >
            {item.code}
          </button>
        </div>
        <span className="betslip-code-meta">
          <span>Odds <strong>{item.totalOdds.toFixed(2)}</strong></span>
        </span>
      </div>

      <div className="betslip-code-selections">
        {item.selections.map((selection, selectionIndex) => {
          const startDate = new Date(selection.startTime);
          const startLabel = startDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
          });
          const startTime = startDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={`${item.code}-selection-${selectionIndex}`}
              className="betslip-code-selection"
            >
              <span className="betslip-code-selection-copy">
                <span className="betslip-code-selection-name">
                  {selection.outcomeName} <span>@{selection.odds.toFixed(2)}</span>
                </span>
                <span className="betslip-code-selection-market">
                  {selection.eventName} · {selection.marketName}
                </span>
              </span>
              <span className="betslip-code-selection-time">
                {startLabel} {startTime}
              </span>
            </div>
          );
        })}
      </div>

      <div className="betslip-code-actions">
        <button
          type="button"
          className="betslip-code-action share"
          onClick={handleShare}
        >
          <Share2 size={16} />
          Share
        </button>
        <button
          type="button"
          className="betslip-code-action add"
          disabled={disabled}
          onClick={() => onAdd(item.code)}
        >
          Add to Betslip
        </button>
      </div>
    </div>
  );
}

export function CodeHubItemCardSkeleton() {
  return (
    <div className="codes-card betslip-codes-card betslip-code-card">
      <div className="betslip-code-card-header animate-pulse">
        <div className="h-8 w-24 rounded-lg bg-white/10" />
        <div className="h-8 w-16 rounded-lg bg-white/10" />
      </div>

      <div className="betslip-code-selections">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`codehub-card-skeleton-${index}`} className="betslip-code-selection animate-pulse">
            <div className="betslip-code-selection-copy">
              <div className="h-4 rounded bg-white/10" />
              <div className="h-3 rounded bg-white/5" />
            </div>
            <div className="h-8 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
