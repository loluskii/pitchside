"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CalendarDays,
  ChevronRight,
  Loader2,
  LogIn,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { BetHistoryTicket, type BetHistoryTicketSelectionPreview } from "@/components/bets/BetHistoryTicket";
import { OpenBetCashoutModal } from "@/components/bets/OpenBetCashoutModal";
import { OpenBetTicket, type OpenBetTicketSelection } from "@/components/bets/OpenBetTicket";
import { ApiClientError } from "@/lib/api";
import { betsApi } from "@/lib/api/bets";
import { useBetHistory, useInfiniteBetHistory } from "@/lib/query/hooks/useBets";
import {
  asArray,
  type BetHistoryItem,
  type BetHistoryResponse,
  type BetHistorySelection,
  canRebetBet,
  formatCompactDateTime,
  formatCurrency,
  formatDateTime,
  getBetDetailHref,
  getBetHistoryStatusTone,
  getBetTypeLabel,
  getBetsFromResponse,
  getCashoutDisplayAmount,
  getEstimatedCashout,
  getLiveStatusLabel,
  getNumber,
  getOpenBetFeatures,
  getPotentialWin,
  getSelectionHref,
  getSelectionStatusKind,
  getTicketReturnAmount,
  getTotalOdds,
  isCashoutAvailable,
  isLiveSelection,
  isPendingBet,
  OPEN_BET_STATUSES,
} from "@/lib/utils/bet-history";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";

const ROOT_TABS = [
  { id: "open", label: "Open Bets" },
  { id: "history", label: "Bet History" },
] as const;

const HISTORY_FILTER_TABS = [
  { id: "all", label: "All Bets" },
  { id: "pending", label: "Pending" },
  { id: "settled", label: "Settled" },
] as const;

const RESULT_FILTER_TABS = [
  { id: "won", label: "Won", status: 1 },
  { id: "lost", label: "Lost", status: 0 },
  { id: "voided", label: "Voided", status: 7 },
] as const;

const SETTLED_BET_STATUSES = [0, 1, 4, 5, 6, 7] as const;

const BET_TYPE_FILTERS = [
  { id: "all", label: "All Types", value: undefined },
  { id: "single", label: "Single", value: "single" },
  { id: "multi", label: "Multi", value: "multi" },
  { id: "system", label: "System", value: "system" },
  { id: "pool", label: "Pool", value: "pool" },
  { id: "flex", label: "Flex", value: "flex" },
  { id: "cut_one", label: "Cut One", value: "cut_one" },
] as const;

const EVENT_TYPE_FILTERS = [
  { id: "all", label: "All Events", value: undefined },
  { id: "live", label: "Live", value: "live" },
  { id: "prematch", label: "Pre-match", value: "prematch" },
  { id: "mixed", label: "Mixed", value: "mixed" },
] as const;

const DATE_FILTERS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "thirty", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
] as const;

type DateRangeValue = {
  end: string;
  start: string;
};

function formatTicketDateParts(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { day: "--", month: "---" };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---" };

  return {
    day: new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
  };
}

function getDateGroupKey(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "unknown";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "unknown";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBetErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data.trim();
    }

    if (error.data && typeof error.data === "object") {
      const record = error.data as Record<string, unknown>;
      const nested =
        record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
      return String(
        record.status_description ??
          record.message ??
          nested?.status_description ??
          nested?.message ??
          error.message ??
          fallback,
      ).trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function formatFilterRange(
  filterId: (typeof DATE_FILTERS)[number]["id"],
  customRange: DateRangeValue,
) {
  if (filterId === "all") return {};

  const format = (date: Date) => date.toISOString().split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filterId === "today") {
    return { end: format(today), start: format(today) };
  }

  if (filterId === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { end: format(today), start: format(start) };
  }

  if (filterId === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { end: format(today), start: format(start) };
  }

  if (filterId === "custom") {
    if (customRange.start && customRange.end) {
      return { end: customRange.end, start: customRange.start };
    }
    return {};
  }

  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { end: format(today), start: format(start) };
}

