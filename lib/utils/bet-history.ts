import type { QueryClient } from "@tanstack/react-query";
import { getLiveFixtureHref, getPrematchFixtureHref } from "@/lib/utils/fixture-routes";

const EARLY_GOAL_DERIVED_MARKET_ID = 60180;
export const OPEN_BET_STATUSES = [-1, 5];

export type BetHistorySelection = {
  eventDate?: unknown;
  eventId?: unknown;
  eventName?: unknown;
  eventTime?: unknown;
  id?: unknown;
  marketId?: unknown;
  marketName?: unknown;
  matchStatus?: unknown;
  odds?: unknown;
  outcomeId?: unknown;
  outcomeName?: unknown;
  score?: unknown;
  settledAt?: unknown;
  sportName?: unknown;
  specifier?: unknown;
  status?: unknown;
  statusDescription?: unknown;
};

export type BetHistoryItem = {
  accaBonus?: { status?: unknown };
  betType?: unknown;
  cashoutAmount?: unknown;
  created?: unknown;
  currency?: unknown;
  cutOne?: { status?: unknown };
  email_address?: unknown;
  estimatedCashout?: unknown;
  eventType?: unknown;
  flex?: { status?: unknown };
  id?: unknown;
  isBooked?: unknown;
  possibleWin?: unknown;
  selections?: BetHistorySelection[];
  shareCode?: unknown;
  source?: unknown;
  stake?: unknown;
  status?: unknown;
  statusDescription?: unknown;
  totalOdd?: unknown;
  totalSelections?: unknown;
  userId?: unknown;
  username?: unknown;
};

