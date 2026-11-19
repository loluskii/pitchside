"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { SportradarWidget } from "@/components/fixtures/SportradarWidget";
import { useBetHistory } from "@/lib/query/hooks/useBets";
import {
  asArray,
  type BetHistorySelection,
  type BetHistoryResponse,
  canRebetBet,
  findBetInResponse,
  findCachedBet,
  formatCompactDateTime,
  getBetHistoryStatusTone,
  getBetTypeLabel,
  getLiveStatusLabel,
  getNumber,
  getSelectionStatusTone,
  getTicketReturnAmount,
  getTotalOdds,
  isPendingBet,
} from "@/lib/utils/bet-history";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";

const STATUS_STYLES = {
  cancelled: {
    badge: "border-[#15803D] bg-surface-warning text-text-gold",
    rail: "bg-[#727566]",
  },
  cashout: {
    badge: "border-[#15803D] bg-surface-warning text-text-gold",
    rail: "bg-[#727566]",
  },
  lost: {
    badge: "border-[#D22B34] bg-[#D22B34] text-accent-pink",
    rail: "bg-[#D22B34]",
  },
  pending: {
    badge: "border-[#23241F] bg-surface-icon text-text-blue",
    rail: "bg-[#2563EB]",
  },
  won: {
    badge: "border-[#15803D] bg-[#15803D] text-text-success",
    rail: "bg-[#15803D]",
  },
} as const;

function formatSelectionMetaDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "--/-- --:--";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${lookup("day")}/${lookup("month")} ${lookup("hour")}:${lookup("minute")}`;
}

function SelectionCard({
  onOpenTracker,
  selection,
}: {
  onOpenTracker: (selection: BetHistorySelection) => void;
  selection: BetHistorySelection;
}) {
  const tone = STATUS_STYLES[getSelectionStatusTone(selection)];
  const liveStatus = getLiveStatusLabel(selection);
  const score = String(selection.score ?? "").trim().replace(":", " - ");
  const matchId = String(selection.eventId ?? "").trim();
  const matchDate = formatSelectionMetaDate(selection.eventDate);
  const rawMarketName = String(selection.marketName ?? "").trim();
  const rawOutcomeName = String(selection.outcomeName ?? "").trim();
  const marketName = rawMarketName || "Market unavailable";
  const outcomeName = rawOutcomeName || "Outcome unavailable";
  const oddsLabel = getNumber(selection.odds).toFixed(2);
  const pickValue = `${outcomeName} @${oddsLabel}`;
  const selectionLabel =
    rawOutcomeName && rawMarketName
      ? `${rawOutcomeName} • ${rawMarketName}`
      : rawOutcomeName || rawMarketName || "Selection";
  const eventName = String(selection.eventName ?? "").trim() || "Fixture unavailable";
  const trackerLabel = liveStatus === "FT" ? "Match Recap" : "Match Tracker";
  const scoreLabel = liveStatus === "FT" ? "FT Score" : liveStatus || "Score";
  const scoreValue = score || "--:--";

  return (
    <article className="relative overflow-hidden rounded-xl border border-white/6 bg-surface-elevated p-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} />

      <div className="pl-3">
        <p className="text-base font-semibold text-white/38">
        Game ID: {matchId || "--"} | {matchDate}
        </p>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-bold text-white">
              {selectionLabel}
              <span className="ml-2 text-white/48">@ {oddsLabel}</span>
            </p>

            <p className="mt-1.5 truncate text-md font-semibold text-white/84">
              {eventName}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-base">
          <p className="text-white/52">
            {scoreLabel}: <span className="ml-1 font-black text-white">{scoreValue}</span>
          </p>
          {matchId ? (
            <button
              type="button"
              onClick={() => onOpenTracker(selection)}
              className="font-bold text-[var(--primary-orange)]"
            >
              {trackerLabel}
            </button>
          ) : null}
        </div>

        <div className="mt-3 overflow-hidden ">
          <div className="grid grid-cols-[72px_1fr] text-base">
            <p className="py-1 font-semibold uppercase tracking-[0.08em] text-white/42">Pick</p>
            <p className="py-1 font-bold text-white">{pickValue}</p>

            <p className="py-1 font-semibold uppercase tracking-[0.08em] text-white/42">Market</p>
            <p className="py-1 font-bold text-white">{marketName}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function TrackerModal({
  onClose,
  selection,
}: {
  onClose: () => void;
  selection: BetHistorySelection;
}) {
  const matchId = String(selection.eventId ?? "").trim();
  const eventName = String(selection.eventName ?? "").trim() || "Fixture tracker";
  const liveStatus = getLiveStatusLabel(selection);
  const widgetName = liveStatus ? "match.lmtPlus" : "headToHead.standalone";

  return (
    <div className="fixed inset-0 z-popover bg-black/78">
      <button
        type="button"
        aria-label="Close match tracker"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border-t border-white/8 bg-[#F6F6F5] shadow-sheet">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--primary-orange)]">
              Match tracker
            </p>
            <h2 className="mt-1 truncate text-2xl font-black text-white">{eventName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/76"
            aria-label="Close match tracker"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-74px)] overflow-y-auto p-4">
          <SportradarWidget
            matchId={matchId}
            title={liveStatus ? "Live tracker" : "Head-to-head stats"}
            widgetName={widgetName}
          />
        </div>
      </div>
    </div>
  );
}

export function BetHistoryDetailView({ betId }: { betId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openLogin } = useAuthModal();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const requestLoadByCode = useCouponStore((state) => state.requestLoadByCode);
  const [copiedCode, setCopiedCode] = useState("");
  const [rebetSubmitting, setRebetSubmitting] = useState(false);
  const [trackerSelection, setTrackerSelection] = useState<BetHistorySelection | null>(null);

  const cachedBet = useMemo(() => findCachedBet(queryClient, betId), [betId, queryClient]);
  const numericBetId = Number(betId);
  const fallbackQuery = useBetHistory(
    {
      id: Number.isFinite(numericBetId) ? numericBetId : betId,
      page: 1,
      perPage: 1,
    },
    authHasHydrated && isAuthenticated && !cachedBet,
  );

  const ticket = useMemo(() => {
    if (cachedBet) return cachedBet;
    return findBetInResponse(fallbackQuery.data as BetHistoryResponse | undefined, betId);
  }, [betId, cachedBet, fallbackQuery.data]);

  const ticketStatus = ticket ? String(ticket.statusDescription ?? "").trim() || "Unknown" : "";
  const ticketTone = ticket ? getBetHistoryStatusTone(ticket) : "pending";
  const selections = ticket ? asArray<BetHistorySelection>(ticket.selections) : [];
  const ticketIsPending = ticket ? isPendingBet(ticket) : false;
  const returnAmount = ticket ? getTicketReturnAmount(ticket) : 0;
  const returnLabel = returnAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const bookingCode = ticket ? String(ticket.shareCode ?? "").trim() : "";
  const formattedStake = Number(ticket?.stake ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedPlacedAt = ticket ? formatCompactDateTime(ticket.created) : "";

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/my-bets");
  };

  const handleCopyCode = async () => {
    if (!bookingCode) return;

    try {
      await navigator.clipboard.writeText(bookingCode);
      setCopiedCode(bookingCode);
    } catch {
      setCopiedCode("");
    }
  };

  const handleRebet = async () => {
    if (!ticket || !ticketIsPending || !canRebetBet(ticket) || rebetSubmitting) return;

    setRebetSubmitting(true);
    try {
      await requestLoadByCode(String(ticket.shareCode ?? "").trim());
    } finally {
      setRebetSubmitting(false);
    }
  };

  if (!authHasHydrated) {
    return (
      <div className="space-y-4 pb-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-2 text-md font-semibold text-white/80"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <AuthHydrationFallback />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 pb-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-2 text-md font-semibold text-white/80"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <section className="rounded-3xl border border-white/6 bg-surface-elevated p-5">
          <p className="text-base font-bold uppercase tracking-[0.14em] text-text-label">Ticket Details</p>
          <h1 className="mt-3 text-4xl font-black text-white">Log in to view this ticket</h1>
          <p className="mt-3 text-lg leading-7 text-white/58">
            Bet details, selections, and booking code history are only available to authenticated users.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => openLogin(`/my-bets/${betId}`)}
              className="rounded-lg bg-[var(--lime)] px-4 py-3 text-lg font-semibold text-white"
            >
              Log in
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!ticket && fallbackQuery.isLoading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
        <div className="h-[240px] animate-pulse rounded-3xl bg-white/5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`ticket-detail-skeleton-${index}`} className="h-[120px] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4 pb-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-md font-semibold text-white/80"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <section className="rounded-3xl border border-dashed border-white/10 bg-surface-elevated px-5 py-12 text-center">
          <p className="text-base font-bold uppercase tracking-[0.14em] text-text-label">Ticket Details</p>
          <h1 className="mt-3 text-4xl font-black text-white">Ticket not available</h1>
          <p className="mt-3 text-lg leading-7 text-white/56">
            This ticket could not be resolved from recent bet history data. Open it again from the history list to refresh the detail view.
          </p>
          <button
            type="button"
            onClick={() => router.push("/my-bets")}
            className="mt-6 rounded-lg bg-[var(--lime)] px-4 py-3 text-lg font-semibold text-white"
          >
            Back to bet history
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2  py-2 text-md font-semibold text-white/82"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-md font-semibold text-white/42">Ticket ID: {String(ticket.id ?? "") || "--"}</p>
            <h1 className="mt-4 text-4xl font-black leading-none text-white/74">{getBetTypeLabel(ticket)}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-md font-semibold text-white/42">{formattedPlacedAt || "Date unavailable"}</p>
            <p className="mt-4 text-4xl font-black text-white/74">{ticketStatus}</p>
          </div>
        </div>

        <div className=" border-white/8 py-3 my-3 border-y">
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-semibold uppercase tracking-[0.08em] text-white/42">
              {ticketIsPending ? "Potential Return" : "Total Return"}
            </p>
            <p
              className={`text-right text-3xl font-black leading-none ${
                ticketTone === "won" ? "text-accent-green" : "text-white/74"
              }`}
            >
              {returnLabel}
            </p>
          </div>
        </div>

        <div className=" border-white/8">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-semibold text-white/52">Total Stake</p>
              <p className="text-3xl font-bold text-white/74">{formattedStake}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-semibold text-white/52">Total Odds</p>
              <p className="text-3xl font-bold text-white/74">{getTotalOdds(ticket).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {ticketIsPending && bookingCode ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[rgba(18, 26, 22, 0.12)] bg-[#F4F4F2] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/45">Booking code</p>
                <p className="mt-2 truncate text-4xl font-black tracking-[0.14em] text-white">
                  {bookingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-base font-semibold text-white/82"
              >
                <Copy size={14} />
                {copiedCode === bookingCode ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-4 space-y-3">
        {selections.length ? (
          selections.map((selection, index) => (
            <SelectionCard
              key={`${String(selection.id ?? selection.outcomeId ?? index)}-${index}`}
              onOpenTracker={setTrackerSelection}
              selection={selection}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
            <p className="text-xl font-semibold text-white">Selection details unavailable</p>
            <p className="mt-2 text-md leading-6 text-white/52">
              This ticket was returned without expanded selection rows.
            </p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/8 bg-[#F6F6F5]/94 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-lg font-semibold text-white/82"
          >
            Back
          </button>
          {ticketIsPending ? (
            <button
              type="button"
              disabled={!canRebetBet(ticket) || rebetSubmitting}
              onClick={() => void handleRebet()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--lime)] px-4 py-3 text-lg font-semibold text-white disabled:opacity-40"
            >
              {rebetSubmitting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Rebet
            </button>
          ) : null}
        </div>
      </div>

      {trackerSelection ? (
        <TrackerModal
          onClose={() => setTrackerSelection(null)}
          selection={trackerSelection}
        />
      ) : null}
    </div>
  );
}