function formatDrawerDateLabel(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function BottomDrawer({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-menu)]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/72"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[72dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/8 bg-surface-dialog px-4 pt-2 shadow-sheet">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/14" />
        <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-1.5 text-white/72"
            aria-label={`Close ${title}`}
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MyBetsPage() {
  const router = useRouter();
  const { openLogin } = useAuthModal();
  const [activeRootTab, setActiveRootTab] = useState<(typeof ROOT_TABS)[number]["id"]>("open");
  const [activeHistoryTab, setActiveHistoryTab] =
    useState<(typeof HISTORY_FILTER_TABS)[number]["id"]>("all");
  const [activeResultFilter, setActiveResultFilter] =
    useState<(typeof RESULT_FILTER_TABS)[number]["id"] | null>(null);
  const [activeBetTypeFilter, setActiveBetTypeFilter] =
    useState<(typeof BET_TYPE_FILTERS)[number]["id"]>("all");
  const [activeEventTypeFilter, setActiveEventTypeFilter] =
    useState<(typeof EVENT_TYPE_FILTERS)[number]["id"]>("all");
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<(typeof DATE_FILTERS)[number]["id"]>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRangeValue>({ end: "", start: "" });
  const [draftDateFilter, setDraftDateFilter] =
    useState<(typeof DATE_FILTERS)[number]["id"]>("all");
  const [draftCustomDateRange, setDraftCustomDateRange] = useState<DateRangeValue>({
    end: "",
    start: "",
  });
  const [dateDrawerView, setDateDrawerView] = useState<"custom" | "presets">("presets");
  const [activeFilterDrawer, setActiveFilterDrawer] =
    useState<"eventType" | "historyFilters" | null>(null);
  const [cashoutBet, setCashoutBet] = useState<BetHistoryItem | null>(null);
  const [cashoutError, setCashoutError] = useState("");
  const [cashoutSubmitting, setCashoutSubmitting] = useState(false);
  const [copiedHistoryCode, setCopiedHistoryCode] = useState("");
  const [hiddenOpenBetIds, setHiddenOpenBetIds] = useState<string[]>([]);
  const [expandedOpenBetId, setExpandedOpenBetId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const requestLoadByCode = useCouponStore((state) => state.requestLoadByCode);
  const activeResultStatus =
    RESULT_FILTER_TABS.find((tab) => tab.id === activeResultFilter)?.status;
  const historyStatus =
    activeRootTab === "open"
      ? OPEN_BET_STATUSES
      : activeResultStatus !== undefined
        ? activeResultStatus
        : activeHistoryTab === "pending"
        ? -1
        : activeHistoryTab === "settled"
          ? [...SETTLED_BET_STATUSES]
          : undefined;
  const activeBetTypeValue =
    BET_TYPE_FILTERS.find((option) => option.id === activeBetTypeFilter)?.value;
  const activeEventTypeValue =
    activeRootTab === "open"
      ? EVENT_TYPE_FILTERS.find((option) => option.id === activeEventTypeFilter)?.value
      : undefined;

  const dateRange = useMemo(
    () => formatFilterRange(selectedDateFilter, customDateRange),
    [customDateRange, selectedDateFilter],
  );

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } =
    useInfiniteBetHistory(
      {
        bet_type: activeRootTab === "history" ? activeBetTypeValue : undefined,
        event_type: activeEventTypeValue,
        from: activeRootTab === "history" ? dateRange.start : undefined,
        perPage: 20,
        status: historyStatus,
        to: activeRootTab === "history" ? dateRange.end : undefined,
      },
      authHasHydrated && isAuthenticated,
    ) ?? {};
  const { data: openBetsCountResponse } = useBetHistory(
    {
      page: 1,
      perPage: 1,
      status: OPEN_BET_STATUSES,
    },
    authHasHydrated && isAuthenticated,
  );

  const bets = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) => getBetsFromResponse(page as BetHistoryResponse | undefined)),
    [data?.pages],
  );

  const openDisplayedBets = useMemo(
    () =>
      bets.filter(
        (bet) =>
          OPEN_BET_STATUSES.includes(getNumber(bet.status)) &&
          !hiddenOpenBetIds.includes(String(bet.id ?? "")),
      ),
    [bets, hiddenOpenBetIds],
  );
  const openBetsResponseCount = (openBetsCountResponse as BetHistoryResponse | undefined)?.data?.count;
  const openBetsTabCount =
    openBetsResponseCount == null ? openDisplayedBets.length : getNumber(openBetsResponseCount);

  const historyBaseBets = useMemo(() => bets, [bets]);

  const historyDisplayedBets = useMemo(() => historyBaseBets, [historyBaseBets]);

  const groupedHistoryBets = useMemo(() => {
    const groups = new Map<string, { key: string; items: BetHistoryItem[]; parts: { day: string; month: string } }>();

    historyDisplayedBets.forEach((bet) => {
      const createdAt = String(bet.created ?? "");
      const key = getDateGroupKey(createdAt);
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(bet);
        return;
      }

      groups.set(key, {
        key,
        items: [bet],
        parts: formatTicketDateParts(createdAt),
      });
    });

    return [...groups.values()];
  }, [historyDisplayedBets]);

  const activeEventTypeLabel =
    EVENT_TYPE_FILTERS.find((option) => option.id === activeEventTypeFilter)?.label ?? "All Events";
  const historyAdvancedFilterCount = [
    activeResultFilter,
    activeBetTypeFilter !== "all",
    selectedDateFilter !== "all",
  ].filter(Boolean).length;
  const isDraftCustomRangeInvalid =
    draftDateFilter === "custom" &&
    (!draftCustomDateRange.start ||
      !draftCustomDateRange.end ||
      draftCustomDateRange.start > draftCustomDateRange.end);

  const resetBetPanels = () => {
    setExpandedOpenBetId(null);
  };

  const openEventTypeDrawer = () => {
    resetBetPanels();
    setActiveFilterDrawer("eventType");
  };

  const openHistoryFiltersDrawer = () => {
    resetBetPanels();
    setDraftDateFilter(selectedDateFilter);
    setDraftCustomDateRange(customDateRange);
    setDateDrawerView(selectedDateFilter === "custom" ? "custom" : "presets");
    setActiveFilterDrawer("historyFilters");
  };

  const applyDateDrawer = () => {
    if (isDraftCustomRangeInvalid) return;

    setSelectedDateFilter(draftDateFilter);
    setCustomDateRange(draftCustomDateRange);
    setActiveFilterDrawer(null);
  };

  const resetDateDrawer = () => {
    setDraftDateFilter("all");
    setDraftCustomDateRange({ end: "", start: "" });
    setDateDrawerView("presets");
  };

  const clearHistoryFilters = () => {
    setActiveResultFilter(null);
    setActiveBetTypeFilter("all");
    setSelectedDateFilter("all");
    setCustomDateRange({ end: "", start: "" });
    resetDateDrawer();
  };

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void fetchNextPage();
      }
    });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const emptyMessage =
    activeRootTab === "open"
      ? "No open bets"
      : activeHistoryTab === "pending"
        ? "No pending bets in this period"
        : activeHistoryTab === "settled"
          ? "No settled bets in this period"
          : "No bet history in this period";

  const emptyDescription =
    activeRootTab === "open"
      ? "Open bets only include pending tickets that are not yet won or lost."
      : "Adjust the date filter or switch history tabs to inspect a different range of bets.";

  const handleRebet = async (bet: BetHistoryItem) => {
    const code = String(bet.shareCode ?? "").trim();
    if (!code) return;
    await requestLoadByCode(code);
  };

  const handleCopyHistoryCode = async (code: string) => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedHistoryCode(code);
    } catch {
      setCopiedHistoryCode("");
    }
  };

  const handleOpenBetHistoryDetail = (bet: BetHistoryItem) => {
    const href = getBetDetailHref(bet);
    if (!href) return;
    router.push(href);
  };

  const handleCashout = (bet: BetHistoryItem) => {
    if (!isCashoutAvailable(bet)) return;
    setCashoutBet(bet);
    setCashoutError("");
  };

  const handleCloseCashout = () => {
    if (cashoutSubmitting) return;
    setCashoutBet(null);
    setCashoutError("");
  };

  const handleConfirmCashout = async (selectedAmount: number) => {
    if (!cashoutBet || cashoutSubmitting) return;

    const betId = Number(cashoutBet.id);
    if (!Number.isInteger(betId) || betId <= 0) {
      setCashoutError("Unable to cash out this ticket right now.");
      return;
    }
    const localBetId = String(cashoutBet.id);

    const estimatedCashout = getEstimatedCashout(cashoutBet);
    if (estimatedCashout <= 0) {
      setCashoutError("Cashout is unavailable for this ticket.");
      return;
    }

    const cashoutAmount = Math.min(estimatedCashout, Math.max(0, selectedAmount));
    const percent = estimatedCashout > 0 ? cashoutAmount / estimatedCashout : 0;

    setCashoutSubmitting(true);
    setCashoutError("");

    try {
      const response = await betsApi.performCashout({
        betId,
        percent: Math.min(1, Math.max(0, percent)),
        source: "mobile",
      });
      const statusCode = Number(
        (response as Record<string, unknown>)?.status_code ??
          (response as Record<string, unknown>)?.statusCode ??
          0,
      );
      if (statusCode !== 200) {
        const statusDescription = String(
          (response as Record<string, unknown>)?.status_description ??
            (response as Record<string, unknown>)?.message ??
            "Cashout failed. Please try again.",
        );
        const cashoutOfferChanged = statusDescription
          .toLowerCase()
          .includes("cashout suggestions have change");
        if (statusCode === 400 && cashoutOfferChanged) {
          if (typeof refetch === "function") {
            await refetch();
          }
          setCashoutError("Cashout offer changed. Review the updated amount and try again.");
          return;
        }
        throw new Error(statusDescription);
      }

      setHiddenOpenBetIds((current) => [...new Set([...current, localBetId])]);
      setCashoutBet(null);
      setExpandedOpenBetId((current) => (current === localBetId ? null : current));
      setCashoutError("");
      if (typeof refetch === "function") {
        await refetch();
      }
    } catch (error) {
      setCashoutError(getBetErrorMessage(error, "Cashout failed. Please try again."));
    } finally {
      setCashoutSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {!authHasHydrated ? (
        <AuthHydrationFallback />
      ) : !isAuthenticated ? (
        <section className="rounded-2xl border border-white/6 bg-surface-elevated p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-icon text-text-blue">
              <LogIn size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold text-white">Log in to view your bets</h2>
              <p className="mt-2 text-md leading-6 text-[var(--text-dim)]">
                Open bets, bet history, booking codes, and rebet are only available to authenticated users.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => openLogin("/my-bets")}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--lime)] px-4 py-2 text-md font-semibold text-white"
                >
                  Log in
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex items-center gap-7 border-b border-white/8 px-1">
            {ROOT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  resetBetPanels();
                  setActiveRootTab(tab.id);
                  if (tab.id === "open") {
                    setActiveResultFilter(null);
                    setActiveBetTypeFilter("all");
                  }
                }}
                className={`relative -mb-px border-b-2 px-1 pb-3 text-left text-xl font-semibold transition ${
                  activeRootTab === tab.id
                    ? "border-[var(--primary-orange)] text-white"
                    : "border-transparent text-white/58 hover:text-white/82"
                }`}
              >
                <span className="block">
                  {tab.id === "open" ? `${tab.label} (${openBetsTabCount})` : tab.label}
                </span>
              </button>
            ))}
          </div>

          {activeRootTab === "open" ? (
            <div className="rounded-2xl border border-white/6 bg-surface-elevated p-3">
              <button
                type="button"
                onClick={openEventTypeDrawer}
                className="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-surface-active px-4 py-3 text-left text-white"
              >
                <span className="truncate text-lg font-semibold">Event Type: {activeEventTypeLabel}</span>
                <ChevronRight size={18} className="shrink-0 rotate-90 text-white/65" />
              </button>
            </div>
          ) : null}

          {activeRootTab === "history" ? (
            <div className="flex items-center justify-between gap-3 pb-1">
              <div className="inline-flex min-w-0 overflow-hidden rounded-lg border border-white/8 bg-[#F3F4F2] p-1">
                {HISTORY_FILTER_TABS.map((tab) => {
                  const selected = activeHistoryTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        resetBetPanels();
                        setActiveHistoryTab(tab.id);
                        const selectedResultStatus =
                          RESULT_FILTER_TABS.find((result) => result.id === activeResultFilter)?.status;
                        if (
                          tab.id === "pending" ||
                          (tab.id === "all" && selectedResultStatus !== undefined)
                        ) {
                          setActiveResultFilter(null);
                        }
                      }}
                      className={`whitespace-nowrap rounded-md px-3 py-2 text-base font-bold transition ${
                        selected
                          ? "bg-surface-active text-white shadow-sm"
                          : "text-white/52"
                      }`}
                    >
                      {tab.id === "all" ? "All" : tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={openHistoryFiltersDrawer}
                className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--primary-orange)]"
                aria-label="Open bet history filters"
              >
                <SlidersHorizontal size={20} />
                {historyAdvancedFilterCount > 0 ? (
                  <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--lime)] px-1 text-[9px] font-black text-white">
                    {historyAdvancedFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`bet-history-skeleton-${index}`}
                  className="animate-pulse rounded-2xl border border-white/6 bg-surface-elevated p-4"
                >
                  <div className="h-4 w-1/3 rounded bg-white/5" />
                  <div className="mt-3 h-3 w-full rounded bg-white/5" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-border-error bg-surface-error px-4 py-10 text-center">
              <p className="text-xl font-semibold text-white">Unable to load bets</p>
              <p className="mt-2 text-md leading-6 text-text-error">
                {error instanceof Error ? error.message : "The bet service returned an unexpected response."}
              </p>
            </div>
          ) : activeRootTab === "open" && openDisplayedBets.length ? (
            <div className="space-y-3">
              {openDisplayedBets.map((bet, index) => {
                const betId = String(bet.id ?? "") || `bet-${index}`;
                const selections = asArray<BetHistorySelection>(bet.selections);
                const openBetSelections: OpenBetTicketSelection[] = selections.map((selection, selectionIndex) => {
                  const liveStatus = getLiveStatusLabel(selection);
                  const outcomeName = String(selection.outcomeName ?? "").trim();
                  const marketName = String(selection.marketName ?? "").trim();
                  const selectionLabel =
                    outcomeName && marketName
                      ? `${outcomeName} • ${marketName}`
                      : outcomeName || marketName || "Selection";
                  const score = String(selection.score ?? "").trim().replace(":", " - ");
                  return {
                    event: String(selection.eventName ?? "").trim() || "Fixture unavailable",
                    href: getSelectionHref(selection) || undefined,
                    id: `${String(selection.id ?? selection.outcomeId ?? selectionIndex)}-${selectionIndex}`,
                    isLive: isLiveSelection(selection),
                    label: selectionLabel,
                    liveScore: score,
                    liveStatus,
                    odds: getNumber(selection.odds).toFixed(2),
                    startTime: formatCompactDateTime(selection.eventDate),
                    status: String(selection.statusDescription ?? "").trim() || "Unknown",
                    statusKind: getSelectionStatusKind(selection),
                  };
                });
                const previewSelections = openBetSelections.slice(0, 3);
                const hiddenCount = Math.max(openBetSelections.length - previewSelections.length, 0);
                const cashoutAvailable = isCashoutAvailable(bet);
                return (
                  <OpenBetTicket
                    key={betId}
                    betFeatures={getOpenBetFeatures(bet)}
                    betTypeLabel={getBetTypeLabel(bet)}
                    cashoutAmountLabel={formatCurrency(getCashoutDisplayAmount(bet))}
                    cashoutAvailable={cashoutAvailable}
                    cashoutLoading={cashoutSubmitting && String(cashoutBet?.id ?? "") === betId}
                    expanded={expandedOpenBetId === betId}
                    hiddenCount={hiddenCount}
                    onCashout={() => handleCashout(bet)}
                    onRebet={() => void handleRebet(bet)}
                    onToggle={() =>
                      setExpandedOpenBetId((current) => (current === betId ? null : betId))
                    }
                    potentialWinLabel={formatCurrency(getPotentialWin(bet))}
                    previewSelections={previewSelections}
                    rebetAvailable={canRebetBet(bet)}
                    selections={openBetSelections}
                    stakeLabel={formatCurrency(bet.stake)}
                  />
                );
              })}

              <div ref={sentinelRef} className="h-8" />

              {isFetchingNextPage ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-surface-elevated px-3 py-2 text-base text-white/70">
                  <Loader2 size={14} className="animate-spin" />
                  Loading more bets
                </div>
              ) : null}
            </div>
          ) : historyDisplayedBets.length ? (
            <div className="space-y-6">
              {groupedHistoryBets.map((group) => (
                <section key={group.key} className="flex items-start gap-4">
                  <div className="flex w-[54px] shrink-0 flex-col items-center px-1 pt-1 text-center">
                    <span className="text-6xl font-black leading-none text-white/92">
                      {group.parts.day}
                    </span>
                    <span className="mt-2 text-md font-semibold uppercase tracking-[0.12em] text-white/42">
                      {group.parts.month}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {group.items.map((bet, index) => {
                      const betId = String(bet.id ?? "") || `${group.key}-${index}`;
                      const selections = asArray<BetHistorySelection>(bet.selections);
                      const bookingCode = String(bet.shareCode ?? "").trim();
                      const statusLabel = String(bet.statusDescription ?? "").trim() || "Unknown";
                      const pendingBet = isPendingBet(bet);
                      const historyPreviewSelections: BetHistoryTicketSelectionPreview[] = selections
                        .slice(0, 3)
                        .map((selection, selectionIndex) => {
                          const outcomeName = String(selection.outcomeName ?? "").trim();
                          const marketName = String(selection.marketName ?? "").trim();
                          const selectionLabel =
                            outcomeName && marketName
                              ? `${outcomeName} • ${marketName}`
                              : outcomeName || marketName || "Selection";

                          return {
                            event: String(selection.eventName ?? "").trim() || "Fixture unavailable",
                            id: `${String(selection.id ?? selection.outcomeId ?? selectionIndex)}-${selectionIndex}`,
                            label: selectionLabel,
                          };
                        });
                      const ticketDateParts = formatTicketDateParts(bet.created);

                      return (
                        <BetHistoryTicket
                          key={betId}
                          betTypeLabel={getBetTypeLabel(bet)}
                          bookingCodeCopied={copiedHistoryCode === bookingCode}
                          bookingCodeLabel={pendingBet && bookingCode ? `Booking code: ${bookingCode}` : ""}
                          dateDayLabel={ticketDateParts.day}
                          dateMonthLabel={ticketDateParts.month}
                          dateTimeLabel={formatDateTime(bet.created)}
                          onCopyBookingCode={
                            pendingBet && bookingCode
                              ? () => {
                                  void handleCopyHistoryCode(bookingCode);
                                }
                              : undefined
                          }
                          onClick={() => handleOpenBetHistoryDetail(bet)}
                          onRebet={
                            pendingBet && canRebetBet(bet)
                              ? () => {
                                  void handleRebet(bet);
                                }
                              : undefined
                          }
                          previewSelections={historyPreviewSelections}
                          rebetAvailable={pendingBet && canRebetBet(bet)}
                          returnCaption={isPendingBet(bet) ? "Potential win" : "Return"}
                          returnLabel={formatCurrency(getTicketReturnAmount(bet))}
                          selectionCountLabel={`${selections.length} selection${selections.length === 1 ? "" : "s"}`}
                          stakeLabel={formatCurrency(bet.stake)}
                          statusLabel={statusLabel}
                          statusTone={getBetHistoryStatusTone(bet)}
                          totalOddsLabel={getTotalOdds(bet).toFixed(2)}
                          showDateBadge={false}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              <div ref={sentinelRef} className="h-8" />

              {isFetchingNextPage ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-surface-elevated px-3 py-2 text-base text-white/70">
                  <Loader2 size={14} className="animate-spin" />
                  Loading more bets
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
              <p className="text-xl font-semibold text-white">{emptyMessage}</p>
              <p className="mt-2 text-md leading-6 text-[var(--text-dim)]">{emptyDescription}</p>
            </div>
          )}

          {isFetching && !isLoading && !isFetchingNextPage ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-surface-elevated px-3 py-2 text-base text-white/70">
              <Loader2 size={14} className="animate-spin" />
              Refreshing bets
            </div>
          ) : null}

          {activeFilterDrawer === "eventType" ? (
            <BottomDrawer open onClose={() => setActiveFilterDrawer(null)} title="Event Type">
              <div className="space-y-2">
                {EVENT_TYPE_FILTERS.map((option) => {
                  const selected = activeEventTypeFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        resetBetPanels();
                        setActiveEventTypeFilter(option.id);
                        setActiveFilterDrawer(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                        selected
                          ? "border-[rgba(12, 122, 77, 0.35)] bg-[rgba(203, 234, 78, 0.12)] text-white"
                          : "border-white/8 bg-surface-elevated text-white/82"
                      }`}
                    >
                      <span className="text-lg font-semibold">{option.label}</span>
                      {selected ? <Check size={18} className="text-[var(--primary-orange)]" /> : null}
                    </button>
                  );
                })}
              </div>
            </BottomDrawer>
          ) : null}

          {activeFilterDrawer === "historyFilters" ? (
            <BottomDrawer
              open
              onClose={() => setActiveFilterDrawer(null)}
              title={dateDrawerView === "custom" ? "Custom Date" : "Filters"}
            >
              {dateDrawerView === "presets" ? (
                <div className="space-y-3">
                  <section>
                    <div className="mb-1.5 flex items-center gap-2 text-white/72">
                      <CalendarDays size={14} className="text-[var(--primary-orange)]" />
                      <p className="text-sm font-black uppercase tracking-[0.12em]">Date range</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DATE_FILTERS.map((option) => {
                        const selected = selectedDateFilter === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              if (option.id === "custom") {
                                setDraftDateFilter("custom");
                                setDraftCustomDateRange(customDateRange);
                                setDateDrawerView("custom");
                                return;
                              }

                              setSelectedDateFilter(option.id);
                              setDraftDateFilter(option.id);
                            }}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                              selected
                                ? "border-[rgba(12, 122, 77, 0.35)] bg-[rgba(203, 234, 78, 0.12)] text-white"
                                : "border-white/8 bg-surface-elevated text-white/82"
                            }`}
                          >
                            <span className="truncate text-sm font-semibold">{option.label}</span>
                            {selected ? <Check size={14} className="shrink-0 text-[var(--primary-orange)]" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <p className="mb-1.5 text-sm font-black uppercase tracking-[0.12em] text-white/72">
                      Bet result
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {RESULT_FILTER_TABS.map((tab) => {
                        const disabled = activeHistoryTab === "pending";
                        const selected = activeResultFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              resetBetPanels();
                              setActiveResultFilter(selected ? null : tab.id);
                              setActiveHistoryTab("settled");
                            }}
                            className={`rounded-lg border px-3 py-2 text-center transition ${
                              selected
                                ? "border-[rgba(12, 122, 77, 0.35)] bg-[rgba(203, 234, 78, 0.12)] text-white"
                                : "border-white/8 bg-surface-elevated text-white/82"
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            <span className="text-sm font-semibold">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {activeHistoryTab === "pending" ? (
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        Result filters only apply to settled tickets.
                      </p>
                    ) : null}
                  </section>

                  <section>
                    <p className="mb-1.5 text-sm font-black uppercase tracking-[0.12em] text-white/72">
                      Bet type
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {BET_TYPE_FILTERS.map((option) => {
                        const selected = activeBetTypeFilter === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              resetBetPanels();
                              setActiveBetTypeFilter(option.id);
                            }}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                              selected
                                ? "border-[rgba(12, 122, 77, 0.35)] bg-[rgba(203, 234, 78, 0.12)] text-white"
                                : "border-white/8 bg-surface-elevated text-white/82"
                            }`}
                          >
                            <span className="truncate text-sm font-semibold">{option.label}</span>
                            {selected ? <Check size={14} className="shrink-0 text-[var(--primary-orange)]" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 bg-surface-elevated p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
                        Start date
                      </span>
                      <input
                        type="date"
                        value={draftCustomDateRange.start}
                        onChange={(event) =>
                          setDraftCustomDateRange((current) => ({
                            ...current,
                            start: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-surface-simulation px-3 py-2.5 text-sm font-semibold text-white outline-none"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
                        End date
                      </span>
                      <input
                        type="date"
                        value={draftCustomDateRange.end}
                        onChange={(event) =>
                          setDraftCustomDateRange((current) => ({
                            ...current,
                            end: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-surface-simulation px-3 py-2.5 text-sm font-semibold text-white outline-none"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-white/52">
                    {draftCustomDateRange.start && draftCustomDateRange.end
                      ? `${formatDrawerDateLabel(draftCustomDateRange.start)} to ${formatDrawerDateLabel(
                          draftCustomDateRange.end,
                        )}`
                      : "Pick a start and end date to filter ticket history."}
                  </p>

                  {isDraftCustomRangeInvalid ? (
                    <p className="mt-2 text-xs text-text-error-light">
                      Select both dates, and make sure the end date is not before the start date.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="sticky bottom-0 -mx-4 mt-3 grid grid-cols-2 gap-3 border-t border-white/8 bg-surface-dialog px-4 pb-1 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (dateDrawerView === "custom") {
                      setDateDrawerView("presets");
                      return;
                    }

                    clearHistoryFilters();
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80"
                >
                  {dateDrawerView === "custom" ? "Back" : "Clear filters"}
                </button>
                <button
                  type="button"
                  disabled={isDraftCustomRangeInvalid}
                  onClick={dateDrawerView === "custom" ? applyDateDrawer : () => setActiveFilterDrawer(null)}
                  className="rounded-lg bg-[var(--lime)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {dateDrawerView === "custom" ? "Apply" : "Done"}
                </button>
              </div>
            </BottomDrawer>
          ) : null}
        </>
      )}

      {cashoutBet ? (
        <OpenBetCashoutModal
          busy={cashoutSubmitting}
          currencyLabel="NGN"
          errorMessage={cashoutError}
          maxAmount={getEstimatedCashout(cashoutBet)}
          onClose={handleCloseCashout}
          onConfirm={(selectedAmount) => void handleConfirmCashout(selectedAmount)}
          potentialWinLabel={formatCurrency(getPotentialWin(cashoutBet))}
          stakeLabel={formatCurrency(cashoutBet.stake)}
        />
      ) : null}
    </div>
  );
}