export type BetHistoryResponse = {
  status_code: number;
  status_description: string;
  data: {
    count?: unknown;
    currentPage?: unknown;
    data: BetHistoryItem[];
    lastPage?: unknown;
    nextPage?: unknown;
    prevPage?: unknown;
  };
};

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function getBetsFromResponse(response: BetHistoryResponse | undefined) {
  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

export function getBetDetailHref(bet: BetHistoryItem) {
  return `/my-bets/${encodeURIComponent(String(bet.id ?? ""))}`;
}

export function getNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatCurrency(value: unknown) {
  return `NGN ${getNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Date unavailable";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCompactDateTime(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function getBetTypeLabel(bet: BetHistoryItem) {
  const type = String(bet.betType ?? "multiple").toLowerCase();
  if (type === "multi") return "Multiple";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getStatusLabel(bet: BetHistoryItem) {
  const explicit = String(bet.statusDescription ?? "").trim();
  if (explicit) return explicit;
  return "Unknown";
}

export function isPendingBet(bet: BetHistoryItem) {
  if (getNumber(bet.status) === -1) return true;

  const label = getStatusLabel(bet).toLowerCase();
  return label.includes("pending") || label.includes("open");
}

export function canRebetBet(bet: BetHistoryItem) {
  const label = getStatusLabel(bet).toLowerCase();
  return Boolean(String(bet.shareCode ?? "").trim()) && !label.includes("won");
}

export function getPotentialWin(bet: BetHistoryItem) {
  return getNumber(bet.possibleWin);
}

export function getTicketReturnAmount(bet: BetHistoryItem) {
  const statusTone = getBetHistoryStatusTone(bet);

  if (statusTone === "lost") return 0;
  if (statusTone === "cancelled") return 0;
  if (statusTone === "pending") return getPotentialWin(bet);
  if (statusTone === "won") return getPotentialWin(bet);
  if (statusTone === "cashout") return getNumber(bet.cashoutAmount);

  return 0;
}

export function getTotalOdds(bet: BetHistoryItem) {
  return getNumber(bet.totalOdd);
}

export function getCashoutAmount(bet: BetHistoryItem) {
  return getNumber(bet.cashoutAmount);
}

export function getEstimatedCashout(bet: BetHistoryItem) {
  return getNumber(bet.estimatedCashout);
}

export function isCashoutAvailable(bet: BetHistoryItem) {
  return getEstimatedCashout(bet) > 0;
}

export function getCashoutDisplayAmount(bet: BetHistoryItem) {
  return getEstimatedCashout(bet);
}

function getSelectionStatus(selection: BetHistorySelection) {
  const explicit = String(selection.statusDescription ?? "").trim();
  if (explicit) return explicit;
  return "Unknown";
}

function getSelectionMatchStatus(selection: BetHistorySelection) {
  return String(selection.matchStatus ?? "").trim();
}

function getSelectionEventTime(selection: BetHistorySelection) {
  return String(selection.eventTime ?? "").trim();
}

export function getLiveStatusLabel(selection: BetHistorySelection) {
  const status = getSelectionMatchStatus(selection);
  const eventTime = getSelectionEventTime(selection);
  const normalizedStatus = status.toLowerCase();

  if (!status || normalizedStatus === "not started") return "";
  if (normalizedStatus === "ended") return "FT";

  const [minute] = eventTime.split(":");
  return minute ? `${minute}' ${status}` : status;
}

export function isLiveSelection(selection: BetHistorySelection) {
  return Boolean(getLiveStatusLabel(selection));
}

function getSelectionSportName(selection: BetHistorySelection) {
  return String(selection.sportName ?? "Football").trim() || "Football";
}

export function getSelectionHref(selection: BetHistorySelection) {
  const matchID = String(selection.eventId ?? "").trim();
  if (!matchID) return "";

  const fixture = {
    matchID,
    sportName: getSelectionSportName(selection),
  };

  return isLiveSelection(selection) ? getLiveFixtureHref(fixture) : getPrematchFixtureHref(fixture);
}

function getBetStatusTone(statusLabel: string) {
  const label = statusLabel.toLowerCase();
  if (label.includes("won")) return "won" as const;
  if (label.includes("cash")) return "cashout" as const;
  if (label.includes("cancel")) return "cancelled" as const;
  if (label.includes("pending") || label.includes("open")) return "pending" as const;
  return "lost" as const;
}

export function getBetHistoryStatusTone(bet: BetHistoryItem) {
  const rawStatus = String(bet.status ?? "").trim();
  if (rawStatus) {
    const statusCode = getNumber(bet.status);
    if (statusCode === 1) return "won" as const;
    if (statusCode === 4 || statusCode === 5) return "cashout" as const;
    if (statusCode === 6 || statusCode === 7) return "cancelled" as const;
    if (statusCode === -1) return "pending" as const;
    if (statusCode === 0) return "lost" as const;
  }

  return getBetStatusTone(getStatusLabel(bet));
}

export function getSelectionStatusTone(selection: BetHistorySelection) {
  return getBetStatusTone(getSelectionStatus(selection));
}

export function getSelectionStatusKind(selection: BetHistorySelection) {
  if (isLiveSelection(selection)) return "ongoing" as const;

  const status = getSelectionStatus(selection).trim().toLowerCase();
  if (status.includes("won")) return "won" as const;
  if (status.includes("lost")) return "lost" as const;
  if (status.includes("cancel") || status.includes("void")) return "void" as const;
  return "pending" as const;
}

export function hasEarlyGoalsFeature(selection: BetHistorySelection) {
  return Number(selection.marketId ?? 0) === EARLY_GOAL_DERIVED_MARKET_ID;
}

export function getOpenBetFeatures(bet: BetHistoryItem) {
  const features = new Set<"cutOne" | "earlyGoals" | "flex">();

  if (String(bet.betType ?? "").trim().toLowerCase() === "flex") {
    features.add("flex");
  }

  const cutOneStatus = String(bet.cutOne?.status ?? "").trim().toLowerCase();
  if (cutOneStatus && cutOneStatus !== "none") {
    features.add("cutOne");
  }

  if (asArray<BetHistorySelection>(bet.selections).some(hasEarlyGoalsFeature)) {
    features.add("earlyGoals");
  }

  return Array.from(features);
}

export function findBetInList(bets: BetHistoryItem[], betId: string) {
  return bets.find((bet) => String(bet.id ?? "") === betId) ?? null;
}

export function findBetInResponse(response: BetHistoryResponse | undefined, betId: string) {
  return findBetInList(getBetsFromResponse(response), betId);
}

export function findCachedBet(queryClient: QueryClient, betId: string) {
  const queries = queryClient.getQueryCache().getAll();

  for (const query of queries) {
    const data = query.state.data as
      | { pages?: BetHistoryResponse[] }
      | BetHistoryResponse
      | undefined;

    const paginatedData =
      data && typeof data === "object" && "pages" in data
        ? (data as { pages?: BetHistoryResponse[] })
        : undefined;

    if (Array.isArray(paginatedData?.pages)) {
      for (const page of paginatedData.pages) {
        const match = findBetInResponse(page, betId);
        if (match) return match;
      }
      continue;
    }

    const match = findBetInResponse(data as BetHistoryResponse | undefined, betId);
    if (match) return match;
  }

  return null;
}
