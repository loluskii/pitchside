import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isApiClientError } from "@/lib/api";
import { authApi } from "@/lib/api/auth";
import { betsApi } from "@/lib/api/bets";
import { CLIENT_ID } from "@/lib/api/config";
import {
  isSimulationSportAllowed,
  SIM_ALLOWED_MARKETS,
} from "@/lib/helpers/constants";
import { contentApi } from "@/lib/api/content";
import { sportsApi } from "@/lib/api/sports";
import type { BonusItem } from "@/lib/helpers";
import CouponCalculation from "@/lib/helpers/coupon-calculation";
import {
  buildEarlyGoalLocalQuoteMap,
  buildEarlyGoalSelectionState,
  buildEarlyWinLocalQuoteMap,
  buildEarlyWinSelectionState,
  type DerivedSelectionMode,
  EARLY_GOAL_DERIVED_MARKET_ID,
  EARLY_WIN_DEFAULT_MODE,
  formatEarlyGoalMarketName,
  formatEarlyWinMarketName,
  getDerivedSpecifierForMode,
  getDerivedMarketIdForMode,
  isSupportedDerivedOutcome,
  toEarlyGoalBaseSpecifier,
  type EarlyWinQuote,
} from "@/lib/helpers/early-win";
import {
  calculateSplitProps,
  calculateTotalOdds,
  calculateWinnings,
  checkBetType,
  createID,
  groupSelections,
} from "@/lib/utils/coupon";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import { subscribeMqttTopic } from "@/lib/services/mqttService";

const couponCalculation = new CouponCalculation();
let accaBonusPreviewRequestId = 0;
let cutOnePreviewRequestId = 0;
let flexPreviewRequestId = 0;
let configLoadPromise: Promise<void> | null = null;
let previewRefreshInFlightSignature = "";
let previewRefreshQueued = false;
let previewRefreshQueuedSignature = "";
let previewRefreshLastCompletedSignature = "";
let previewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let abandonedBetslipTimer: ReturnType<typeof setTimeout> | null = null;
let abandonedBetslipUnsubscribe: (() => void) | null = null;
let abandonedBetslipSessionId = "";
let abandonedBetslipPendingEventId = "";
let abandonedBetslipLastActivitySignature = "";
let abandonedBetslipLastReportedSignature = "";
let betslipRealtimeUnsubscribe: (() => void) | null = null;
let betslipRealtimeSelectionSignature = "";
const betslipRealtimeSubscriptions = new Map<
  string,
  {
    matchId: string;
    sportId: string;
    unsubscribeBetStop: () => void;
    unsubscribeOdds: () => void;
  }
>();

const PREVIEW_REFRESH_DEBOUNCE_MS = 180;
const ABANDONED_BETSLIP_TIMEOUT_MS = 5 * 60 * 1000;
const ABANDONED_BETSLIP_STORAGE_KEY = `pitchside:abandoned-betslip:${CLIENT_ID}`;

export type CouponBetType = "Single" | "Multiple" | "System";
type NativeCouponBetType = "Single" | "Multiple" | "Split";
export type EarlyWinMode = "base" | "1up" | "2up";
export type CouponMode = "real" | "sim";

export type CouponCustomBetLeg = {
  marketId: number;
  matchId: number;
  odds: number;
  outcomeId: string;
  specifier?: string;
  marketName?: string;
  outcomeName?: string;
};

export interface SportsbookGlobalVars {
  MinBonusOdd?: number;
  singleMinStake?: number;
  multipleMinStake?: number;
  MaxStake?: number;
  MaxWin?: number;
  MinWin?: number;
  MaxBonus?: number;
  WthPerc?: number;
  Currency?: string;
  [key: string]: unknown;
}

type FeatureConfigRecord = Record<string, unknown> | null;

interface SportsbookFeatureConfig {
  accaBonus: FeatureConfigRecord;
  flex: FeatureConfigRecord;
  cutOne: FeatureConfigRecord;
  stakeLimits: FeatureConfigRecord;
}

function getBetServiceStatusCode(payload: unknown) {
  if (!isRecord(payload)) return null;
  const directCode = Number(payload.status_code ?? payload.statusCode);
  if (Number.isFinite(directCode)) return directCode;
  const nested = isRecord(payload.data) ? payload.data : null;
  const nestedCode = Number(nested?.status_code ?? nested?.statusCode);
  return Number.isFinite(nestedCode) ? nestedCode : null;
}

function getBetServiceStatusDescription(payload: unknown) {
  if (!isRecord(payload)) return "";
  const nested = isRecord(payload.data) ? payload.data : null;
  return String(
    payload.status_description ??
      payload.message ??
      nested?.status_description ??
      nested?.message ??
      "",
  ).trim();
}

function getBetServiceData<T = unknown>(payload: unknown): T | null {
  if (!isRecord(payload) || !("data" in payload)) return null;
  const directData = (payload as { data?: T | Record<string, unknown> }).data;
  if (
    isRecord(directData) &&
    ("status_code" in directData || "statusCode" in directData) &&
    "data" in directData
  ) {
    return (directData.data ?? null) as T | null;
  }
  return (directData ?? null) as T | null;
}

export interface CouponSelection {
  id: string;
  selectionId: string;
  currentSelectionId: string;
  matchId: string | number;
  eventId: string | number;
  eventName: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
  sportId?: string | number;
  sportName?: string;
  tournament?: string;
  tournamentName?: string;
  category?: string;
  categoryName?: string;
  marketId: string | number;
  marketName: string;
  specifier?: string;
  selectionKeySpecifier?: string;
  outcomeId: string | number;
  outcomeName: string;
  displayName?: string;
  odds: number;
  probability?: number;
  producerId?: string | number;
  statusName?: string;
  type: "prematch" | "live";
  suspended?: boolean;
  unavailable?: boolean;
  changed?: boolean;
  fixed?: boolean;
  stake?: number;
  earlyWinMode?: DerivedSelectionMode;
  supportsEarlyWin?: boolean;
  baseMarketId?: number;
  baseMarketName?: string;
  baseSpecifier?: string;
  baseSelectionKeySpecifier?: string;
  baseOutcomeId?: string;
  baseOutcomeName?: string;
  baseDisplayName?: string;
  baseOdds?: number;
  baseStatusName?: string;
  hasExplicitDerivedMarkets?: boolean;
  supportedDerivedMarketIds?: number[];
  supportedEarlyWinModes?: string[];
  earlyWinLocalQuotes?: Record<string, EarlyWinQuote>;
  supportsEarlyGoal?: boolean;
  supportedEarlyGoalMarketIds?: number[];
  earlyGoalLocalQuotes?: Record<string, EarlyWinQuote>;
  earlyGoalMode?: DerivedSelectionMode;
  earlyWinLabel?: string;
  earlyGoalLabel?: string;
  customBetLegs?: CouponCustomBetLeg[];
  customBetProbability?: number;
  fixture?: Record<string, unknown>;
  market?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
}

interface CouponCombo {
  Grouping: number;
  Combinations: number;
  Stake: number;
  checked?: boolean;
  maxWin?: number | string;
  minWin?: number | string;
}

interface CouponDialogState {
  kind: "confirm" | "error";
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  action?:
    | "clear"
    | "loadCode"
    | "switchModeAndLoadCode"
    | "switchSimulationToRealAndAdd";
  payload?: Record<string, unknown>;
}

interface SimulationRealSnapshot {
  selections: CouponSelection[];
  betType: CouponBetType;
  nativeBetType: NativeCouponBetType;
  stake: number;
  stakeCache: Record<CouponBetType, number | null>;
  combos: CouponCombo[];
  useBonus: boolean;
  useCashback: boolean;
  bonusId: string | null;
  useCutOne: boolean;
  useFlex: boolean;
  useEarlyGoal: boolean;
  earlyWinBulkMode: DerivedSelectionMode;
}

interface CouponSuccessState {
  bookingCode: string;
  isSimulation?: boolean;
  potentialWin: number;
  response: Record<string, unknown>;
  totalStake: number;
  type: "book" | "place";
}

export type CouponSimulationStage =
  | "start"
  | "h1_home_clip"
  | "h1_home_banner"
  | "h1_away_clip"
  | "h1_away_banner"
  | "halftime_intro"
  | "halftime_swap"
  | "h2_home_clip"
  | "h2_home_banner"
  | "h2_away_clip"
  | "h2_away_banner"
  | "fulltime";

export interface CouponSimulationGoalEvent {
  minute: number;
  team: "away" | "home";
  type: string;
}

export interface CouponSimulationEvent {
  awayGoals: number;
  finalScoreText: string;
  goalEvents: CouponSimulationGoalEvent[];
  homeGoals: number;
  matchId: string;
  rawTimeline: Array<Record<string, unknown>>;
  status: string | null;
}

export interface CouponSimulationSelectionResult {
  marketId: string;
  matchId: string;
  outcomeId: string;
  specifier: string;
  won: boolean | null;
}

export interface CouponSimulationState {
  currentStage: CouponSimulationStage;
  currentTimeSec: number;
  durationSec: number;
  eventsByMatchId: Record<string, CouponSimulationEvent>;
  potentialWin: number;
  primarySelectionId: string | null;
  response: Record<string, unknown> | null;
  resultAmountWon: number;
  scorePhase: 0 | 1 | 2 | 3 | 4;
  selectionResultsBySelectionKey: Record<string, CouponSimulationSelectionResult>;
  skipRequested: boolean;
  startedAt: string | null;
  status: "idle" | "running" | "complete";
  timerEnded: boolean;
  timerStarted: boolean;
  totalStake: number;
  updateIntervalMs: number;
  winModalShown: boolean;
}

interface CouponValidationResult {
  activeSelectionCount: number;
  canProceed: boolean;
  hasChanges: boolean;
  reason: "empty" | "error" | "hasChanges" | "inactiveSelections" | "noneActive" | "ok";
  validatedSelectionCount: number;
}

interface CouponState {
  selections: CouponSelection[];
  betType: CouponBetType;
  nativeBetType: NativeCouponBetType;
  mode: CouponMode;
  stake: number;
  totalStake: number;
  totalOdds: number;
  maxWin: number;
  minWin: number;
  minOdds: number;
  maxBonus: number;
  grossWin: number;
  wthTax: number;
  combos: CouponCombo[];
  Groupings: CouponCombo[];
  flexMinWins: number;
  acceptChanges: boolean;
  useBonus: boolean;
  useCashback: boolean;
  bonusId: string | null;
  hasLive: boolean;
  useCutOne: boolean;
  useFlex: boolean;
  useEarlyGoal: boolean;
  earlyWinBulkMode: DerivedSelectionMode;
  sportsbookFeatureConfig: SportsbookFeatureConfig;
  accaBonusPreview: Record<string, unknown> | null;
  cutOnePreview: Record<string, unknown> | null;
  flexPreview: Record<string, unknown> | null;
  isOpen: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  isBooking: boolean;
  isConfigLoaded: boolean;
  isConfigLoading: boolean;
  isAccaBonusLoading: boolean;
  isCutOneLoading: boolean;
  isFlexLoading: boolean;
  isEarlyWinLoading: boolean;
  isEarlyGoalLoading: boolean;
  simulation: CouponSimulationState;
  simulationRealSnapshot: SimulationRealSnapshot | null;
  betPlaced: CouponSuccessState | null;
  loadedCoupon: Record<string, unknown> | null;
  dialog: CouponDialogState | null;
  stakeCache: Record<CouponBetType, number | null>;
  globalVars: SportsbookGlobalVars | null;
  bonusList: BonusItem[];
  activeMatchIds: string[];
  hasSplitBet: boolean;
  splitMatchIds: string[];
  addSelection: (selection: CouponSelection) => void;
  removeSelection: (selectionId: string) => void;
  toggleSelection: (selection: CouponSelection) => void;
  updateStake: (stake: number, targetId?: string) => void;
  updateSystemStake: (stake: number, grouping?: number) => void;
  setBetType: (type: CouponBetType) => void;
  setMode: (mode: CouponMode) => Promise<boolean>;
  setFlexMinWins: (value: number) => void;
  toggleBanker: (selectionId: string) => void;
  handleOddsChange: (
    matchId: string,
    updates: Array<{
      outcomeId: string;
      marketId: string;
      odds: number;
      specifier?: string;
      statusName?: string;
    }>,
  ) => void;
  handleBetStop: (matchId: string) => void;
  clearSlip: () => void;
  requestClearSlip: () => void;
  startAbandonedBetslipTracker: () => void;
  stopAbandonedBetslipTracker: () => void;
  startBetslipRealtimeSync: () => void;
  stopBetslipRealtimeSync: () => void;
  recordAbandonedBetslipInteraction: () => void;
  toggleOpen: () => void;
  setGlobalVars: (vars: SportsbookGlobalVars) => void;
  setBonusList: (list: BonusItem[]) => void;
  setBetPlaced: (bet: CouponSuccessState | null) => void;
  setIsLoading: (v: boolean) => void;
  acceptOddsChanges: () => void;
  closeDialog: () => void;
  confirmDialog: () => Promise<void>;
  showErrorDialog: (title: string, description: string) => void;
  ensureConfigLoaded: () => Promise<void>;
  bootstrapSlip: () => Promise<CouponValidationResult>;
  refreshPreviews: () => Promise<void>;
  toggleCutOne: () => Promise<void>;
  toggleFlex: () => Promise<void>;
  applyBulkEarlyWinMode: (mode: EarlyWinMode) => Promise<void>;
  toggleEarlyGoal: () => Promise<void>;
  setSelectionEarlyWinMode: (
    selectionId: string,
    mode: EarlyWinMode,
    options?: { force?: boolean; skipPreviewRefresh?: boolean },
  ) => Promise<void>;
  setSelectionEarlyGoalMode: (
    selectionId: string,
    enabled: boolean,
    options?: { skipPreviewRefresh?: boolean },
  ) => Promise<void>;
  requestLoadByCode: (code: string) => Promise<void>;
  loadByCodeIntoSlip: (code: string, forceMode?: CouponMode) => Promise<void>;
  rebuildBetslipFromLoadedSelections: (loadedData: unknown) => Promise<number>;
  validateSlip: (options?: { skipPreviews?: boolean }) => Promise<CouponValidationResult>;
  placeBet: () => Promise<Record<string, unknown> | null>;
  bookBet: () => Promise<Record<string, unknown> | null>;
  dismissSuccess: () => void;
  advanceSimulation: () => void;
  dismissSimulation: () => void;
  markSimulationWinShown: () => void;
  skipSimulationToResults: () => void;
}

const DEFAULT_FEATURE_CONFIG: SportsbookFeatureConfig = {
  accaBonus: null,
  flex: null,
  cutOne: null,
  stakeLimits: null,
};

const SIMULATION_KICKOFF_DURATION_SEC = 3;
const SIMULATION_CLIP_DURATION_SEC = 4;
const SIMULATION_BANNER_DURATION_SEC = 1;
const SIMULATION_HALFTIME_DURATION_SEC = 2;
const SIMULATION_UPDATE_INTERVAL_MS = 100;
const SIMULATION_DURATION_SEC =
  SIMULATION_KICKOFF_DURATION_SEC +
  (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 4 +
  SIMULATION_HALFTIME_DURATION_SEC;

const SIMULATION_STAGE_TIMINGS = {
  h1AwayBannerEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 2,
  h1AwayClipEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    SIMULATION_CLIP_DURATION_SEC +
    SIMULATION_BANNER_DURATION_SEC +
    SIMULATION_CLIP_DURATION_SEC,
  h1HomeBannerEnd:
    SIMULATION_KICKOFF_DURATION_SEC + SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC,
  h1HomeClipEnd: SIMULATION_KICKOFF_DURATION_SEC + SIMULATION_CLIP_DURATION_SEC,
  h2AwayBannerEnd: SIMULATION_DURATION_SEC,
  h2AwayClipEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 3 +
    SIMULATION_HALFTIME_DURATION_SEC +
    SIMULATION_CLIP_DURATION_SEC +
    SIMULATION_BANNER_DURATION_SEC +
    SIMULATION_CLIP_DURATION_SEC,
  h2HomeBannerEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 3 +
    SIMULATION_HALFTIME_DURATION_SEC,
  h2HomeClipEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 2 +
    SIMULATION_HALFTIME_DURATION_SEC +
    SIMULATION_CLIP_DURATION_SEC,
  halftimeEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 2 +
    SIMULATION_HALFTIME_DURATION_SEC,
  halftimeIntroEnd:
    SIMULATION_KICKOFF_DURATION_SEC +
    (SIMULATION_CLIP_DURATION_SEC + SIMULATION_BANNER_DURATION_SEC) * 2 +
    1,
  kickoffEnd: SIMULATION_KICKOFF_DURATION_SEC,
} as const;

const SIMULATION_INITIAL_STATE: CouponSimulationState = {
  currentStage: "start",
  currentTimeSec: 0,
  durationSec: SIMULATION_DURATION_SEC,
  eventsByMatchId: {},
  potentialWin: 0,
  primarySelectionId: null,
  response: null,
  resultAmountWon: 0,
  scorePhase: 0,
  selectionResultsBySelectionKey: {},
  skipRequested: false,
  startedAt: null,
  status: "idle",
  timerEnded: false,
  timerStarted: false,
  totalStake: 0,
  updateIntervalMs: SIMULATION_UPDATE_INTERVAL_MS,
  winModalShown: false,
};

function asNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeFeatureConfig(payload: unknown): SportsbookFeatureConfig {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? ((payload as { data?: unknown }).data as Record<string, unknown> | undefined)
      : (payload as Record<string, unknown> | undefined);

  return {
    accaBonus: (data?.accaBonus as FeatureConfigRecord) ?? null,
    flex: (data?.flex as FeatureConfigRecord) ?? null,
    cutOne: (data?.cutOne as FeatureConfigRecord) ?? null,
    stakeLimits: (data?.stakeLimits as FeatureConfigRecord) ?? null,
  };
}

function normalizeBonusList(payload: unknown): BonusItem[] {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;
  return Array.isArray(data) ? (data as BonusItem[]) : [];
}

function normalizeGlobalVars(payload: unknown): SportsbookGlobalVars | null {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? ((payload as { data?: unknown }).data as SportsbookGlobalVars | undefined)
      : (payload as SportsbookGlobalVars | undefined);
  return data ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getBetslipRealtimeIdentity(selection: CouponSelection) {
  const fixture = selection.fixture;
  const fixtureSportId =
    fixture && typeof fixture === "object"
      ? ((fixture.sportID ?? fixture.sport_id) as string | number | undefined)
      : undefined;
  const fixtureMatchId =
    fixture && typeof fixture === "object"
      ? ((fixture.matchID ?? fixture.match_id) as string | number | undefined)
      : undefined;
  const sportId = String(selection.sportId ?? fixtureSportId ?? "");
  const matchId = String(selection.matchId ?? fixtureMatchId ?? selection.eventId ?? "");

  if (!sportId || !matchId) return null;
  return {
    key: `${sportId}:${matchId}`,
    matchId,
    sportId,
  };
}

function buildBetslipRealtimeSelectionSignature(selections: CouponSelection[]) {
  return selections
    .map((selection) => getBetslipRealtimeIdentity(selection)?.key ?? "")
    .filter(Boolean)
    .sort()
    .join("|");
}

function normalizeBetslipMqttUpdates(payload: Record<string, unknown>) {
  const markets = Array.isArray(payload.markets)
    ? payload.markets
    : payload.market_id !== undefined || payload.marketID !== undefined
      ? [
          {
            id: payload.market_id ?? payload.marketID,
            status_name: payload.status_name ?? payload.statusName,
            specifier: payload.specifier ?? payload.specifiers ?? "",
            outcomes: payload.outcomes ?? [],
          },
        ]
      : [];

  return markets.flatMap((market) => {
    if (!isRecord(market)) return [];
    const marketId = String(market.id ?? market.market_id ?? market.marketID ?? "");
    if (!marketId) return [];

    const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
    return outcomes.flatMap((outcome) => {
      if (!isRecord(outcome)) return [];
      const outcomeId = String(outcome.id ?? outcome.outcome_id ?? outcome.outcomeID ?? "");
      if (!outcomeId) return [];

      return [
        {
          marketId,
          odds: parseCouponNumber(outcome.odds),
          outcomeId,
          specifier: String(market.specifiers ?? market.specifier ?? ""),
          statusName: String(market.status_name ?? market.statusName ?? ""),
        },
      ];
    });
  });
}

function syncBetslipRealtimeSubscriptions(selections: CouponSelection[]) {
  const nextSubscriptions = new Map<string, { matchId: string; sportId: string }>();
  selections.forEach((selection) => {
    const identity = getBetslipRealtimeIdentity(selection);
    if (identity) {
      nextSubscriptions.set(identity.key, {
        matchId: identity.matchId,
        sportId: identity.sportId,
      });
    }
  });

  nextSubscriptions.forEach((subscription, key) => {
    if (betslipRealtimeSubscriptions.has(key)) return;

    const baseTopic = `sports/${subscription.sportId}/match/${subscription.matchId}`;
    const unsubscribeOdds = subscribeMqttTopic(`${baseTopic}/markets`, (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? subscription.matchId);
      const updates = normalizeBetslipMqttUpdates(payload);
      if (updates.length) {
        useCouponStore.getState().handleOddsChange(matchId, updates);
      }
    });
    const unsubscribeBetStop = subscribeMqttTopic(`${baseTopic}/bet_stop`, (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? subscription.matchId);
      useCouponStore.getState().handleBetStop(matchId);
    });

    betslipRealtimeSubscriptions.set(key, {
      ...subscription,
      unsubscribeBetStop,
      unsubscribeOdds,
    });
  });

  betslipRealtimeSubscriptions.forEach((subscription, key) => {
    if (nextSubscriptions.has(key)) return;

    subscription.unsubscribeOdds();
    subscription.unsubscribeBetStop();
    betslipRealtimeSubscriptions.delete(key);
  });
}

function unsubscribeAllBetslipRealtimeSubscriptions() {
  betslipRealtimeSubscriptions.forEach((subscription) => {
    subscription.unsubscribeOdds();
    subscription.unsubscribeBetStop();
  });
  betslipRealtimeSubscriptions.clear();
  betslipRealtimeSelectionSignature = "";
}

function parseCouponNumber(value: unknown) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createAbandonedBetslipId(prefix = "betslip") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAbandonedBetslipStorage() {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = window.localStorage.getItem(ABANDONED_BETSLIP_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : null;
  } catch (error) {
    console.warn("Failed to read abandoned betslip storage:", error);
    return null;
  }
}

function writeAbandonedBetslipStorage(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ABANDONED_BETSLIP_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist abandoned betslip storage:", error);
  }
}

function clearAbandonedBetslipStorage() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(ABANDONED_BETSLIP_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear abandoned betslip storage:", error);
  }
}

function buildAbandonedBetslipActivitySignature(coupon: { selections?: CouponSelection[] }) {
  const selections = Array.isArray(coupon.selections) ? coupon.selections : [];
  return JSON.stringify({
    selections: selections.map((selection) => ({
      matchId: String(selection.matchId || ""),
      marketId: String(selection.marketId || ""),
      outcomeId: String(selection.outcomeId || ""),
      specifier: String(selection.specifier || ""),
    })),
  });
}

function buildAbandonedSelectionSnapshot(selection: CouponSelection) {
  const fixture = (selection.fixture ?? {}) as Record<string, unknown>;
  return {
    fixtureId: String(selection.matchId || ""),
    matchId: selection.matchId || null,
    eventId: selection.eventId || null,
    sportId: selection.sportId || fixture.sportID || null,
    producerId: selection.producerId || fixture.producerID || 0,
    marketId: Number(selection.marketId || 0),
    marketName: selection.marketName || "",
    outcomeId: String(selection.outcomeId || ""),
    outcomeName: selection.outcomeName || selection.displayName || "",
    specifier: String(selection.specifier || ""),
    odds: parseCouponNumber(selection.odds),
    eventName: selection.eventName || fixture.name || "",
    startTime: selection.startTime || fixture.date || null,
    type: selection.type || "",
  };
}

function buildAbandonedBetslipSnapshot(coupon: { selections?: CouponSelection[]; betType?: string; stake?: number; totalStake?: number; totalOdds?: number; maxWin?: number; grossWin?: number; useBonus?: boolean; useCashback?: boolean; useCutOne?: boolean; useFlex?: boolean; useEarlyGoal?: boolean; flexMinWins?: number; }) {
  const selections = Array.isArray(coupon.selections) ? coupon.selections : [];
  const potentialPayout = parseCouponNumber(
    coupon.maxWin ?? coupon.grossWin ?? 0,
  );

  return {
    betType: coupon.betType,
    stake: parseCouponNumber(coupon.stake),
    totalStake: parseCouponNumber(coupon.totalStake),
    totalOdds: parseCouponNumber(coupon.totalOdds),
    potentialPayout,
    useBonus: Boolean(coupon.useBonus),
    useCashback: Boolean(coupon.useCashback),
    useCutOne: Boolean(coupon.useCutOne),
    useFlex: Boolean(coupon.useFlex),
    flexAmount: parseCouponNumber(coupon.flexMinWins),
    useEarlyGoal: Boolean(coupon.useEarlyGoal),
    selections: selections.map(buildAbandonedSelectionSnapshot),
  };
}

function getMaxFlexMinimumWins(selectionCount: number) {
  return Math.max(2, Number(selectionCount || 0) - 1);
}

function getSimulationSelectionResultKey(
  matchId: string | number,
  marketId: string | number,
  outcomeId: string | number,
  specifier = "",
) {
  return `${matchId}:${marketId}:${outcomeId}:${specifier}`;
}

function getSimulationStage(currentTimeSec: number): CouponSimulationStage {
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.kickoffEnd) return "start";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1HomeClipEnd) return "h1_home_clip";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1HomeBannerEnd) return "h1_home_banner";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1AwayClipEnd) return "h1_away_clip";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1AwayBannerEnd) return "h1_away_banner";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.halftimeIntroEnd) return "halftime_intro";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.halftimeEnd) return "halftime_swap";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2HomeClipEnd) return "h2_home_clip";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2HomeBannerEnd) return "h2_home_banner";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2AwayClipEnd) return "h2_away_clip";
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2AwayBannerEnd) return "h2_away_banner";
  return "fulltime";
}

function getSimulationScorePhase(currentTimeSec: number): 0 | 1 | 2 | 3 | 4 {
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1HomeClipEnd) return 0;
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h1AwayClipEnd) return 1;
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2HomeClipEnd) return 2;
  if (currentTimeSec < SIMULATION_STAGE_TIMINGS.h2AwayClipEnd) return 3;
  return 4;
}

function normalizeSimulationEvents(payload: unknown) {
  const rawEventsSource = isRecord(payload) ? payload.events : null;
  const rawEvents = Array.isArray(rawEventsSource)
    ? rawEventsSource
    : typeof rawEventsSource === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(rawEventsSource);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  return rawEvents.reduce<Record<string, CouponSimulationEvent>>((accumulator, item) => {
    if (!isRecord(item)) return accumulator;
    const matchId = String(item.match_id ?? item.matchId ?? "");
    if (!matchId) return accumulator;
    const rawTimeline = Array.isArray(item.timeline)
      ? item.timeline.filter((entry): entry is Record<string, unknown> => isRecord(entry))
      : [];
    const goalEvents = rawTimeline
      .filter((entry) => String(entry.type ?? "").toLowerCase() === "goal")
      .map((entry) => ({
        minute: asNumber(entry.minute, 0),
        team: (String(entry.team ?? "").toLowerCase() === "away" ? "away" : "home") as
          | "away"
          | "home",
        type: String(entry.type ?? "goal"),
      }))
      .sort((left, right) => left.minute - right.minute);

    let homeGoals = asNumber(item.home_goals ?? item.homeGoals, 0);
    let awayGoals = asNumber(item.away_goals ?? item.awayGoals, 0);
    const finalScore = String(item.final_score ?? item.finalScore ?? "").trim();
    if (finalScore.includes("-")) {
      const [homeValue, awayValue] = finalScore.split("-").map((value) => asNumber(value, 0));
      homeGoals = homeValue;
      awayGoals = awayValue;
    }

    accumulator[matchId] = {
      awayGoals,
      finalScoreText: `${homeGoals}-${awayGoals}`,
      goalEvents,
      homeGoals,
      matchId,
      rawTimeline,
      status: item.status != null ? String(item.status) : item.statusCode != null ? String(item.statusCode) : null,
    };
    return accumulator;
  }, {});
}

function normalizeSimulationSelectionResults(payload: unknown) {
  const source = isRecord(payload)
    ? payload.selections ?? payload.selectionStatus ?? payload.selectionResults
    : null;
  const list = Array.isArray(source)
    ? source
    : [];

  return list.reduce<Record<string, CouponSimulationSelectionResult>>((accumulator, item) => {
    if (!isRecord(item)) return accumulator;
    const matchId = String(item.gameID ?? item.matchID ?? item.matchId ?? "");
    const marketId = String(item.marketID ?? item.marketId ?? "");
    const outcomeId = String(item.outcomeID ?? item.outcomeId ?? "");
    const specifier = String(item.specifier ?? "");
    if (!matchId || !marketId || !outcomeId) return accumulator;
    const wonValue = item.won;
    accumulator[getSimulationSelectionResultKey(matchId, marketId, outcomeId, specifier)] = {
      marketId,
      matchId,
      outcomeId,
      specifier,
      won:
        wonValue == null
          ? null
          : wonValue === true || wonValue === 1 || wonValue === "1",
    };
    return accumulator;
  }, {});
}

function normalizeSimulationPayload(
  response: Record<string, unknown>,
  state: CouponState,
  potentialWin: number,
) {
  const normalizedData = getBetServiceData<Record<string, unknown>>(response);
  const payload =
    isRecord(normalizedData) ? normalizedData : isRecord(response.data) ? response.data : response;
  const bets = Array.isArray(payload.bets) ? payload.bets.filter((entry): entry is Record<string, unknown> => isRecord(entry)) : [];
  const bet = bets[0];
  const eventsByMatchId = normalizeSimulationEvents(payload);
  const selectionResultsBySelectionKey = normalizeSimulationSelectionResults(payload);
  if (!Object.keys(eventsByMatchId).length && !Object.keys(selectionResultsBySelectionKey).length) {
    return null;
  }
  const resultAmountWon = asNumber(bet?.amountWon, 0);

  return {
    currentStage: getSimulationStage(0),
    currentTimeSec: 0,
    durationSec: SIMULATION_DURATION_SEC,
    eventsByMatchId,
    potentialWin,
    primarySelectionId: state.selections[0]?.selectionId ?? null,
    response,
    resultAmountWon,
    scorePhase: 0 as const,
    selectionResultsBySelectionKey,
    skipRequested: false,
    startedAt: new Date().toISOString(),
    status: "running" as const,
    timerEnded: false,
    timerStarted: false,
    totalStake: Number(state.totalStake || state.stake || 0),
    updateIntervalMs: SIMULATION_UPDATE_INTERVAL_MS,
    winModalShown: false,
  } satisfies CouponSimulationState;
}

function getActiveSelections(selections: CouponSelection[]): CouponSelection[] {
  return selections.filter(
    (selection) =>
      !selection.suspended && !selection.unavailable && Number(selection.odds || 0) > 1,
  );
}

function rebuildMatchIds(selections: CouponSelection[]): string[] {
  const ids = new Set<string>();
  for (const selection of selections) {
    if (selection.type === "live") {
      ids.add(String(selection.matchId));
    }
  }
  return [...ids];
}

/** True when the only change is a higher price on a still-open selection. */
function isSilentRise(
  selection: { odds?: number | string; suspended?: boolean; unavailable?: boolean },
  nextOdds: number,
  flags: { suspended: boolean; unavailable: boolean },
) {
  const current = Number(selection.odds || 0);
  return (
    current > 1 &&
    nextOdds > current &&
    !flags.suspended &&
    !flags.unavailable &&
    !selection.suspended &&
    !selection.unavailable
  );
}

function getSelectionStatusFlags(statusName = "") {
  const normalized = String(statusName || "").trim().toLowerCase();
  return {
    suspended: normalized === "suspended",
    unavailable: normalized === "deactivated" || normalized === "unavailable",
  };
}

function isSimulationSelectionAllowed(selection: CouponSelection) {
  const marketId = Number(selection.marketId || 0);
  return isSimulationSportAllowed(selection.sportId) && SIM_ALLOWED_MARKETS.includes(marketId);
}

function getSplitMatchIds(selections: CouponSelection[]) {
  const counts = selections.reduce<Record<string, number>>((result, selection) => {
    const key = String(selection.matchId || "");
    if (!key) return result;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([matchId]) => matchId);
}

function isSplitBetEnabled(globalVars: SportsbookGlobalVars | null) {
  const value = globalVars?.EnableSplitBet;
  if (value === undefined || value === null || value === "") {
    return true;
  }
  return String(value) === "1" || value === true || Number(value) === 1;
}

function getMaxStakeForBetType(globalVars: SportsbookGlobalVars | null, betType: CouponBetType) {
  const keys =
    betType === "System"
      ? ["comboMaxStake", "systemMaxStake", "MaxStake"]
      : betType === "Multiple"
        ? ["multipleMaxStake", "singleMaxStake", "MaxStake"]
        : ["singleMaxStake", "MaxStake"];

  for (const key of keys) {
    const value = Number(globalVars?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function getMinStakeForBetType(globalVars: SportsbookGlobalVars | null, betType: CouponBetType) {
  const keys =
    betType === "System"
      ? ["comboMinStake", "systemMinStake"]
      : ["singleMinStake"];

  for (const key of keys) {
    const value = Number(globalVars?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function normalizeStakeValue(stake: number, maxStake = 0) {
  const parsed = Number(stake);
  const normalized = Number.isFinite(parsed) ? parsed : 0;
  if (maxStake > 0 && normalized > maxStake) return maxStake;
  return normalized;
}

async function refreshCurrentUserProfile() {
  const fallbackUsername =
    useUserStore.getState().currentUser?.username ??
    useAuthStore.getState().mobileNumber ??
    undefined;
  return useUserStore.getState().refreshCurrentUser(fallbackUsername);
}

function buildSelectionRequest(selection: CouponSelection) {
  if (selection.customBetLegs?.length) return null;

  const matchId = Number.parseInt(String(selection.matchId), 10);
  const marketId = Number.parseInt(String(selection.marketId), 10);
  if (!Number.isFinite(matchId) || !Number.isFinite(marketId) || matchId <= 0 || marketId <= 0) {
    return null;
  }
  return {
    match_id: matchId,
    market_id: marketId,
    outcome_id: String(selection.outcomeId),
    producer_id: asNumber(selection.producerId, 0),
    specifier: String(selection.specifier || ""),
  };
}

function buildPreviewSelection(selection: CouponSelection) {
  if (selection.customBetLegs?.length) return null;

  return {
    marketId: parseInt(String(selection.marketId), 10),
    matchId: parseInt(String(selection.matchId), 10),
    outcomeId: String(selection.outcomeId),
    specifier: String(selection.specifier || ""),
  };
}

function buildPreviewRefreshSignature(state: CouponState) {
  const activeSelections = getActiveSelections(state.selections)
    .map((selection) =>
      [
        selection.selectionId,
        selection.currentSelectionId,
        selection.marketId,
        selection.outcomeId,
        selection.specifier || "",
        Number(selection.odds || 0),
        selection.customBetLegs?.length ? "custom_bet" : "uf",
        Number(selection.stake || 0),
      ].join(":"),
    )
    .sort()
    .join("|");

  return [
    state.betType,
    state.nativeBetType,
    state.mode,
    Number(state.stake || 0),
    Number(state.totalStake || 0),
    Number(state.flexMinWins || 0),
    Number(state.useCutOne),
    Number(state.useFlex),
    Number(state.useBonus),
    Number(state.useCashback),
    String(state.bonusId || ""),
    activeSelections,
  ].join("::");
}

function clearQueuedPreviewRefresh() {
  if (!previewRefreshTimer) return;
  clearTimeout(previewRefreshTimer);
  previewRefreshTimer = null;
}

function queuePreviewRefresh(getState: () => CouponState) {
  const state = getState();
  if (!state.isOpen || state.mode !== "real") return;
  if (
    state.isBootstrapping ||
    state.isBooking ||
    state.isConfigLoading ||
    state.isEarlyGoalLoading ||
    state.isEarlyWinLoading
  ) {
    return;
  }
  const nextSignature = buildPreviewRefreshSignature(state);
  if (
    nextSignature === previewRefreshLastCompletedSignature &&
    !previewRefreshInFlightSignature
  ) {
    return;
  }
  if (nextSignature === previewRefreshInFlightSignature) {
    return;
  }
  if (previewRefreshTimer && nextSignature === previewRefreshQueuedSignature) {
    return;
  }

  clearQueuedPreviewRefresh();
  previewRefreshQueuedSignature = nextSignature;
  previewRefreshTimer = setTimeout(() => {
    previewRefreshTimer = null;
    const nextState = getState();
    if (!nextState.isOpen || nextState.mode !== "real") return;
    previewRefreshQueuedSignature = "";
    void nextState.refreshPreviews();
  }, PREVIEW_REFRESH_DEBOUNCE_MS);
}

function getConfigEnabled(config: FeatureConfigRecord) {
  return Boolean(config?.is_active) && String(config?.status || "active").toLowerCase() === "active";
}

function markPreviewRefreshCompleted(getState: () => CouponState) {
  previewRefreshLastCompletedSignature = buildPreviewRefreshSignature(getState());
}

function getAbandonedBetslipUserContext() {
  const authState = useAuthStore.getState();
  const currentUser = useUserStore.getState().currentUser;
  const userId = currentUser?.id ?? currentUser?.userId ?? currentUser?.user_id;

  if (!authState.isAuthenticated || !authState.token || !userId) {
    return null;
  }

  return {
    userId: String(userId),
    username: String(
      currentUser?.username ??
        currentUser?.mobileNumber ??
        currentUser?.mobile_number ??
        authState.mobileNumber ??
        "",
    ),
  };
}

function clearAbandonedBetslipTimer(options: { resetSession?: boolean; clearStorage?: boolean } = {}) {
  if (abandonedBetslipTimer) {
    clearTimeout(abandonedBetslipTimer);
  }

  abandonedBetslipTimer = null;
  abandonedBetslipPendingEventId = "";

  if (options.resetSession || options.clearStorage) {
    clearAbandonedBetslipStorage();
  }

  if (options.resetSession) {
    abandonedBetslipSessionId = "";
    abandonedBetslipLastActivitySignature = "";
    abandonedBetslipLastReportedSignature = "";
  }
}

function scheduleAbandonedBetslipReport(
  getState: () => CouponState,
  signature: string,
  options: { eventId?: string; lastActivityAt?: number; snapshot?: ReturnType<typeof buildAbandonedBetslipSnapshot> } = {},
) {
  if (!getAbandonedBetslipUserContext()) return;

  if (!abandonedBetslipSessionId) {
    abandonedBetslipSessionId = createAbandonedBetslipId("session");
  }

  abandonedBetslipPendingEventId = options.eventId || createAbandonedBetslipId("abandon");
  const lastActivityAt = Number(options.lastActivityAt || Date.now());
  const elapsedMs = Date.now() - lastActivityAt;
  const delayMs = Math.max(0, ABANDONED_BETSLIP_TIMEOUT_MS - elapsedMs);
  const snapshot = options.snapshot || buildAbandonedBetslipSnapshot(getState());
  const totalLegs = Number(snapshot.selections?.length || 0);
  const potentialPayout = parseCouponNumber(snapshot.potentialPayout);

  clearAbandonedBetslipTimer();

  writeAbandonedBetslipStorage({
    sessionId: abandonedBetslipSessionId,
    eventId: abandonedBetslipPendingEventId,
    signature,
    lastActivityAt,
    totalLegs,
    potentialPayout,
    snapshot,
  });

  abandonedBetslipTimer = setTimeout(() => {
    void reportAbandonedBetslip(getState, signature, abandonedBetslipPendingEventId);
  }, delayMs);
}

async function sendAbandonedBetslipActivity(
  getState: () => CouponState,
  signature: string,
  options: { lastActivityAt?: number; eventId?: string } = {},
) {
  if (!signature) return;

  const state = getState();
  const selections = Array.isArray(state.selections) ? state.selections : [];
  if (!selections.length) return;

  const userContext = getAbandonedBetslipUserContext();
  if (!userContext) return;

  if (!abandonedBetslipSessionId) {
    abandonedBetslipSessionId = createAbandonedBetslipId("session");
  }

  const snapshot = buildAbandonedBetslipSnapshot(state);
  const payload = {
    userId: userContext.userId,
    user_id: userContext.userId,
    username: userContext.username,
    sessionId: abandonedBetslipSessionId,
    totalLegs: selections.length,
    potentialPayout: parseCouponNumber(state.maxWin || state.grossWin || 0),
    betslipSnapshot: snapshot,
    ...(options.lastActivityAt != null
      ? { lastActivityAt: new Date(options.lastActivityAt).toISOString() }
      : {}),
    ...(options.eventId ? { eventId: options.eventId } : {}),
  };

  try {
    await betsApi.reportBetslipActivity(payload);
  } catch (error) {
    console.warn("Failed to report abandoned betslip activity:", error);
  }

  if (signature !== abandonedBetslipLastActivitySignature) {
    return;
  }

  writeAbandonedBetslipStorage({
    sessionId: abandonedBetslipSessionId,
    eventId: abandonedBetslipPendingEventId || options.eventId || createAbandonedBetslipId("abandon"),
    signature,
    lastActivityAt: options.lastActivityAt || Date.now(),
    totalLegs: selections.length,
    potentialPayout: parseCouponNumber(state.maxWin || state.grossWin || 0),
    snapshot,
  });
}

async function closeAbandonedBetslipSession(status: "placed" | "cleared") {
  if (!abandonedBetslipSessionId) return;

  const sessionId = abandonedBetslipSessionId;
  try {
    await betsApi.closeBetslipSession({ sessionId, status });
  } catch (error) {
    console.warn("Failed to close abandoned betslip session:", error);
  } finally {
    if (abandonedBetslipSessionId === sessionId) {
      clearAbandonedBetslipTimer({ resetSession: true, clearStorage: true });
    }
  }
}

function refreshStoredAbandonedBetslipSnapshot(
  getState: () => CouponState,
  signature: string,
) {
  const storedSession = readAbandonedBetslipStorage();
  if (!storedSession || storedSession.signature !== signature) return;

  const snapshot = buildAbandonedBetslipSnapshot(getState());
  if (!snapshot.selections.length) return;

  writeAbandonedBetslipStorage({
    ...storedSession,
    totalLegs: snapshot.selections.length,
    potentialPayout: parseCouponNumber(snapshot.potentialPayout),
    snapshot,
  });
}

function handleAbandonedBetslipActivity(getState: () => CouponState) {
  if (!getAbandonedBetslipUserContext()) {
    clearAbandonedBetslipTimer({ resetSession: true });
    return;
  }

  const state = getState();
  const selections = Array.isArray(state.selections) ? state.selections : [];
  if (!selections.length) {
    clearAbandonedBetslipTimer({ resetSession: true });
    return;
  }

  const nextSignature = buildAbandonedBetslipActivitySignature({ selections });
  if (nextSignature === abandonedBetslipLastActivitySignature && abandonedBetslipTimer) {
    refreshStoredAbandonedBetslipSnapshot(getState, nextSignature);
    return;
  }

  const storedSession = readAbandonedBetslipStorage();
  if (nextSignature === abandonedBetslipLastReportedSignature && !storedSession) {
    return;
  }

  abandonedBetslipLastActivitySignature = nextSignature;

  if (storedSession?.signature === nextSignature && Number(storedSession?.lastActivityAt || 0) > 0) {
    abandonedBetslipSessionId = String(storedSession.sessionId || "");
    abandonedBetslipPendingEventId = String(storedSession.eventId || "");
    scheduleAbandonedBetslipReport(getState, nextSignature, {
      eventId: String(storedSession.eventId || ""),
      lastActivityAt: Number(storedSession.lastActivityAt),
    });
    return;
  }

  void sendAbandonedBetslipActivity(getState, nextSignature, {
    lastActivityAt: Date.now(),
  });
  scheduleAbandonedBetslipReport(getState, nextSignature);
}

async function reportAbandonedBetslip(
  getState: () => CouponState,
  signature: string,
  eventId?: string,
) {
  if (signature !== abandonedBetslipLastActivitySignature) return;
  if (signature === abandonedBetslipLastReportedSignature) return;

  const userContext = getAbandonedBetslipUserContext();
  if (!userContext) {
    clearAbandonedBetslipTimer({ resetSession: true });
    return;
  }

  const state = getState();
  const selections = Array.isArray(state.selections) ? state.selections : [];
  const totalLegs = selections.length;

  if (!totalLegs) {
    clearAbandonedBetslipTimer({ resetSession: true });
    return;
  }

  const betslipSnapshot = buildAbandonedBetslipSnapshot(state);
  const payload = {
    userId: userContext.userId,
    user_id: userContext.userId,
    username: userContext.username,
    totalLegs,
    potentialPayout: parseCouponNumber(
      state.maxWin || state.grossWin || state.totalStake || state.stake || 0,
    ),
    sessionId: abandonedBetslipSessionId,
    eventId: eventId || abandonedBetslipPendingEventId || createAbandonedBetslipId("abandon"),
    betslipSnapshot,
    lastActivityAt: new Date().toISOString(),
  };

  let didReport = false;
  try {
    await betsApi.reportBetslipAbandoned(payload);
    abandonedBetslipLastReportedSignature = signature;
    didReport = true;
  } catch (error) {
    console.warn("Failed to report abandoned betslip:", error);
  } finally {
    if (signature === abandonedBetslipLastActivitySignature) {
      clearAbandonedBetslipTimer({ clearStorage: didReport });
    }
  }
}

function canUseCutOneFeature(state: Pick<
  CouponState,
  | "betType"
  | "bonusId"
  | "nativeBetType"
  | "selections"
  | "sportsbookFeatureConfig"
  | "useBonus"
  | "useCashback"
  | "useFlex"
>) {
  const activeSelections = getActiveSelections(state.selections);
  const config = state.sportsbookFeatureConfig.cutOne;

  return Boolean(
    getConfigEnabled(config) &&
      !activeSelections.some((selection) => selection.customBetLegs?.length) &&
      state.betType === "Multiple" &&
      state.nativeBetType === "Multiple" &&
      !state.useFlex &&
      !state.useBonus &&
      !state.useCashback &&
      asNumber(state.bonusId, 0) === 0 &&
      activeSelections.length >= asNumber(config?.min_selections, 0) &&
      activeSelections.every(
        (selection) => Number(selection.odds || 0) >= asNumber(config?.min_odds_per_leg, 0),
      ),
  );
}

function canUseFlexFeature(state: Pick<
  CouponState,
  | "betType"
  | "bonusId"
  | "nativeBetType"
  | "selections"
  | "sportsbookFeatureConfig"
  | "useBonus"
  | "useCashback"
  | "useCutOne"
>) {
  const activeSelections = getActiveSelections(state.selections);
  const config = state.sportsbookFeatureConfig.flex;

  return Boolean(
    getConfigEnabled(config) &&
      !activeSelections.some((selection) => selection.customBetLegs?.length) &&
      state.betType === "Multiple" &&
      state.nativeBetType === "Multiple" &&
      !state.useCutOne &&
      !state.useBonus &&
      !state.useCashback &&
      asNumber(state.bonusId, 0) === 0 &&
      activeSelections.length >= asNumber(config?.min_selections, 0) &&
      (asNumber(config?.max_selections, 0) === 0 ||
        activeSelections.length <= asNumber(config?.max_selections, 0)),
  );
}

function isXUpFeatureEligibleSelection(selection: CouponSelection) {
  return Boolean(
    (selection.supportedEarlyWinModes?.length ?? 0) > 0 ||
      selection.earlyWinMode === "1up" ||
      selection.earlyWinMode === "2up",
  );
}

function isEarlyGoalFeatureEligibleSelection(selection: CouponSelection) {
  if (selection.customBetLegs?.length) return false;
  return Boolean(selection.supportsEarlyGoal || selection.earlyGoalMode === "earlygoal");
}

function getSelectionConflictKey(selection: CouponSelection) {
  if (selection.customBetLegs?.length) {
    return `${selection.matchId}:custom_bet:${selection.selectionId}`;
  }

  const baseMarketId = Number(selection.baseMarketId || selection.marketId || 0);
  const specifier = String(
    selection.baseSelectionKeySpecifier ??
      selection.baseSpecifier ??
      selection.selectionKeySpecifier ??
      selection.specifier ??
      "",
  );
  return `${selection.matchId}:${baseMarketId}:${specifier}`;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function getSelectionsNativeBetType(selections: CouponSelection[]): NativeCouponBetType {
  if (selections.length <= 1) return "Single";
  const grouped = groupSelections(
    selections.map((selection) => ({
      eventDate: selection.startTime ?? new Date().toISOString(),
      eventId: selection.eventId,
      eventName: selection.eventName,
      matchId: selection.matchId,
      type: selection.type,
    })),
  );
  return checkBetType(grouped as Parameters<typeof checkBetType>[0]);
}

function resolveSlipType(
  requested: CouponBetType,
  selections: CouponSelection[],
): CouponBetType {
  if (selections.length <= 1) {
    return "Single";
  }

  if (requested === "System") {
    const maxGrouping = couponCalculation
      .calcCombinations({
        Groupings: [],
        selections: selections.map((selection) => ({
          fixed: Boolean(selection.fixed),
          matchId: selection.matchId,
          odds: Number(selection.odds || 0),
        })),
      })
      .Groups.filter((group) => group.Grouping > 1 && group.Combinations > 0)
      .map((group) => group.Grouping);

    return maxGrouping.length ? "System" : "Multiple";
  }

  return requested;
}

function normalizeSelection(selection: CouponSelection): CouponSelection {
  if (selection.customBetLegs?.length) {
    const selectionId = String(selection.selectionId || selection.id || selection.currentSelectionId);
    return {
      ...selection,
      currentSelectionId: selectionId,
      displayName: selection.displayName || "BetBuilder",
      id: selectionId,
      marketName: selection.marketName || "BetBuilder",
      odds: asNumber(selection.odds, 0),
      outcomeName: selection.outcomeName || `${selection.customBetLegs.length} picks`,
      selectionId,
      type: "prematch",
    };
  }

  const fixture = (selection.fixture ?? {}) as Record<string, unknown>;
  const currentMarketId = Number(selection.marketId || 0);
  const currentMarketName = String(selection.marketName || "").trim();
  const currentOutcomeId = String(selection.outcomeId || "");
  const currentOutcomeName = String(selection.outcomeName || "").trim();
  const currentDisplayName = String(selection.displayName ?? selection.outcomeName ?? "").trim();
  const currentSpecifier = firstNonEmptyString(
    selection.specifier,
    (selection.market as { specifier?: string; specifiers?: string } | undefined)?.specifier,
    (selection.market as { specifiers?: string } | undefined)?.specifiers,
    (selection.outcome as { specifier?: string; specifiers?: string } | undefined)?.specifier,
    (selection.outcome as { specifiers?: string } | undefined)?.specifiers,
  );
  const currentSelectionKeySpecifier = firstNonEmptyString(
    selection.selectionKeySpecifier,
    (selection.outcome as { specifier?: string; specifiers?: string } | undefined)?.specifier,
    (selection.outcome as { specifiers?: string } | undefined)?.specifiers,
    (selection.market as { specifier?: string; specifiers?: string } | undefined)?.specifier,
    (selection.market as { specifiers?: string } | undefined)?.specifiers,
    currentSpecifier,
  );
  const sportId = (selection.sportId ??
    fixture.sportID ??
    fixture.sport_id ??
    "1") as string | number;
  const derivedMarketIds = [
    ...(Array.isArray(selection.supportedDerivedMarketIds) ? selection.supportedDerivedMarketIds : []),
    ...(Array.isArray(selection.supportedEarlyGoalMarketIds)
      ? selection.supportedEarlyGoalMarketIds
      : []),
    ...(Array.isArray(fixture.derived_market_ids)
      ? (fixture.derived_market_ids as unknown[])
      : fixture.derived_market_id != null
        ? [fixture.derived_market_id]
        : []),
    ...([1601, EARLY_GOAL_DERIVED_MARKET_ID].includes(currentMarketId)
      ? [currentMarketId]
      : []),
  ];

  const earlyWinState = buildEarlyWinSelectionState({
    derivedMarketIds,
    marketId: currentMarketId,
    marketName: currentMarketName,
    specifier: currentSpecifier,
    sportId,
    fixture: fixture as Parameters<typeof buildEarlyWinSelectionState>[0]["fixture"],
  });
  const earlyWinLocalQuotes = {
    ...buildEarlyWinLocalQuoteMap({
      baseMarketId: earlyWinState.baseMarketId,
      baseMarketName: earlyWinState.baseMarketName,
      displayName: currentDisplayName,
      fixture: fixture as Parameters<typeof buildEarlyWinLocalQuoteMap>[0]["fixture"],
      marketId: currentMarketId,
      outcomeId: currentOutcomeId,
      outcomeName: currentOutcomeName,
      specifier: currentSpecifier,
      sportId,
      supportedDerivedMarketIds: earlyWinState.supportedDerivedMarketIds,
    }),
    ...(selection.earlyWinLocalQuotes ?? {}),
  };

  const earlyGoalState = buildEarlyGoalSelectionState({
    baseMarketId: earlyWinState.baseMarketId,
    derivedMarketIds,
    marketId: currentMarketId,
    marketName: currentMarketName,
    sportId,
  });
  const earlyGoalLocalQuotes = {
    ...buildEarlyGoalLocalQuoteMap({
      baseMarketId: earlyGoalState.baseMarketId,
      baseMarketName: earlyGoalState.baseMarketName,
      derivedMarketIds,
      displayName: currentDisplayName,
      fixture: fixture as Parameters<typeof buildEarlyGoalLocalQuoteMap>[0]["fixture"],
      marketId: currentMarketId,
      outcomeId: currentOutcomeId,
      outcomeName: currentOutcomeName,
      specifier: currentSpecifier,
      sportId,
    }),
    ...(selection.earlyGoalLocalQuotes ?? {}),
  };

  const currentQuote =
    earlyGoalState.earlyGoalMode === "earlygoal"
      ? earlyGoalLocalQuotes.earlygoal ?? null
      : earlyWinLocalQuotes[earlyWinState.earlyWinMode] ?? null;
  const baseQuote =
    earlyGoalState.isEarlyGoalMarketCandidate
      ? earlyGoalLocalQuotes.base ?? null
      : earlyWinLocalQuotes.base ?? null;

  const baseOutcomeId = baseQuote?.outcomeId || String(selection.baseOutcomeId || currentOutcomeId);
  const baseOutcomeName = baseQuote?.outcomeName || String(selection.baseOutcomeName || currentOutcomeName);
  const baseDisplayName = baseQuote?.displayName || String(selection.baseDisplayName || currentDisplayName);
  const baseOdds = asNumber(baseQuote?.odds ?? selection.baseOdds ?? selection.odds, 0);
  const baseStatusName = String(baseQuote?.statusName || selection.baseStatusName || "Active");
  const baseSpecifier = String(
    firstNonEmptyString(
      baseQuote?.specifier,
      selection.baseSpecifier,
      earlyWinState.earlyWinMode === "base" ? currentSpecifier : "",
    ),
  );
  const baseSelectionKeySpecifier = String(
    firstNonEmptyString(
      baseQuote?.idSpecifier,
      selection.baseSelectionKeySpecifier,
      earlyWinState.earlyWinMode === "base" ? currentSelectionKeySpecifier : "",
    ),
  );
  const resolvedOutcomeId = currentQuote?.outcomeId || currentOutcomeId;
  const resolvedOutcomeName = currentQuote?.outcomeName || currentOutcomeName;
  const resolvedDisplayName = currentQuote?.displayName || currentDisplayName;
  const resolvedSpecifier = firstNonEmptyString(currentQuote?.specifier, currentSpecifier);
  const resolvedSelectionKeySpecifier = firstNonEmptyString(
    currentQuote?.idSpecifier,
    currentSelectionKeySpecifier,
  );
  const isXupSelection = currentMarketId === 1601;
  const stableSelectionKeySpecifier = isXupSelection ? "" : baseSelectionKeySpecifier;
  const stableSelectionId = createID(
    selection.matchId,
    earlyWinState.baseMarketId,
    baseOutcomeId,
    stableSelectionKeySpecifier,
    earlyWinState.baseMarketName,
    baseOutcomeName,
  );
  const currentSelectionId = createID(
    selection.matchId,
    currentQuote?.marketId ?? currentMarketId,
    resolvedOutcomeId,
    resolvedSelectionKeySpecifier,
    currentQuote?.marketName ?? currentMarketName,
    resolvedOutcomeName,
  );
  const statusName = String(currentQuote?.statusName || selection.market?.statusName || "Active");
  const statusFlags = getSelectionStatusFlags(statusName);
  const incomingStatusName = String(selection.statusName ?? selection.market?.statusName ?? "").trim();
  const shouldPreserveExplicitFlags = Boolean(
    (selection.suspended || selection.unavailable) &&
      !incomingStatusName &&
      String(currentQuote?.statusName ?? "").trim().toLowerCase() === "active",
  );
  const isSuspended = shouldPreserveExplicitFlags ? Boolean(selection.suspended) : statusFlags.suspended;
  const isUnavailable = shouldPreserveExplicitFlags ? Boolean(selection.unavailable) : statusFlags.unavailable;
  const nextOdds = isUnavailable ? 0 : asNumber(currentQuote?.odds ?? selection.odds, 0);
  const supportsEarlyWin =
    Number(earlyWinState.baseMarketId || 0) === 1 &&
    isSupportedDerivedOutcome({
      baseMarketId: earlyWinState.baseMarketId,
      displayName: baseDisplayName,
      mode: "1up",
      outcomeId: baseOutcomeId,
      outcomeName: baseOutcomeName,
      specifier: baseSpecifier,
    });
  const supportedEarlyWinModes: string[] = supportsEarlyWin
    ? earlyWinState.supportedEarlyWinModes
    : [];
  const supportsEarlyGoal =
    Number(earlyGoalState.baseMarketId || 0) === 18 &&
    isSupportedDerivedOutcome({
      baseMarketId: earlyGoalState.baseMarketId,
      displayName: baseDisplayName,
      mode: "earlygoal",
      outcomeId: baseOutcomeId,
      outcomeName: baseOutcomeName,
      specifier: baseSpecifier,
    });
  const currentMarketLabel =
    earlyGoalState.earlyGoalMode === "earlygoal"
      ? formatEarlyGoalMarketName(earlyGoalState.baseMarketName, "earlygoal")
      : formatEarlyWinMarketName(earlyWinState.baseMarketName, earlyWinState.earlyWinMode);

  return {
    ...selection,
    id: stableSelectionId,
    selectionId: stableSelectionId,
    currentSelectionId,
    displayName: resolvedDisplayName,
    earlyGoalLabel: formatEarlyGoalMarketName(
      earlyGoalState.baseMarketName,
      earlyGoalState.earlyGoalMode,
    ),
    earlyGoalLocalQuotes,
    earlyGoalMode: earlyGoalState.earlyGoalMode,
    earlyWinLabel: formatEarlyWinMarketName(
      earlyWinState.baseMarketName,
      earlyWinState.earlyWinMode,
    ),
    earlyWinLocalQuotes,
    earlyWinMode: earlyWinState.earlyWinMode,
    hasExplicitDerivedMarkets: earlyWinState.hasExplicitDerivedMarkets,
    marketId: String(currentQuote?.marketId ?? selection.marketId),
    marketName: currentMarketLabel || selection.marketName,
    odds: nextOdds,
    outcomeId: resolvedOutcomeId,
    outcomeName: resolvedOutcomeName,
    selectionKeySpecifier: resolvedSelectionKeySpecifier,
    specifier: resolvedSpecifier,
    statusName,
    supportedDerivedMarketIds: earlyWinState.supportedDerivedMarketIds,
    supportedEarlyGoalMarketIds: earlyGoalState.supportedDerivedMarketIds,
    supportedEarlyWinModes,
    supportsEarlyGoal,
    supportsEarlyWin,
    suspended: isSuspended,
    unavailable: isUnavailable,
    baseDisplayName,
    baseMarketId: earlyWinState.baseMarketId,
    baseMarketName: earlyWinState.baseMarketName,
    baseOdds,
    baseOutcomeId,
    baseOutcomeName,
    baseSelectionKeySpecifier,
    baseSpecifier,
    baseStatusName,
  };
}

function deriveFeatureState(selections: CouponSelection[]) {
  const earlyWinSelections = selections.filter(isXUpFeatureEligibleSelection);
  const earlyGoalSelections = selections.filter(isEarlyGoalFeatureEligibleSelection);

  const earlyWinBulkMode: DerivedSelectionMode =
    earlyWinSelections.length > 0 &&
    earlyWinSelections.every((selection) => selection.earlyWinMode === "1up")
      ? "1up"
      : earlyWinSelections.length > 0 &&
          earlyWinSelections.every((selection) => selection.earlyWinMode === "2up")
        ? "2up"
        : "base";

  return {
    earlyWinBulkMode,
    useEarlyGoal:
      earlyGoalSelections.length > 0 &&
      earlyGoalSelections.every((selection) => selection.earlyGoalMode === "earlygoal"),
  };
}

function patchLocalQuoteMap(
  quoteMap: Record<string, EarlyWinQuote> | undefined,
  update: { marketId: string; outcomeId: string; odds: number; specifier?: string; statusName?: string },
) {
  if (!quoteMap) return quoteMap;
  const nextMap = { ...quoteMap };
  Object.entries(nextMap).forEach(([key, quote]) => {
    if (!quote) return;
    if (String(quote.marketId) !== String(update.marketId)) return;
    if (String(quote.outcomeId) !== String(update.outcomeId)) return;
    if (
      update.specifier != null &&
      String(quote.idSpecifier || quote.specifier || "") !== String(update.specifier || "")
    ) {
      return;
    }
    nextMap[key] = {
      ...quote,
      active: update.statusName?.toLowerCase() === "suspended" ? 0 : quote.active,
      odds: Number(update.odds),
      statusName: String(update.statusName || quote.statusName || "Active"),
    };
  });
  return nextMap;
}

function patchSelectionQuoteUpdate(
  selection: CouponSelection,
  update: { marketId: string; outcomeId: string; odds: number; specifier?: string; statusName?: string },
): CouponSelection {
  const statusName = String(update.statusName || "Active");
  const statusFlags = getSelectionStatusFlags(statusName);
  const nextOdds = statusFlags.unavailable ? 0 : Number(update.odds || 0);
  const nextActive = statusFlags.suspended || statusFlags.unavailable ? 0 : 1;
  const matchesUpdate = (value: Record<string, unknown>) =>
    String(
      value.outcomeID ?? value.outcomeId ?? value.outcome_id ?? value.id ?? "",
    ) === String(update.outcomeId) &&
    String(value.specifier ?? value.specifiers ?? "") === String(update.specifier || "");
  const patchOutcome = (value: unknown) => {
    if (!isRecord(value) || !matchesUpdate(value)) return value;
    return {
      ...value,
      active: nextActive,
      isActive: nextActive,
      odds: nextOdds,
      specifier: String(update.specifier || value.specifier || value.specifiers || ""),
    };
  };
  const patchMarket = (value: unknown) => {
    if (!isRecord(value)) return value;
    if (String(value.marketID ?? value.marketId ?? value.market_id ?? value.id ?? "") !== String(update.marketId)) {
      return value;
    }
    return {
      ...value,
      outcomes: Array.isArray(value.outcomes) ? value.outcomes.map(patchOutcome) : value.outcomes,
      statusName,
      status_name: statusName,
    };
  };
  const fixture = isRecord(selection.fixture) ? selection.fixture : null;

  return {
    ...selection,
    earlyGoalLocalQuotes: patchLocalQuoteMap(selection.earlyGoalLocalQuotes, update),
    earlyWinLocalQuotes: patchLocalQuoteMap(selection.earlyWinLocalQuotes, update),
    fixture: fixture
      ? {
          ...fixture,
          market: Array.isArray(fixture.market) ? fixture.market.map(patchMarket) : fixture.market,
          markets: Array.isArray(fixture.markets) ? fixture.markets.map(patchMarket) : fixture.markets,
          outcomes: Array.isArray(fixture.outcomes) ? fixture.outcomes.map(patchOutcome) : fixture.outcomes,
        }
      : selection.fixture,
    market: isRecord(selection.market)
      ? (patchMarket(selection.market) as Record<string, unknown>)
      : selection.market,
    odds: nextOdds,
    outcome: isRecord(selection.outcome)
      ? (patchOutcome(selection.outcome) as Record<string, unknown>)
      : selection.outcome,
    suspended: statusFlags.suspended,
    unavailable: statusFlags.unavailable,
  };
}

function getSingleSelectionStake(selection: CouponSelection, fallbackStake: number) {
  const selectionStake = Number(selection.stake ?? 0);
  return selectionStake > 0 ? selectionStake : Number(fallbackStake || 0);
}

function computeBaseCouponState(input: {
  betType: CouponBetType;
  bonusList: BonusItem[];
  globalVars: SportsbookGlobalVars | null;
  nativeBetType: NativeCouponBetType;
  previousCombos: CouponCombo[];
  selections: CouponSelection[];
  stake: number;
}) {
  const { betType, bonusList, globalVars, nativeBetType, previousCombos, selections, stake } = input;
  const activeSelections = getActiveSelections(selections);
  const hasLive = selections.some((selection) => selection.type === "live");
  const activeMatchIds = rebuildMatchIds(selections);

  if (!activeSelections.length) {
    const singleStakeTotal =
      betType === "Single"
        ? selections.reduce((sum, selection) => sum + getSingleSelectionStake(selection, stake), 0)
        : 0;
    return {
      activeMatchIds,
      combos: [] as CouponCombo[],
      Groupings: [] as CouponCombo[],
      grossWin: 0,
      hasLive,
      maxBonus: 0,
      maxWin: 0,
      minWin: 0,
      minOdds: 0,
      totalOdds: 0,
      totalStake: betType === "Single" ? singleStakeTotal : stake,
      wthTax: 0,
    };
  }

  if (betType === "Single") {
    const totalStake = activeSelections.reduce(
      (sum, selection) => sum + getSingleSelectionStake(selection, stake),
      0,
    );
    const maxWin = activeSelections.reduce(
      (sum, selection) => sum + Number(selection.odds || 0) * getSingleSelectionStake(selection, stake),
      0,
    );
    const totalOdds = activeSelections.reduce((sum, selection) => sum + Number(selection.odds || 0), 0);
    return {
      activeMatchIds,
      combos: [],
      Groupings: [],
      grossWin: maxWin,
      hasLive,
      maxBonus: 0,
      maxWin,
      minWin: maxWin,
      minOdds: totalOdds,
      totalOdds: Number(totalOdds.toFixed(2)),
      totalStake,
      wthTax: 0,
    };
  }

  if (betType === "System") {
    const baseCoupon = {
      Groupings: [] as Array<{ Grouping: number; Combinations: number; Stake: number }>,
      selections: activeSelections.map((selection) => ({
        fixed: Boolean(selection.fixed),
        matchId: selection.matchId,
        odds: Number(selection.odds || 0),
      })),
    };
    const availableGroups = couponCalculation
      .calcCombinations(baseCoupon)
      .Groups.filter((group) => group.Grouping > 1 && group.Combinations > 0);
    const previousStakes = previousCombos
      .map((combo) => Number(combo.Stake || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    const hasCommonStake =
      previousCombos.length > 0 &&
      previousStakes.length === previousCombos.length &&
      previousStakes.every((value) => value === previousStakes[0]);
    const commonStake = hasCommonStake ? previousStakes[0] : null;
    const combos = availableGroups.map((group) => ({
      Combinations: group.Combinations,
      Grouping: group.Grouping,
      Stake: normalizeStakeValue(
        commonStake ??
          previousCombos.find((combo) => Number(combo.Grouping) === Number(group.Grouping))?.Stake ??
          0,
        getMaxStakeForBetType(globalVars, "System"),
      ),
      checked: false,
      maxWin: 0,
      minWin: 0,
    }));
    const Groupings = combos.filter((combo) => Number(combo.Stake || 0) > 0);
    const calculatedCoupon = couponCalculation.calcPotentialWins(
      {
        Groupings,
        selections: baseCoupon.selections,
        stake,
        totalStake: Groupings.reduce((sum, combo) => sum + combo.Combinations * combo.Stake, 0),
      },
      bonusList,
      asNumber(globalVars?.MinBonusOdd, 0),
    );
    const calculatedGroups = calculatedCoupon.Groups.map((group) => ({
      Combinations: group.Combinations,
      Grouping: group.Grouping,
      Stake: Groupings.find((combo) => combo.Grouping === group.Grouping)?.Stake ?? 0,
      checked: true,
      maxWin: group.MaxWin(),
      minWin: group.MinWin(),
    }));
    const decoratedCombos = combos.map((combo) => {
      const calculatedGroup = calculatedGroups.find((group) => group.Grouping === combo.Grouping);
      return calculatedGroup ?? combo;
    });
    const totalStake = Groupings.reduce((sum, combo) => sum + combo.Combinations * combo.Stake, 0);
    const maxBonus = calculatedCoupon.Groups.reduce((sum, group) => sum + group.MaxBonus(), 0);
    const maxWin = calculatedCoupon.Groups.reduce((sum, group) => sum + group.MaxWin(), 0);
    const minWin = calculatedCoupon.Groups.reduce((sum, group) => sum + group.MinWin(), 0);
    return {
      activeMatchIds,
      combos: decoratedCombos,
      Groupings: calculatedGroups,
      grossWin: maxWin,
      hasLive,
      maxBonus,
      maxWin,
      minWin,
      minOdds: totalStake > 0 ? Number((minWin / totalStake).toFixed(2)) : 0,
      totalOdds: totalStake > 0 ? Number((maxWin / totalStake).toFixed(2)) : 0,
      totalStake,
      wthTax: 0,
    };
  }

  if (betType === "Multiple" && nativeBetType === "Split") {
    const splitCoupon = calculateSplitProps({
      maxBonus: 0,
      maxOdds: 0,
      maxWin: 0,
      minBonus: 0,
      minOdds: 0,
      minStake: stake,
      minWin: 0,
      selections: activeSelections.map((selection) => ({
        matchId: selection.matchId,
        odds: Number(selection.odds || 0),
      })),
      stake,
      totalStake: stake,
    });

    return {
      activeMatchIds,
      combos: [],
      Groupings: [],
      grossWin: Number(splitCoupon.maxWin || 0),
      hasLive,
      maxBonus: 0,
      maxWin: Number(splitCoupon.maxWin || 0),
      minOdds: Number(splitCoupon.minOdds || 0),
      minWin: Number(splitCoupon.minWin || splitCoupon.maxWin || 0),
      totalOdds: Number(splitCoupon.maxOdds || 0),
      totalStake: Number(splitCoupon.minStake || stake || 0),
      wthTax: 0,
    };
  }

  const totalOdds = Number(calculateTotalOdds(activeSelections).toFixed(2));
  const totalStake = stake;
  const winnings = calculateWinnings(
    {
      selections: activeSelections.map((selection) => ({ odds: Number(selection.odds || 0) })),
      totalOdds,
      totalStake,
    },
    globalVars ? { MinBonusOdd: asNumber(globalVars.MinBonusOdd, 0) } : null,
    nativeBetType === "Multiple" ? bonusList : [],
  );

  return {
    activeMatchIds,
    combos: [],
    Groupings: [],
    grossWin: Number(winnings.grossWin || 0),
    hasLive,
    maxBonus: Number(winnings.maxBonus || 0),
    maxWin: Number(winnings.maxWin || 0),
    minOdds: totalOdds,
    minWin: Number(winnings.maxWin || 0),
    totalOdds,
    totalStake,
    wthTax: Number(winnings.wthTax || 0),
  };
}

function resetSelectionToBaseMode(selection: CouponSelection) {
  return normalizeSelection({
    ...selection,
    displayName: String(selection.baseDisplayName || selection.displayName || selection.outcomeName || ""),
    earlyGoalMode: "base",
    earlyWinMode: "base",
    marketId: String(selection.baseMarketId || selection.marketId || ""),
    marketName: String(selection.baseMarketName || selection.marketName || ""),
    odds: asNumber(selection.baseOdds ?? selection.odds, 0),
    outcomeId: String(selection.baseOutcomeId || selection.outcomeId || ""),
    outcomeName: String(selection.baseOutcomeName || selection.outcomeName || ""),
    selectionKeySpecifier: String(
      selection.baseSelectionKeySpecifier ?? selection.selectionKeySpecifier ?? selection.specifier ?? "",
    ),
    specifier: String(selection.baseSpecifier ?? selection.specifier ?? ""),
    statusName: String(selection.baseStatusName || selection.statusName || "Active"),
  });
}

function sanitizeSelectionsForFeatureEligibility(selections: CouponSelection[]) {
  const hasXUpSupport = selections.some((selection) => Boolean(selection.hasExplicitDerivedMarkets));
  const hasEarlyGoalSupport = selections.some((selection) => Boolean(selection.supportsEarlyGoal));

  return selections.map((selection) => {
    if (!hasXUpSupport && (selection.earlyWinMode === "1up" || selection.earlyWinMode === "2up")) {
      return resetSelectionToBaseMode(selection);
    }

    if (!hasEarlyGoalSupport && selection.earlyGoalMode === "earlygoal") {
      return resetSelectionToBaseMode(selection);
    }

    return selection;
  });
}

function resolveSimulationMode(
  mode: CouponMode,
  simulationRealSnapshot: SimulationRealSnapshot | null,
) {
  if (mode !== "sim") return "real" as const;
  return simulationRealSnapshot ? ("sim" as const) : ("real" as const);
}

function applyCouponState(state: CouponState, overrides: Partial<CouponState> = {}) {
  const nextGlobalVars = overrides.globalVars ?? state.globalVars;
  const initialSelections = sanitizeSelectionsForFeatureEligibility(overrides.selections ?? state.selections);
  const splitMatchIds = getSplitMatchIds(initialSelections);
  const hasSplitBet = splitMatchIds.length > 0;
  const selections = hasSplitBet
    ? initialSelections.map((selection) =>
        selection.fixed ? { ...selection, fixed: false } : selection,
      )
    : initialSelections;
  const nativeBetType = overrides.nativeBetType ?? getSelectionsNativeBetType(selections);
  const requestedBetType =
    hasSplitBet && (overrides.betType ?? state.betType) === "System"
      ? "Multiple"
      : (overrides.betType ?? state.betType);
  const resolvedBetType = resolveSlipType(requestedBetType, selections);
  const stake = overrides.stake ?? state.stake;
  const featureState = deriveFeatureState(selections);
  const base = computeBaseCouponState({
    betType: resolvedBetType,
    bonusList: overrides.bonusList ?? state.bonusList,
    globalVars: nextGlobalVars,
    nativeBetType,
    previousCombos: overrides.combos ?? state.combos,
    selections,
    stake,
  });
  const nextUseFlexCandidate = Boolean(overrides.useFlex ?? state.useFlex);
  const nextUseBonus = Boolean(overrides.useBonus ?? state.useBonus);
  const nextUseCashback = Boolean(overrides.useCashback ?? state.useCashback);
  const nextBonusId = overrides.bonusId ?? state.bonusId;
  const nextSportsbookFeatureConfig =
    overrides.sportsbookFeatureConfig ?? state.sportsbookFeatureConfig;
  const nextUseFlex = nextUseFlexCandidate
    ? canUseFlexFeature({
        betType: resolvedBetType,
        bonusId: nextBonusId,
        nativeBetType,
        selections,
        sportsbookFeatureConfig: nextSportsbookFeatureConfig,
        useBonus: nextUseBonus,
        useCashback: nextUseCashback,
        useCutOne: false,
      })
    : false;
  const nextUseCutOneCandidate = Boolean(overrides.useCutOne ?? state.useCutOne);
  const nextUseCutOne = nextUseCutOneCandidate
    ? canUseCutOneFeature({
        betType: resolvedBetType,
        bonusId: nextBonusId,
        nativeBetType,
        selections,
        sportsbookFeatureConfig: nextSportsbookFeatureConfig,
        useBonus: nextUseBonus,
        useCashback: nextUseCashback,
        useFlex: nextUseFlex,
      })
    : false;

  return {
    ...overrides,
    ...base,
    betType: resolvedBetType,
    hasSplitBet,
    minOdds: base.minOdds,
    nativeBetType,
    selections,
    stake,
    splitMatchIds,
    earlyWinBulkMode: featureState.earlyWinBulkMode,
    useCutOne: nextUseCutOne,
    useEarlyGoal: featureState.useEarlyGoal,
    useFlex: nextUseFlex,
  };
}

async function fetchSelectionFixture(selection: CouponSelection) {
  const fixture = (selection.fixture ?? {}) as { market?: unknown[]; markets?: unknown[]; outcomes?: unknown[] };
  if (Array.isArray(fixture.market) || Array.isArray(fixture.markets) || Array.isArray(fixture.outcomes)) {
    return selection;
  }

  const response = await sportsApi.getFixtureMarkets(selection.matchId);
  const detail =
    response && typeof response === "object" && "data" in response
      ? ((response as { data?: unknown }).data as Record<string, unknown> | undefined)
      : (response as Record<string, unknown> | undefined);
  if (!detail) return selection;

  return {
    ...selection,
    fixture: {
      ...(selection.fixture ?? {}),
      market: Array.isArray(detail.market) ? detail.market : detail.markets,
      markets: Array.isArray(detail.markets) ? detail.markets : detail.market,
      outcomes: Array.isArray(detail.outcomes) ? detail.outcomes : [],
    },
  };
}

async function fetchEarlyWinQuoteForSelection(
  selection: CouponSelection,
  mode: EarlyWinMode,
  targetMarketId: number,
) {
  const response = await betsApi.validateSelections([
    {
      match_id: parseInt(String(selection.matchId), 10),
      market_id: targetMarketId,
      outcome_id: String(selection.baseOutcomeId || selection.outcomeId),
      producer_id: asNumber(selection.producerId, 0),
      specifier:
        mode === "base"
          ? selection.baseSpecifier ?? selection.specifier ?? ""
          : getDerivedSpecifierForMode(selection.baseMarketId || 1, mode),
    },
  ]);

  const validatedList =
    response && typeof response === "object" && "data" in response
      ? ((response as { data?: unknown }).data as unknown)
      : response;
  const [validatedQuote] = Array.isArray(validatedList)
    ? validatedList
    : validatedList && typeof validatedList === "object"
      ? Object.values(validatedList)
      : [];
  if (!validatedQuote || typeof validatedQuote !== "object") return null;

  const source = validatedQuote as Record<string, unknown>;
  return {
    active: String(source.status_name || source.statusName || "Active").toLowerCase() === "suspended" ? 0 : 1,
    displayName:
      String(source.display_name || source.displayName || selection.baseDisplayName || selection.displayName || ""),
    idSpecifier: String(source.specifier ?? selection.baseSelectionKeySpecifier ?? ""),
    marketId: asNumber(source.market_id ?? source.marketId, targetMarketId),
    marketName: formatEarlyWinMarketName(selection.baseMarketName || selection.marketName, mode),
    odds: asNumber(source.odds, 0),
    outcomeId: String(source.outcome_id || source.outcomeId || selection.baseOutcomeId || selection.outcomeId),
    outcomeName:
      String(source.outcome_name || source.outcomeName || selection.baseOutcomeName || selection.outcomeName),
    specifier: String(source.specifier ?? selection.baseSpecifier ?? ""),
    statusName: String(source.status_name || source.statusName || "Active"),
  } satisfies EarlyWinQuote;
}

async function fetchEarlyGoalQuoteForSelection(
  selection: CouponSelection,
  mode: DerivedSelectionMode,
  targetMarketId: number,
) {
  const localQuote = selection.earlyGoalLocalQuotes?.[mode];
  const baseSpecifier = selection.baseSpecifier ?? selection.specifier ?? "";
  const specifier =
    mode === "base"
      ? toEarlyGoalBaseSpecifier(localQuote?.specifier || baseSpecifier)
      : String(
          localQuote?.specifier ||
            selection.earlyGoalLocalQuotes?.earlygoal?.specifier ||
            selection.specifier ||
            "",
        );
  if (mode === "earlygoal" && !specifier.includes("minsnr=")) return null;

  const response = await betsApi.validateSelections([
    {
      match_id: parseInt(String(selection.matchId), 10),
      market_id: targetMarketId,
      outcome_id: String(selection.baseOutcomeId || selection.outcomeId),
      producer_id: asNumber(selection.producerId, 0),
      specifier,
    },
  ]);

  const validatedList =
    response && typeof response === "object" && "data" in response
      ? ((response as { data?: unknown }).data as unknown)
      : response;
  const [validatedQuote] = Array.isArray(validatedList)
    ? validatedList
    : validatedList && typeof validatedList === "object"
      ? Object.values(validatedList)
      : [];
  if (!validatedQuote || typeof validatedQuote !== "object") return null;

  const source = validatedQuote as Record<string, unknown>;
  return {
    active: String(source.status_name || source.statusName || "Active").toLowerCase() === "suspended" ? 0 : 1,
    displayName:
      String(source.display_name || source.displayName || selection.baseDisplayName || selection.displayName || ""),
    idSpecifier: String(source.specifier ?? specifier),
    marketId: asNumber(source.market_id ?? source.marketId, targetMarketId),
    marketName: formatEarlyGoalMarketName(selection.baseMarketName || selection.marketName, mode),
    odds: asNumber(source.odds, 0),
    outcomeId: String(source.outcome_id || source.outcomeId || selection.baseOutcomeId || selection.outcomeId),
    outcomeName:
      String(source.outcome_name || source.outcomeName || selection.baseOutcomeName || selection.outcomeName),
    specifier: String(source.specifier ?? specifier),
    statusName: String(source.status_name || source.statusName || "Active"),
  } satisfies EarlyWinQuote;
}

function extractLoadedSelections(loadedData: unknown) {
  if (Array.isArray(loadedData)) return loadedData;
  if (!loadedData || typeof loadedData !== "object") return [];
  const direct = loadedData as { selections?: unknown[]; data?: { selections?: unknown[] } };
  if (Array.isArray(direct.selections)) return direct.selections;
  if (Array.isArray(direct.data?.selections)) return direct.data.selections;
  return [];
}

function buildSelectionFromLoadedPayload(rawSelection: Record<string, unknown>): CouponSelection {
  const matchId = rawSelection.matchId ?? rawSelection.match_id ?? rawSelection.eventId ?? rawSelection.event_id;
  const marketId = rawSelection.marketId ?? rawSelection.market_id ?? 0;
  const outcomeId = rawSelection.outcomeId ?? rawSelection.outcome_id ?? rawSelection.odd_id ?? "";
  const eventName = String(rawSelection.eventName ?? rawSelection.event_name ?? "");
  const [homeTeam = "", awayTeam = ""] = eventName.split(/\s+vs\.?\s+/i);
  const marketName = String(rawSelection.marketName ?? rawSelection.market_name ?? "");
  const outcomeName = String(rawSelection.outcomeName ?? rawSelection.outcome_name ?? "");
  const specifier = String(rawSelection.specifier ?? "");
  const producerId = (rawSelection.producerId ??
    rawSelection.producerID ??
    rawSelection.producer_id) as string | number | undefined;
  const sportId = (rawSelection.sportId ??
    rawSelection.sportID ??
    rawSelection.sport_id) as string | number | undefined;
  const derivedMarketIds = [1601, EARLY_GOAL_DERIVED_MARKET_ID].includes(
    Number(marketId || 0),
  )
    ? [Number(marketId || 0)]
    : [];

  return normalizeSelection({
    awayTeam: String(rawSelection.awayTeam ?? awayTeam).trim(),
    category: String(rawSelection.category ?? rawSelection.categoryName ?? ""),
    categoryName: String(rawSelection.categoryName ?? rawSelection.category ?? ""),
    currentSelectionId: "",
    displayName: String(rawSelection.displayName ?? outcomeName),
    eventId: String(rawSelection.eventId ?? rawSelection.event_id ?? matchId),
    eventName,
    fixture: {
      awayTeam: String(rawSelection.awayTeam ?? awayTeam).trim(),
      categoryName: String(rawSelection.category ?? rawSelection.categoryName ?? ""),
      date: rawSelection.startTime ?? rawSelection.eventDate ?? rawSelection.event_date ?? rawSelection.date,
      derived_market_ids: [
        ...new Set([
          ...derivedMarketIds,
          ...(Array.isArray(rawSelection.supportedDerivedMarketIds)
            ? (rawSelection.supportedDerivedMarketIds as number[])
            : []),
          ...(Array.isArray(rawSelection.supportedEarlyGoalMarketIds)
            ? (rawSelection.supportedEarlyGoalMarketIds as number[])
            : []),
        ]),
      ],
      gameID: rawSelection.eventId ?? rawSelection.event_id ?? matchId,
      homeTeam: String(rawSelection.homeTeam ?? homeTeam).trim(),
      matchID: matchId,
      outcomes: Array.isArray(rawSelection.outcomes) ? rawSelection.outcomes : [],
      producerID: producerId,
      sportID: sportId,
      sportName: rawSelection.sport ?? rawSelection.sportName ?? "",
      tournament: rawSelection.tournament ?? rawSelection.tournamentName ?? "",
    },
    homeTeam: String(rawSelection.homeTeam ?? homeTeam).trim(),
    id: "",
    matchId: String(matchId),
    market: {
      marketID: marketId,
      marketName,
      specifier,
    },
    marketId: String(marketId),
    marketName,
    odds: asNumber(rawSelection.odds, 0),
    outcome: {
      active: rawSelection.active ?? 1,
      displayName: rawSelection.displayName ?? outcomeName,
      marketID: marketId,
      odds: rawSelection.odds,
      outcomeID: outcomeId,
      outcomeName,
      probability: rawSelection.probability,
      producerID: producerId,
      specifier,
    },
    outcomeId: String(outcomeId),
    outcomeName,
    producerId,
    selectionId: "",
    selectionKeySpecifier: specifier,
    specifier,
    sportId,
    sportName: String(rawSelection.sport ?? rawSelection.sportName ?? ""),
    startTime: String(
      rawSelection.startTime ?? rawSelection.eventDate ?? rawSelection.event_date ?? rawSelection.date ?? "",
    ),
    tournament: String(rawSelection.tournament ?? rawSelection.tournamentName ?? ""),
    tournamentName: String(rawSelection.tournamentName ?? rawSelection.tournament ?? ""),
    type: rawSelection.type === "live" || rawSelection.isLive ? "live" : "prematch",
  });
}

function buildBetsPayload(state: CouponState) {
  const selections = getActiveSelections(state.selections);
  const buildSelections = (items: CouponSelection[]) => {
    const builtSelections = items.map((selection) => {
      if (selection.customBetLegs?.length) {
        const firstLeg = selection.customBetLegs[0];
        return {
          customBet: {
            legs: selection.customBetLegs.map((leg) => ({
              marketId: Number(leg.marketId),
              matchId: Number(leg.matchId),
              outcomeId: String(leg.outcomeId),
              specifier: String(leg.specifier || ""),
            })),
          },
          marketId: Number(firstLeg.marketId),
          matchId: Number(firstLeg.matchId),
          outcomeId: String(firstLeg.outcomeId),
          specifier: String(firstLeg.specifier || ""),
          type: "custom_bet" as const,
        };
      }

      const marketId = Number.parseInt(String(selection.marketId), 10);
      const matchId = Number.parseInt(String(selection.matchId), 10);
      if (!Number.isFinite(matchId) || !Number.isFinite(marketId) || matchId <= 0 || marketId <= 0) {
        return null;
      }

      return {
        marketId,
        matchId,
        outcomeId: String(selection.outcomeId),
        specifier: String(selection.specifier || ""),
      };
    });

    if (builtSelections.some((selection) => !selection)) {
      throw new Error("One or more selections are invalid.");
    }

    return builtSelections;
  };

  const buildSingleBets = (items: CouponSelection[]) =>
    items.map((selection) => ({
      betType: "single" as const,
      selections: buildSelections([selection]),
      stake: getSingleSelectionStake(selection, state.stake),
      totalStake: getSingleSelectionStake(selection, state.stake),
    }));

  if (state.betType === "Single") {
    return buildSingleBets(selections);
  }

  if (state.betType === "System") {
    const combos = (state.combos.length ? state.combos : [])
      .filter((combo) => Number(combo.Grouping || 0) > 0)
      .map((combo) => ({
        grouping: Number(combo.Grouping || 0),
        stake: Number(combo.Stake || 0),
      }))
      .filter((combo) => Number.isFinite(combo.grouping) && combo.stake > 0)
      .sort((left, right) => left.grouping - right.grouping);
    const stakes = combos.map((combo) => combo.stake);
    const unitStake =
      stakes.length > 0 && stakes.every((value) => value === stakes[0]) ? [stakes[0]] : stakes;
    const bankers = selections
      .map((selection, index) => ({ index, selection }))
      .filter((entry) => entry.selection.fixed)
      .map((entry) => entry.index);

    return [
      {
        betType: "system" as const,
        selections: buildSelections(selections),
        stake: 0,
        system: {
          bankers,
          sizes: combos.map((combo) => combo.grouping),
          unitStake,
        },
        totalStake: 0,
      },
    ];
  }

  if (state.mode === "sim") {
    const stake = Number(state.totalStake || state.stake || 0);
    return [
      {
        betType: "multi" as const,
        selections: buildSelections(selections),
        stake,
        totalStake: stake,
      },
    ];
  }

  if (state.nativeBetType === "Split") {
    const counts = selections.reduce<Record<string, number>>((result, selection) => {
      const key = String(selection.matchId);
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    const singles = selections.filter((selection) => counts[String(selection.matchId)] > 1);
    const multiples = selections.filter((selection) => counts[String(selection.matchId)] <= 1);
    const bets = [];
    if (singles.length) {
      bets.push(...buildSingleBets(singles));
    }
    if (multiples.length) {
      const multipleStake = Number(state.stake || 0);
      bets.push({
        betType: "multi" as const,
        selections: buildSelections(multiples),
        stake: multipleStake,
        totalStake: multipleStake,
      });
    }
    return bets;
  }

  if (state.useFlex) {
    const stake = Number(state.totalStake || state.stake || 0);
    return [
      {
        betType: "flex" as const,
        flex: { minWins: Number(state.flexMinWins || 0) },
        selections: buildSelections(selections),
        stake,
        totalStake: stake,
      },
    ];
  }

  const stake = Number(state.totalStake || state.stake || 0);
  return [
    {
      betType: "multi" as const,
      ...(state.useCutOne ? { cutOne: { enabled: true } } : {}),
      selections: buildSelections(selections),
      stake,
      totalStake: stake,
    },
  ];
}

const INITIAL_COUPON: Omit<
  CouponState,
  | "addSelection"
  | "removeSelection"
  | "toggleSelection"
  | "updateStake"
  | "updateSystemStake"
  | "setBetType"
  | "setMode"
  | "setFlexMinWins"
  | "toggleBanker"
  | "handleOddsChange"
  | "handleBetStop"
  | "clearSlip"
  | "requestClearSlip"
  | "toggleOpen"
  | "setGlobalVars"
  | "setBonusList"
  | "setBetPlaced"
  | "setIsLoading"
  | "acceptOddsChanges"
  | "closeDialog"
  | "confirmDialog"
  | "showErrorDialog"
  | "ensureConfigLoaded"
  | "bootstrapSlip"
  | "refreshPreviews"
  | "toggleCutOne"
  | "toggleFlex"
  | "applyBulkEarlyWinMode"
  | "toggleEarlyGoal"
  | "setSelectionEarlyWinMode"
  | "setSelectionEarlyGoalMode"
  | "requestLoadByCode"
  | "loadByCodeIntoSlip"
  | "rebuildBetslipFromLoadedSelections"
  | "validateSlip"
  | "placeBet"
  | "bookBet"
  | "advanceSimulation"
  | "dismissSuccess"
  | "dismissSimulation"
  | "markSimulationWinShown"
  | "skipSimulationToResults"
  | "startAbandonedBetslipTracker"
  | "stopAbandonedBetslipTracker"
  | "startBetslipRealtimeSync"
  | "stopBetslipRealtimeSync"
  | "recordAbandonedBetslipInteraction"
> = {
  selections: [],
  betType: "Single",
  nativeBetType: "Single",
  mode: "real",
  stake: 100,
  totalStake: 100,
  totalOdds: 0,
  maxWin: 0,
  minWin: 0,
  minOdds: 0,
  maxBonus: 0,
  grossWin: 0,
  wthTax: 0,
  combos: [],
  Groupings: [],
  flexMinWins: 2,
  acceptChanges: true,
  useBonus: false,
  useCashback: false,
  bonusId: null,
  hasLive: false,
  useCutOne: false,
  useFlex: false,
  useEarlyGoal: false,
  earlyWinBulkMode: EARLY_WIN_DEFAULT_MODE,
  sportsbookFeatureConfig: DEFAULT_FEATURE_CONFIG,
  accaBonusPreview: null,
  cutOnePreview: null,
  flexPreview: null,
  isOpen: false,
  isLoading: false,
  isBootstrapping: false,
  isBooking: false,
  isConfigLoaded: false,
  isConfigLoading: false,
  isAccaBonusLoading: false,
  isCutOneLoading: false,
  isFlexLoading: false,
  isEarlyWinLoading: false,
  isEarlyGoalLoading: false,
  simulation: SIMULATION_INITIAL_STATE,
  simulationRealSnapshot: null,
  betPlaced: null,
  loadedCoupon: null,
  dialog: null,
  stakeCache: { Single: null, Multiple: null, System: null },
  globalVars: null,
  bonusList: [],
  activeMatchIds: [],
  hasSplitBet: false,
  splitMatchIds: [],
};

function resetSlipState(state: CouponState) {
  return {
    ...INITIAL_COUPON,
    bonusList: state.bonusList,
    globalVars: state.globalVars,
    isConfigLoaded: state.isConfigLoaded,
    mode: state.mode,
    simulationRealSnapshot: state.mode === "sim" ? state.simulationRealSnapshot : null,
    sportsbookFeatureConfig: state.sportsbookFeatureConfig,
    stake: state.stake,
    stakeCache: state.stakeCache,
  };
}

export const useCouponStore = create<CouponState>()(
  persist(
    (set, get) => ({
      ...INITIAL_COUPON,

      addSelection: (rawSelection) => {
        const normalizedSelection = normalizeSelection(rawSelection);
        const currentState = get();
        if (currentState.mode === "sim" && !isSimulationSelectionAllowed(normalizedSelection)) {
          set({
            dialog: {
              action: "switchSimulationToRealAndAdd",
              cancelLabel: "Stay in SIM",
              confirmLabel: "Switch to REAL",
              description:
                "This market is unavailable for simulated betting. Simulation currently supports only selected Soccer markets. Switch back to REAL mode and add it?",
              kind: "confirm",
              payload: { selection: normalizedSelection },
              title: "Unsupported market",
            },
          });
          return;
        }
        const hasExistingSelectionFromMatch = currentState.selections.some(
          (selection) =>
            selection.selectionId !== normalizedSelection.selectionId &&
            String(selection.matchId) === String(normalizedSelection.matchId),
        );
        if (hasExistingSelectionFromMatch && !isSplitBetEnabled(currentState.globalVars)) {
          currentState.showErrorDialog(
            "Selection unavailable",
            "Multiple selections from the same fixture are currently unavailable.",
          );
          return;
        }
        set((state) => {
          const sameStableIndex = state.selections.findIndex(
            (selection) => selection.selectionId === normalizedSelection.selectionId,
          );
          const conflictIndex = state.selections.findIndex(
            (selection) =>
              selection.selectionId !== normalizedSelection.selectionId &&
              getSelectionConflictKey(selection) === getSelectionConflictKey(normalizedSelection),
          );
          const nextSelections = [...state.selections];

          if (sameStableIndex !== -1) {
            nextSelections[sameStableIndex] = normalizedSelection;
          } else if (conflictIndex !== -1) {
            nextSelections[conflictIndex] = normalizedSelection;
          } else {
            nextSelections.push(normalizedSelection);
          }

          const nextBetType =
            state.betType === "Single" && nextSelections.length > 1 ? "Multiple" : state.betType;

          return {
            ...applyCouponState(state, {
              betType: nextBetType,
              dialog: null,
              selections: nextSelections,
            }),
          };
        });
        queuePreviewRefresh(get);
      },

      removeSelection: (selectionId) => {
        set((state) => {
          const nextSelections = state.selections.filter((selection) => selection.selectionId !== selectionId);
          if (!nextSelections.length) {
            return {
              ...resetSlipState(state),
              isOpen: state.isOpen,
            };
          }

          return {
            ...applyCouponState(state, {
              betType: nextSelections.length === 1 ? "Single" : state.betType,
              selections: nextSelections,
              useCutOne: nextSelections.length > 1 ? state.useCutOne : false,
              useFlex: nextSelections.length > 1 ? state.useFlex : false,
            }),
          };
        });
        queuePreviewRefresh(get);
      },

      toggleSelection: (selection) => {
        const state = get();
        const normalizedSelection = normalizeSelection(selection);
        const existing = state.selections.find(
          (entry) => entry.selectionId === normalizedSelection.selectionId,
        );

        if (
          existing &&
          existing.currentSelectionId === normalizedSelection.currentSelectionId
        ) {
          state.removeSelection(normalizedSelection.selectionId);
          return;
        }

        state.addSelection(normalizedSelection);
      },

      updateStake: (stake, targetSelectionId) => {
        set((state) => {
          const normalizedStake = normalizeStakeValue(
            stake,
            getMaxStakeForBetType(state.globalVars, state.betType),
          );
          if (targetSelectionId && state.betType === "Single") {
            const selectionStake = normalizeStakeValue(
              stake,
              getMaxStakeForBetType(state.globalVars, "Single"),
            );
            return {
              ...applyCouponState(state, {
                selections: state.selections.map((selection) =>
                  selection.selectionId === targetSelectionId
                    ? { ...selection, stake: selectionStake }
                    : selection,
                ),
              }),
            };
          }

          return {
            ...applyCouponState(state, {
              stake: normalizedStake,
              stakeCache: { ...state.stakeCache, [state.betType]: normalizedStake },
            }),
          };
        });
        queuePreviewRefresh(get);
      },

      updateSystemStake: (stake, grouping) => {
        set((state) => {
          const normalizedStake = normalizeStakeValue(stake, getMaxStakeForBetType(state.globalVars, "System"));
          const nextCombos = state.combos.map((combo) =>
            typeof grouping === "number" && combo.Grouping !== grouping
              ? combo
              : { ...combo, Stake: normalizedStake },
          );

          return {
            ...applyCouponState(state, {
              combos: nextCombos,
              stake: typeof grouping === "number" ? state.stake : normalizedStake,
              stakeCache: {
                ...state.stakeCache,
                System: typeof grouping === "number" ? state.stakeCache.System : normalizedStake,
              },
            }),
          };
        });
      },

      setBetType: (betType) => {
        set((state) => {
          const cachedStake = state.stakeCache[betType];
          const minStake = getMinStakeForBetType(state.globalVars, betType);
          const nextStake =
            betType === "System"
              ? Number.isFinite(Number(cachedStake)) && Number(cachedStake) > 0
                ? Number(cachedStake)
                : Number(minStake || 0)
              : cachedStake ?? state.stake;
          const selections =
            betType === "System"
              ? state.selections
              : state.selections.map((selection) =>
                  selection.fixed ? { ...selection, fixed: false } : selection,
                );
          const baseState = applyCouponState(state, {
            betType,
            selections,
            stake: nextStake,
            stakeCache: { ...state.stakeCache, [betType]: nextStake },
          });
          const combos =
            betType === "System" && nextStake > 0
              ? baseState.combos.map((combo) => ({ ...combo, Stake: nextStake }))
              : baseState.combos;
          return {
            ...applyCouponState(baseState as CouponState, { combos }),
          };
        });
        queuePreviewRefresh(get);
      },

      setMode: async (mode) => {
        const currentState = get();
        if (currentState.simulation.status !== "idle") return false;
        if (mode === currentState.mode) return true;

        if (mode === "sim") {
          const realSnapshot: SimulationRealSnapshot = {
            selections: cloneState(currentState.selections),
            betType: currentState.betType,
            nativeBetType: currentState.nativeBetType,
            stake: currentState.stake,
            stakeCache: cloneState(currentState.stakeCache),
            combos: cloneState(currentState.combos),
            useBonus: currentState.useBonus,
            useCashback: currentState.useCashback,
            bonusId: currentState.bonusId,
            useCutOne: currentState.useCutOne,
            useFlex: currentState.useFlex,
            useEarlyGoal: currentState.useEarlyGoal,
            earlyWinBulkMode: currentState.earlyWinBulkMode,
          };
          const simulationSelections = currentState.selections.filter((selection) =>
            isSimulationSportAllowed(selection.sportId),
          );

          set((state) => ({
            ...applyCouponState(state, {
              accaBonusPreview: null,
              betType: "Multiple",
              cutOnePreview: null,
              flexPreview: null,
              mode: "sim",
              selections: simulationSelections,
              simulationRealSnapshot: realSnapshot,
              useCutOne: false,
              useFlex: false,
            }),
            isAccaBonusLoading: false,
            isCutOneLoading: false,
            isFlexLoading: false,
            simulation: SIMULATION_INITIAL_STATE,
          }));
          return true;
        }

        if (currentState.mode === "sim" && currentState.simulationRealSnapshot) {
          const snapshot = currentState.simulationRealSnapshot;
          set((state) => ({
            ...applyCouponState(state, {
              betType: snapshot.betType,
              bonusId: snapshot.bonusId,
              earlyWinBulkMode: snapshot.earlyWinBulkMode,
              mode: "real",
              nativeBetType: snapshot.nativeBetType,
              selections: snapshot.selections,
              stake: snapshot.stake,
              stakeCache: cloneState(snapshot.stakeCache),
              combos: cloneState(snapshot.combos),
              useBonus: snapshot.useBonus,
              useCashback: snapshot.useCashback,
              useCutOne: snapshot.useCutOne,
              useEarlyGoal: snapshot.useEarlyGoal,
              useFlex: snapshot.useFlex,
            }),
            accaBonusPreview: null,
            cutOnePreview: null,
            flexPreview: null,
            isAccaBonusLoading: false,
            isCutOneLoading: false,
            isFlexLoading: false,
            mode: "real",
            simulation: SIMULATION_INITIAL_STATE,
            simulationRealSnapshot: null,
          }));
          if (snapshot.selections.length) {
            await get().refreshPreviews();
          }
          return true;
        }

        set({ mode: "real", simulation: SIMULATION_INITIAL_STATE });
        return true;
      },

      setFlexMinWins: (value) => {
        const activeSelections = getActiveSelections(get().selections);
        const maxFlexMinWins = getMaxFlexMinimumWins(activeSelections.length);
        set(() => ({
          flexMinWins: Math.min(maxFlexMinWins, Math.max(2, Math.floor(Number(value) || 2))),
        }));
        if (get().useFlex) {
          queuePreviewRefresh(get);
        }
      },

      toggleBanker: (selectionId) => {
        const currentState = get();
        if (currentState.hasSplitBet) {
          currentState.showErrorDialog(
            "Banker unavailable",
            "Bankers are not available for split bets.",
          );
          return;
        }
        set((state) => ({
          ...applyCouponState(state, {
            selections: state.selections.map((selection) =>
              selection.selectionId === selectionId
                ? { ...selection, fixed: !selection.fixed }
                : selection,
            ),
          }),
        }));
      },

      handleOddsChange: (matchId, updates) => {
        let didChange = false;
        set((state) => {
          let silentRiseOnly = true;
          let hasLocalChange = false;

          const nextSelections = state.selections.map((selection) => {
            if (String(selection.matchId) !== matchId) {
              return selection;
            }

            const update = updates.find(
              (entry) =>
                String(entry.marketId) === String(selection.marketId) &&
                String(entry.outcomeId) === String(selection.outcomeId) &&
                String(entry.specifier || "") === String(selection.specifier || ""),
            );
            if (!update) return selection;

            const statusFlags = getSelectionStatusFlags(update.statusName || "");
            const changed =
              Number(selection.odds || 0) !== Number(update.odds || 0) ||
              selection.suspended !== statusFlags.suspended ||
              selection.unavailable !== statusFlags.unavailable;
            if (!changed) return selection;

            hasLocalChange = true;

            // A price rise on an open selection only helps the player: take it silently.
            const silentRise = isSilentRise(selection, Number(update.odds || 0), statusFlags);
            if (!silentRise) silentRiseOnly = false;

            return normalizeSelection({
              ...patchSelectionQuoteUpdate(selection, update),
              changed: silentRise ? Boolean(selection.changed) : true,
            });
          });

          if (!hasLocalChange) return {};
          didChange = true;

          return {
            ...applyCouponState(state, {
              acceptChanges: silentRiseOnly ? state.acceptChanges : false,
              selections: nextSelections,
            }),
          };
        });
        if (didChange) {
          queuePreviewRefresh(get);
        }
      },

      handleBetStop: (matchId) => {
        let didChange = false;
        set((state) => {
          let hasLocalChange = false;

          const selections = state.selections.map((selection) => {
            if (String(selection.matchId) !== matchId) {
              return selection;
            }

            hasLocalChange = true;
            return normalizeSelection({ ...selection, changed: true, suspended: true });
          });

          if (!hasLocalChange) return state;
          didChange = true;

          return {
            ...applyCouponState(state, {
              acceptChanges: false,
              selections,
            }),
          };
        });
        if (didChange) {
          queuePreviewRefresh(get);
        }
      },

      clearSlip: () => {
        const hadSelections = get().selections.length > 0;
        if (hadSelections) {
          void closeAbandonedBetslipSession("cleared");
        } else {
          clearAbandonedBetslipTimer({ resetSession: true, clearStorage: true });
        }
        clearQueuedPreviewRefresh();
        previewRefreshInFlightSignature = "";
        previewRefreshQueued = false;
        previewRefreshQueuedSignature = "";
        previewRefreshLastCompletedSignature = "";
        set((state) => ({
          ...resetSlipState(state),
          dialog: null,
          isOpen: state.isOpen,
        }));
      },

      requestClearSlip: () =>
        set({
          dialog: {
            action: "clear",
            cancelLabel: "Cancel",
            confirmLabel: "Clear slip",
            description: "Remove every selection from the betslip?",
            kind: "confirm",
            title: "Clear betslip",
          },
        }),

      startAbandonedBetslipTracker: () => {
        if (abandonedBetslipUnsubscribe) {
          return;
        }

        abandonedBetslipUnsubscribe = useCouponStore.subscribe((state) => {
          handleAbandonedBetslipActivity(() => state);
        });

        handleAbandonedBetslipActivity(() => get());
      },

      stopAbandonedBetslipTracker: () => {
        if (typeof abandonedBetslipUnsubscribe === "function") {
          abandonedBetslipUnsubscribe();
        }

        abandonedBetslipUnsubscribe = null;
        clearAbandonedBetslipTimer();
      },

      startBetslipRealtimeSync: () => {
        if (betslipRealtimeUnsubscribe) return;

        betslipRealtimeSelectionSignature = buildBetslipRealtimeSelectionSignature(get().selections);
        syncBetslipRealtimeSubscriptions(get().selections);

        betslipRealtimeUnsubscribe = useCouponStore.subscribe((state) => {
          const nextSignature = buildBetslipRealtimeSelectionSignature(state.selections);
          if (nextSignature === betslipRealtimeSelectionSignature) return;

          betslipRealtimeSelectionSignature = nextSignature;
          syncBetslipRealtimeSubscriptions(state.selections);
        });
      },

      stopBetslipRealtimeSync: () => {
        if (typeof betslipRealtimeUnsubscribe === "function") {
          betslipRealtimeUnsubscribe();
        }

        betslipRealtimeUnsubscribe = null;
        unsubscribeAllBetslipRealtimeSubscriptions();
      },

      recordAbandonedBetslipInteraction: () => {
        const selections = Array.isArray(get().selections) ? get().selections : [];
        if (!selections.length) return;

        const nextSignature = buildAbandonedBetslipActivitySignature({ selections });
        abandonedBetslipLastActivitySignature = nextSignature;
        scheduleAbandonedBetslipReport(get, nextSignature);
      },

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

      setGlobalVars: (globalVars) => set({ globalVars }),

      setBonusList: (bonusList) => set({ bonusList }),

      setBetPlaced: (betPlaced) => set({ betPlaced }),

      setIsLoading: (isLoading) => set({ isLoading }),

      acceptOddsChanges: () =>
        set((state) => ({
          acceptChanges: true,
          selections: state.selections.map((selection) => ({ ...selection, changed: false })),
        })),

      closeDialog: () => set({ dialog: null }),

      confirmDialog: async () => {
        const dialog = get().dialog;
        if (!dialog) return;

        set({ dialog: null });

        if (dialog.action === "clear") {
          get().clearSlip();
          return;
        }

        if (dialog.action === "loadCode") {
          const code = String(dialog.payload?.code || "").trim();
          if (code) {
            await get().loadByCodeIntoSlip(code, get().mode);
          }
          return;
        }

        if (dialog.action === "switchModeAndLoadCode") {
          const code = String(dialog.payload?.code || "").trim();
          if (!code) return;
          await get().setMode("real");
          await get().loadByCodeIntoSlip(code, "real");
          return;
        }

        if (dialog.action === "switchSimulationToRealAndAdd") {
          const selection = dialog.payload?.selection;
          if (!selection || typeof selection !== "object") return;
          const switchedToReal = await get().setMode("real");
          if (!switchedToReal) return;
          get().addSelection(selection as CouponSelection);
          set({ isOpen: true });
        }
      },

      showErrorDialog: (title, description) =>
        set({
          dialog: {
            cancelLabel: "Okay",
            description,
            kind: "error",
            title,
          },
        }),

      ensureConfigLoaded: async () => {
        if (get().isConfigLoaded) return;
        if (configLoadPromise) return configLoadPromise;

        set({ isConfigLoading: true });
        configLoadPromise = (async () => {
          const [featureConfigResult, bonusListResult, globalVarsResult] = await Promise.allSettled([
            betsApi.getFeatureConfig("online"),
            contentApi.getBonusList(),
            authApi.getGlobalVars(),
          ]);

          set((state) => ({
            bonusList:
              bonusListResult.status === "fulfilled"
                ? normalizeBonusList(bonusListResult.value)
                : state.bonusList,
            globalVars:
              globalVarsResult.status === "fulfilled"
                ? normalizeGlobalVars(globalVarsResult.value)
                : state.globalVars,
            isConfigLoaded: true,
            isConfigLoading: false,
            sportsbookFeatureConfig:
              featureConfigResult.status === "fulfilled"
                ? normalizeFeatureConfig(featureConfigResult.value)
                : state.sportsbookFeatureConfig,
          }));
        })().finally(() => {
          configLoadPromise = null;
        });

        return configLoadPromise;
      },

      bootstrapSlip: async () => {
        const state = get();
        if (!state.selections.length) {
          return {
            activeSelectionCount: 0,
            canProceed: false,
            hasChanges: false,
            reason: "empty" as const,
            validatedSelectionCount: 0,
          };
        }

        set({ isBootstrapping: true });
        try {
          await get().ensureConfigLoaded();
          const result = await get().validateSlip({ skipPreviews: true });
          if (getActiveSelections(get().selections).length === 0) {
            get().clearSlip();
          }
          return result;
        } finally {
          set({ isBootstrapping: false });
        }
      },

      refreshPreviews: async () => {
        clearQueuedPreviewRefresh();
        const state = get();
        if (!state.isOpen || state.mode !== "real") {
          previewRefreshQueuedSignature = "";
          set((currentState) => ({
            ...applyCouponState(currentState),
            accaBonusPreview: null,
            cutOnePreview: null,
            flexPreview: null,
            isAccaBonusLoading: false,
            isCutOneLoading: false,
            isFlexLoading: false,
          }));
          markPreviewRefreshCompleted(get);
          return;
        }
        const previewSignature = buildPreviewRefreshSignature(state);
        if (
          previewSignature === previewRefreshLastCompletedSignature &&
          !previewRefreshInFlightSignature
        ) {
          return;
        }
        if (previewSignature === previewRefreshInFlightSignature) {
          return;
        }
        if (previewRefreshInFlightSignature) {
          if (previewRefreshQueued && previewRefreshQueuedSignature === previewSignature) {
            return;
          }
          previewRefreshQueued = true;
          previewRefreshQueuedSignature = previewSignature;
          return;
        }

        previewRefreshQueuedSignature = "";
        previewRefreshInFlightSignature = previewSignature;
        const activeSelections = getActiveSelections(state.selections);
        const hasCustomBetSelection = activeSelections.some((selection) => selection.customBetLegs?.length);
        const isStandardMultiple =
          state.betType === "Multiple" && state.nativeBetType === "Multiple" && !hasCustomBetSelection;

        try {
          set((currentState) => ({
            ...applyCouponState(currentState),
            accaBonusPreview: isStandardMultiple ? currentState.accaBonusPreview : null,
            cutOnePreview: isStandardMultiple ? currentState.cutOnePreview : null,
            flexPreview: isStandardMultiple ? currentState.flexPreview : null,
            useCutOne: isStandardMultiple ? currentState.useCutOne : false,
            useFlex: isStandardMultiple ? currentState.useFlex : false,
          }));

          if (!isStandardMultiple || !activeSelections.length) {
            set({
              accaBonusPreview: null,
              cutOnePreview: null,
              flexPreview: null,
              isAccaBonusLoading: false,
              isCutOneLoading: false,
              isFlexLoading: false,
              useCutOne: false,
              useFlex: false,
            });
            markPreviewRefreshCompleted(get);
            return;
          }

          const latest = get();
          const accaConfig = latest.sportsbookFeatureConfig.accaBonus;
          const cutOneConfig = latest.sportsbookFeatureConfig.cutOne;
          const flexConfig = latest.sportsbookFeatureConfig.flex;
          const previewSelections = activeSelections
            .map(buildPreviewSelection)
            .filter((selection): selection is NonNullable<ReturnType<typeof buildPreviewSelection>> => Boolean(selection));

          const canUseCutOne =
            latest.useCutOne &&
            getConfigEnabled(cutOneConfig) &&
            activeSelections.length >= asNumber(cutOneConfig?.min_selections, 0) &&
            !latest.useFlex &&
            !latest.useBonus &&
            !latest.useCashback &&
            asNumber(latest.bonusId, 0) === 0 &&
            activeSelections.every(
              (selection) => Number(selection.odds || 0) >= asNumber(cutOneConfig?.min_odds_per_leg, 0),
            );

          if (latest.useCutOne) {
            const requestId = ++cutOnePreviewRequestId;
            set({ isCutOneLoading: true });

            if (!canUseCutOne) {
              set({ cutOnePreview: null, isCutOneLoading: false, useCutOne: false });
            } else {
              try {
                const response = await betsApi.previewCutOne({
                  selections: previewSelections,
                  stake: Number(latest.stake || 0),
                });

                if (requestId === cutOnePreviewRequestId) {
                  const data = getBetServiceData<Record<string, unknown>>(response);
                  const isValid =
                    getBetServiceStatusCode(response) === 200 &&
                    Boolean(data?.enabled) &&
                    Boolean(data?.qualifies);

                  if (isValid && data) {
                    set({
                      cutOnePreview: data,
                      isCutOneLoading: false,
                      maxBonus: 0,
                      grossWin: asNumber(data.potential_payout, 0),
                      maxWin: asNumber(data.potential_payout, 0),
                      wthTax: 0,
                    });
                    markPreviewRefreshCompleted(get);
                    return;
                  }

                  set({ cutOnePreview: null, isCutOneLoading: false, useCutOne: false });
                }
              } catch {
                if (requestId === cutOnePreviewRequestId) {
                  set({ cutOnePreview: null, isCutOneLoading: false, useCutOne: false });
                }
              }
            }
          } else {
            set({ cutOnePreview: null, isCutOneLoading: false });
          }

          const latestAfterCutOne = get();
          const canUseFlex =
            latestAfterCutOne.useFlex &&
            getConfigEnabled(flexConfig) &&
            activeSelections.length >= asNumber(flexConfig?.min_selections, 0) &&
            (asNumber(flexConfig?.max_selections, 0) === 0 ||
              activeSelections.length <= asNumber(flexConfig?.max_selections, 0)) &&
            !latestAfterCutOne.useCutOne &&
            !latestAfterCutOne.useBonus &&
            !latestAfterCutOne.useCashback &&
            asNumber(latestAfterCutOne.bonusId, 0) === 0;

          if (latestAfterCutOne.useFlex) {
            const requestId = ++flexPreviewRequestId;
            const maxWins = getMaxFlexMinimumWins(activeSelections.length);
            const minWins = Math.min(maxWins, Math.max(2, Number(latestAfterCutOne.flexMinWins || 2)));
            set({ flexMinWins: minWins, isFlexLoading: true });

            if (!canUseFlex) {
              set({ flexPreview: null, isFlexLoading: false, useFlex: false });
            } else {
              try {
                const response = await betsApi.previewFlex({
                  minWins,
                  selections: previewSelections,
                  stake: Number(latestAfterCutOne.stake || 0),
                });

                if (requestId === flexPreviewRequestId) {
                  const data = getBetServiceData<Record<string, unknown>>(response);
                  const isValid =
                    getBetServiceStatusCode(response) === 200 &&
                    Boolean(data?.enabled) &&
                    Boolean(data?.qualifies);

                  if (isValid && data) {
                    set({
                      flexPreview: data,
                      isFlexLoading: false,
                      maxBonus: 0,
                      grossWin: asNumber(data.potential_payout, 0),
                      maxWin: asNumber(data.potential_payout, 0),
                      wthTax: 0,
                    });
                    markPreviewRefreshCompleted(get);
                    return;
                  }

                  set({ flexPreview: null, isFlexLoading: false, useFlex: false });
                }
              } catch {
                if (requestId === flexPreviewRequestId) {
                  set({ flexPreview: null, isFlexLoading: false, useFlex: false });
                }
              }
            }
          } else {
            set({ flexPreview: null, isFlexLoading: false });
          }

          const latestAfterFlex = get();
          const canUseAccaBonus =
            !latestAfterFlex.useCutOne &&
            !latestAfterFlex.useFlex &&
            getConfigEnabled(accaConfig) &&
            activeSelections.length > 1 &&
            Number(latestAfterFlex.stake || 0) > 0;

          const requestId = ++accaBonusPreviewRequestId;
          set({ accaBonusPreview: null, isAccaBonusLoading: canUseAccaBonus });
          if (!canUseAccaBonus) {
            set((currentState) => ({
              isAccaBonusLoading: false,
              ...applyCouponState(currentState),
            }));
            markPreviewRefreshCompleted(get);
            return;
          }

          try {
            const response = await betsApi.previewAccaBonus({
              selections: previewSelections,
              stake: Number(latestAfterFlex.stake || 0),
            });

            if (requestId === accaBonusPreviewRequestId) {
              const data = getBetServiceData<Record<string, unknown>>(response);
              const isValid =
                getBetServiceStatusCode(response) === 200 &&
                Boolean(data?.enabled);

              if (!isValid || !data) {
                set({ accaBonusPreview: null, isAccaBonusLoading: false });
                markPreviewRefreshCompleted(get);
                return;
              }

              set({
                accaBonusPreview: data,
                isAccaBonusLoading: false,
                grossWin: asNumber(data.potential_returns, 0),
                maxBonus: asNumber(data.bonus_amount, 0),
                maxWin: asNumber(data.potential_returns, 0),
              });
            }
          } catch {
            if (requestId === accaBonusPreviewRequestId) {
              set({ accaBonusPreview: null, isAccaBonusLoading: false });
            }
          }
          markPreviewRefreshCompleted(get);
        } finally {
          previewRefreshInFlightSignature = "";
          if (previewRefreshQueued) {
            previewRefreshQueued = false;
            previewRefreshQueuedSignature = "";
            if (buildPreviewRefreshSignature(get()) !== previewRefreshLastCompletedSignature) {
              queuePreviewRefresh(get);
            }
          }
        }
      },

      toggleCutOne: async () => {
        set((state) => ({
          useCutOne: !state.useCutOne,
          ...(state.useFlex ? { useFlex: false, flexPreview: null } : null),
        }));
        await get().refreshPreviews();
      },

      toggleFlex: async () => {
        set((state) => {
          const nextUseFlex = !state.useFlex;
          const activeSelections = getActiveSelections(state.selections);
          const maxFlexMinWins = getMaxFlexMinimumWins(activeSelections.length);

          return {
            useFlex: nextUseFlex,
            flexMinWins: nextUseFlex ? maxFlexMinWins : state.flexMinWins,
            ...(state.useCutOne ? { cutOnePreview: null, useCutOne: false } : null),
          };
        });
        await get().refreshPreviews();
      },

      applyBulkEarlyWinMode: async (mode) => {
        const candidates = get().selections.filter(
          (selection) =>
            Number(selection.baseMarketId || selection.marketId || 0) === 1 &&
            ((selection.supportedEarlyWinModes ?? []).includes(mode) ||
              selection.earlyWinMode === mode),
        );
        if (!candidates.length) return;

        for (const selection of candidates) {
          await get().setSelectionEarlyWinMode(
            selection.selectionId,
            mode,
            { force: true, skipPreviewRefresh: true },
          );
        }
        await get().refreshPreviews();
      },

      toggleEarlyGoal: async () => {
        const candidates = get().selections.filter(isEarlyGoalFeatureEligibleSelection);
        if (!candidates.length) return;

        const targetValue = !candidates.every((selection) => selection.earlyGoalMode === "earlygoal");
        if (targetValue && get().mode === "sim") {
          get().showErrorDialog(
            "Simulation unavailable",
            "Early Goals is not supported in simulation mode.",
          );
          return;
        }

        for (const selection of candidates) {
          await get().setSelectionEarlyGoalMode(selection.selectionId, targetValue, {
            skipPreviewRefresh: true,
          });
        }
        await get().refreshPreviews();
      },

      setSelectionEarlyWinMode: async (selectionId, mode, options) => {
        const current = get().selections.find((selection) => selection.selectionId === selectionId);
        if (!current) return;
        const normalizedMode = mode === "base" ? "base" : mode;
        const alreadyActive = (current.earlyWinMode || "base") === normalizedMode;
        const nextMode = options?.force ? normalizedMode : alreadyActive ? "base" : normalizedMode;
        if (
          nextMode !== "base" &&
          !(current.supportedEarlyWinModes ?? []).includes(nextMode)
        ) {
          return;
        }
        const targetMarketId =
          nextMode === "base"
            ? Number(current.baseMarketId || current.marketId || 0)
            : getDerivedMarketIdForMode(
                current.baseMarketId || current.marketId || 0,
                nextMode,
                current.supportedDerivedMarketIds ?? [],
              );
        if (!targetMarketId) return;

        set({ isEarlyWinLoading: true });
        let workingSelection = current;
        if (!workingSelection.earlyWinLocalQuotes?.base && !workingSelection.earlyWinLocalQuotes?.[nextMode]) {
          workingSelection = normalizeSelection(await fetchSelectionFixture(workingSelection));
        }

        let quote: EarlyWinQuote | null | undefined =
          nextMode === "base"
            ? workingSelection.earlyWinLocalQuotes?.base
            : workingSelection.earlyWinLocalQuotes?.[nextMode];
        if (!quote) {
          quote = await fetchEarlyWinQuoteForSelection(workingSelection, nextMode as EarlyWinMode, targetMarketId);
        }
        if (!quote || Number(quote.odds || 0) <= 1) {
          set({ isEarlyWinLoading: false });
          return;
        }

        const nextSelection = normalizeSelection({
          ...workingSelection,
          earlyWinLocalQuotes: {
            ...(workingSelection.earlyWinLocalQuotes ?? {}),
            [nextMode]: quote,
          },
          marketId: String(quote.marketId),
          marketName: quote.marketName,
          odds: Number(quote.odds || 0),
          outcomeId: quote.outcomeId,
          outcomeName: quote.outcomeName,
          selectionKeySpecifier: quote.idSpecifier,
          specifier: quote.specifier,
          suspended: String(quote.statusName || "").toLowerCase() === "suspended",
          unavailable: String(quote.statusName || "").toLowerCase() === "deactivated",
        });

        set((state) => ({
          isEarlyWinLoading: false,
          ...applyCouponState(state, {
            selections: state.selections.map((selection) =>
              selection.selectionId === selectionId ? nextSelection : selection,
            ),
          }),
        }));
        if (!options?.skipPreviewRefresh) {
          await get().refreshPreviews();
        }
      },

      setSelectionEarlyGoalMode: async (selectionId, enabled, options) => {
        const current = get().selections.find((selection) => selection.selectionId === selectionId);
        if (!current) return;
        if (enabled && !isEarlyGoalFeatureEligibleSelection(current)) {
          return;
        }
        if (enabled && get().mode === "sim") {
          get().showErrorDialog(
            "Simulation unavailable",
            "Early Goals is not supported in simulation mode.",
          );
          return;
        }
        const targetMode = enabled ? "earlygoal" : "base";
        if (!enabled && current.earlyGoalMode === "base") return;
        if (enabled && current.earlyGoalMode === "earlygoal") return;
        const targetMarketId =
          targetMode === "base"
            ? Number(current.baseMarketId || current.marketId || 0)
            : EARLY_GOAL_DERIVED_MARKET_ID;

        set({ isEarlyGoalLoading: true });
        let workingSelection = current;
        if (!workingSelection.earlyGoalLocalQuotes?.base && !workingSelection.earlyGoalLocalQuotes?.[targetMode]) {
          workingSelection = normalizeSelection(await fetchSelectionFixture(workingSelection));
        }

        let quote: EarlyWinQuote | null | undefined =
          targetMode === "base"
            ? workingSelection.earlyGoalLocalQuotes?.base
            : workingSelection.earlyGoalLocalQuotes?.[targetMode];
        if (!quote) {
          quote = await fetchEarlyGoalQuoteForSelection(workingSelection, targetMode, targetMarketId);
        }
        if (!quote || Number(quote.odds || 0) <= 1) {
          set({ isEarlyGoalLoading: false });
          return;
        }

        const normalizedSelection = normalizeSelection({
          ...workingSelection,
          earlyGoalLocalQuotes: {
            ...(workingSelection.earlyGoalLocalQuotes ?? {}),
            [targetMode]: quote,
          },
          marketId: String(quote.marketId),
          marketName: quote.marketName,
          odds: Number(quote.odds || 0),
          outcomeId: quote.outcomeId,
          outcomeName: quote.outcomeName,
          selectionKeySpecifier: quote.idSpecifier,
          specifier: quote.specifier,
          suspended: String(quote.statusName || "").toLowerCase() === "suspended",
          unavailable: String(quote.statusName || "").toLowerCase() === "deactivated",
        });
        const nextSelection: CouponSelection = {
          ...normalizedSelection,
          baseDisplayName:
            normalizedSelection.baseDisplayName ||
            workingSelection.baseDisplayName ||
            current.baseDisplayName,
          baseMarketId:
            normalizedSelection.baseMarketId ||
            workingSelection.baseMarketId ||
            current.baseMarketId,
          baseMarketName:
            normalizedSelection.baseMarketName ||
            workingSelection.baseMarketName ||
            current.baseMarketName,
          baseOutcomeId:
            normalizedSelection.baseOutcomeId ||
            workingSelection.baseOutcomeId ||
            current.baseOutcomeId,
          baseOutcomeName:
            normalizedSelection.baseOutcomeName ||
            workingSelection.baseOutcomeName ||
            current.baseOutcomeName,
          baseSelectionKeySpecifier:
            normalizedSelection.baseSelectionKeySpecifier ||
            workingSelection.baseSelectionKeySpecifier ||
            current.baseSelectionKeySpecifier,
          baseSpecifier:
            normalizedSelection.baseSpecifier ||
            workingSelection.baseSpecifier ||
            current.baseSpecifier,
          earlyGoalLocalQuotes: {
            ...(workingSelection.earlyGoalLocalQuotes ?? {}),
            ...(normalizedSelection.earlyGoalLocalQuotes ?? {}),
            [targetMode]: quote,
          },
          earlyGoalMode: targetMode,
          supportedEarlyGoalMarketIds:
            normalizedSelection.supportedEarlyGoalMarketIds?.length
              ? normalizedSelection.supportedEarlyGoalMarketIds
              : workingSelection.supportedEarlyGoalMarketIds ?? current.supportedEarlyGoalMarketIds,
          supportsEarlyGoal: Boolean(
            normalizedSelection.supportsEarlyGoal ||
              workingSelection.supportsEarlyGoal ||
              current.supportsEarlyGoal ||
              targetMode === "earlygoal",
          ),
        };

        set((state) => ({
          isEarlyGoalLoading: false,
          ...applyCouponState(state, {
            selections: state.selections.map((selection) =>
              selection.selectionId === selectionId ? nextSelection : selection,
            ),
          }),
        }));
        if (!options?.skipPreviewRefresh) {
          await get().refreshPreviews();
        }
      },

      requestLoadByCode: async (code) => {
        const trimmedCode = code.trim();
        if (!trimmedCode) return;

        if (get().mode === "sim") {
          set({
            dialog: {
              action: "switchModeAndLoadCode",
              cancelLabel: "Stay in SIM",
              confirmLabel: "Switch to Real",
              description: "This booking code belongs to a real betslip. Switch back to Real mode and replace the current slip?",
              kind: "confirm",
              payload: { code: trimmedCode },
              title: "Switch mode",
            },
          });
          return;
        }

        if (get().selections.length > 0) {
          set({
            dialog: {
              action: "loadCode",
              cancelLabel: "Cancel",
              confirmLabel: "Replace slip",
              description: "Replace the current betslip with the loaded booking code?",
              kind: "confirm",
              payload: { code: trimmedCode },
              title: "Replace betslip",
            },
          });
          return;
        }

        await get().loadByCodeIntoSlip(trimmedCode, get().mode);
      },

      loadByCodeIntoSlip: async (code, forceMode) => {
        const trimmedCode = code.trim();
        if (!trimmedCode) return;

        set({ isLoading: true });
        try {
          const response = await betsApi.loadByCode(trimmedCode);
          if (getBetServiceStatusCode(response) !== 200) {
            throw new Error(
              getBetServiceStatusDescription(response) || "Unable to load booking code.",
            );
          }
          const nextMode = forceMode ?? "real";
          set({ loadedCoupon: response as Record<string, unknown>, mode: nextMode });
          const rebuiltCount = await get().rebuildBetslipFromLoadedSelections(response);
          if (!rebuiltCount) {
            set({ isLoading: false });
            get().showErrorDialog(
              "Load code failed",
              "All selections in this booking code are unavailable or expired.",
            );
            return;
          }
          set({ isOpen: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          get().showErrorDialog("Load code failed", error instanceof Error ? error.message : "Unable to load booking code.");
        }
      },

      rebuildBetslipFromLoadedSelections: async (loadedData) => {
        const loadedSelections = extractLoadedSelections(loadedData);
        const activeSelections = loadedSelections.filter((selection) => {
          if (!selection || typeof selection !== "object") return false;
          const source = selection as Record<string, unknown>;
          const statusName = String(source.statusName || "").toLowerCase();
          const odds = asNumber(source.odds, 0);
          return (
            Boolean(source.matchId || source.match_id || source.eventId || source.event_id) &&
            Boolean(source.marketId || source.market_id) &&
            Boolean(source.outcomeId || source.outcome_id || source.odd_id) &&
            odds > 1 &&
            asNumber(source.active ?? 1, 1) !== 0 &&
            statusName !== "suspended" &&
            statusName !== "deactivated"
          );
        });

        const nextSelections = activeSelections.map((selection) =>
          buildSelectionFromLoadedPayload(selection as Record<string, unknown>),
        );

        if (!nextSelections.length) {
          return 0;
        }

        set((state) => ({
          ...applyCouponState(state, {
            selections: nextSelections,
            useCutOne: false,
            useFlex: false,
            useEarlyGoal: nextSelections.some((selection) => selection.earlyGoalMode === "earlygoal"),
          }),
          acceptChanges: true,
          isOpen: true,
          simulation: SIMULATION_INITIAL_STATE,
        }));
        await get().bootstrapSlip();
        return nextSelections.length;
      },

      validateSlip: async () => {
        const state = get();
        if (!state.selections.length) {
          return {
            activeSelectionCount: 0,
            canProceed: false,
            hasChanges: false,
            reason: "empty" as const,
            validatedSelectionCount: 0,
          };
        }

        try {
          const regularSelections = state.selections.filter(
            (selection) => !selection.customBetLegs?.length,
          );
          const selectionRequests = regularSelections
            .map((selection) => buildSelectionRequest(selection))
            .filter((selection): selection is NonNullable<ReturnType<typeof buildSelectionRequest>> => Boolean(selection));
          if (selectionRequests.length !== regularSelections.length) {
            throw new Error("One or more selections are invalid.");
          }
          if (!selectionRequests.length) {
            const activeSelectionCount = getActiveSelections(get().selections).length;
            return {
              activeSelectionCount,
              canProceed: activeSelectionCount > 0,
              hasChanges: false,
              reason: activeSelectionCount > 0 ? ("ok" as const) : ("noneActive" as const),
              validatedSelectionCount: 0,
            };
          }
          const response = await betsApi.validateSelections(
            selectionRequests,
          );
          if (getBetServiceStatusCode(response) !== 200) {
            throw new Error(
              getBetServiceStatusDescription(response) || "Unable to validate betslip.",
            );
          }
          const validatedList =
            getBetServiceData(response) ?? response;
          const validatedSelections = Array.isArray(validatedList)
            ? validatedList
            : validatedList && typeof validatedList === "object"
              ? Object.values(validatedList)
              : [];

          let hasSelectionChange = false;
          const allSelectionsInactiveFromValidation =
            regularSelections.length > 0 &&
            validatedSelections.length === regularSelections.length &&
            !get().selections.some((selection) => selection.customBetLegs?.length) &&
            validatedSelections.every((item) => {
              if (!item || typeof item !== "object") return false;
              const source = item as Record<string, unknown>;
              const statusFlags = getSelectionStatusFlags(String(source.status_name || source.statusName || ""));
              return statusFlags.suspended || statusFlags.unavailable || asNumber(source.odds, 0) <= 1;
            });
          if (allSelectionsInactiveFromValidation) {
            get().clearSlip();
            return {
              activeSelectionCount: 0,
              canProceed: false,
              hasChanges: true,
              reason: "noneActive" as const,
              validatedSelectionCount: validatedSelections.length,
            };
          }
          set((currentState) => ({
            ...applyCouponState(currentState, {
              acceptChanges: currentState.acceptChanges,
              selections: currentState.selections.map((selection) => {
                const validated = validatedSelections.find((item) => {
                  if (!item || typeof item !== "object") return false;
                  const source = item as Record<string, unknown>;
                  return (
                    String(selection.matchId) === String(source.match_id) &&
                    String(selection.marketId) === String(source.market_id) &&
                    String(selection.outcomeId) === String(source.outcome_id) &&
                    String(selection.specifier || "") === String(source.specifier || "")
                  );
                });
                if (!validated || typeof validated !== "object") return selection;

                const source = validated as Record<string, unknown>;
                const statusFlags = getSelectionStatusFlags(String(source.status_name || source.statusName || ""));
                const didChange =
                  Number(selection.odds || 0) !== asNumber(source.odds, 0) ||
                  selection.suspended !== statusFlags.suspended ||
                  selection.unavailable !== statusFlags.unavailable;
                if (!didChange) {
                  return selection.changed
                    ? normalizeSelection({
                        ...selection,
                        changed: false,
                      })
                    : selection;
                }

                if (isSilentRise(selection, asNumber(source.odds, 0), statusFlags)) {
                  return normalizeSelection({
                    ...patchSelectionQuoteUpdate(selection, {
                      marketId: String(source.market_id ?? source.marketId ?? selection.marketId),
                      odds: asNumber(source.odds, 0),
                      outcomeId: String(source.outcome_id ?? source.outcomeId ?? selection.outcomeId),
                      specifier: String(source.specifier ?? selection.specifier ?? ""),
                      statusName: String(source.status_name || source.statusName || ""),
                    }),
                    changed: Boolean(selection.changed),
                  });
                }

                hasSelectionChange = true;
                return normalizeSelection({
                  ...patchSelectionQuoteUpdate(selection, {
                    marketId: String(source.market_id ?? source.marketId ?? selection.marketId),
                    odds: asNumber(source.odds, 0),
                    outcomeId: String(source.outcome_id ?? source.outcomeId ?? selection.outcomeId),
                    specifier: String(source.specifier ?? selection.specifier ?? ""),
                    statusName: String(source.status_name || source.statusName || ""),
                  }),
                  changed: true,
                });
              }),
            }),
            acceptChanges: hasSelectionChange ? false : currentState.acceptChanges,
          }));

          const latestSelections = get().selections;
          const activeSelectionCount = getActiveSelections(latestSelections).length;
          const hasInactiveSelections = activeSelectionCount !== latestSelections.length;
          if (validatedSelections.length > 0 && activeSelectionCount === 0) {
            get().clearSlip();
          }
          return {
            activeSelectionCount,
            canProceed: activeSelectionCount > 0 && !hasSelectionChange && !hasInactiveSelections,
            hasChanges: hasSelectionChange,
            reason:
              activeSelectionCount === 0
                ? ("noneActive" as const)
                : hasSelectionChange
                  ? ("hasChanges" as const)
                  : hasInactiveSelections
                    ? ("inactiveSelections" as const)
                  : ("ok" as const),
            validatedSelectionCount: validatedSelections.length,
          };
        } catch {
          return {
            activeSelectionCount: getActiveSelections(get().selections).length,
            canProceed: false,
            hasChanges: false,
            reason: "error" as const,
            validatedSelectionCount: 0,
          };
        }
      },

      placeBet: async () => {
        const state = get();
        if (!state.selections.length || state.isBooking) return null;

        set({ isBooking: true, isLoading: true });
        try {
          await get().ensureConfigLoaded();

          if (state.mode === "sim") {
            const validation = await get().validateSlip({ skipPreviews: true });
            if (!validation.canProceed) {
              if (getActiveSelections(get().selections).length === 0) {
                get().clearSlip();
              } else if (validation.reason === "inactiveSelections") {
                set({ isBooking: false, isLoading: false });
                get().showErrorDialog(
                  "Selections unavailable",
                  "One or more selections in this betslip are unavailable. Remove them before placing the bet.",
                );
              } else {
                set({ isBooking: false, isLoading: false });
              }
              return null;
            }
          } else {
            const liveState = get();
            const activeSelectionCount = getActiveSelections(liveState.selections).length;

            if (!liveState.acceptChanges) {
              set({ isBooking: false, isLoading: false });
              return null;
            }

            if (activeSelectionCount === 0) {
              get().clearSlip();
              return null;
            }

            if (activeSelectionCount !== liveState.selections.length) {
              set({ isBooking: false, isLoading: false });
              get().showErrorDialog(
                "Selections unavailable",
                "One or more selections in this betslip are unavailable. Remove them before placing the bet.",
              );
              return null;
            }

            try {
              await refreshCurrentUserProfile();
            } catch (error) {
              set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });

              if (isApiClientError(error) && error.status === 401) {
                useAuthStore.getState().logout();
                return null;
              }

              get().showErrorDialog(
                "Place bet failed",
                error instanceof Error
                  ? error.message
                  : "Unable to confirm your account details.",
              );
              return null;
            }
          }

          const latestState = get();
          if (
            latestState.mode === "sim" &&
            latestState.selections.some((selection) => !isSimulationSelectionAllowed(selection))
          ) {
            set({ isBooking: false, isLoading: false });
            get().showErrorDialog(
              "Simulation unavailable",
              "This market is not supported in simulation mode. Exit Simulation mode to add to betslip.",
            );
            return null;
          }

          if (latestState.mode === "sim" && latestState.selections.length < 2) {
            set({ isBooking: false, isLoading: false });
            get().showErrorDialog(
              "Simulation unavailable",
              "Add at least two selections to run this betslip in Simulation mode.",
            );
            return null;
          }

          const suppressBonusFunding = Boolean(latestState.useCutOne || latestState.useFlex);
          const payload = {
            bets: buildBetsPayload(latestState),
            bonusId: suppressBonusFunding ? 0 : asNumber(latestState.bonusId, 0),
            isBooking: latestState.mode === "sim" ? 2 : 0,
            source: "web",
            useBonus: suppressBonusFunding ? false : latestState.useBonus,
          };
          const response = await betsApi.placeBet(payload);
          if (getBetServiceStatusCode(response) !== 200) {
            set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });
            get().showErrorDialog(
              latestState.mode === "sim" ? "Simulation unavailable" : "Place bet failed",
              getBetServiceStatusDescription(response) || "Unable to place bet.",
            );
            return null;
          }

          const data = getBetServiceData<Record<string, unknown>>(response) ?? undefined;
          if (latestState.mode === "sim" && !data) {
            set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });
            get().showErrorDialog(
              "Simulation unavailable",
              "The bet service did not return simulation data for this request.",
            );
            return null;
          }
          const bet = Array.isArray(data?.bets) ? (data?.bets?.[0] as Record<string, unknown> | undefined) : undefined;
          const bookingCode = String(
            bet?.share_code ??
              data?.share_code ??
              data?.booking_code ??
              (response as Record<string, unknown>)?.share_code ??
              "",
          );
          const potentialWin = asNumber(bet?.possibleWin, latestState.maxWin);

          if (latestState.mode === "sim") {
            const simulation = normalizeSimulationPayload(
              response as Record<string, unknown>,
              latestState,
              potentialWin,
            );
            if (!simulation) {
              set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });
              get().showErrorDialog(
                "Simulation unavailable",
                "The bet service did not return usable simulation data for this request.",
              );
              return null;
            }
            set({
              isBooking: false,
              isLoading: false,
              simulation,
            });
            return response as Record<string, unknown>;
          }

          if (!bookingCode) {
            set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });
            get().showErrorDialog(
              "Place bet failed",
              "The bet service did not return a booking code for this bet.",
            );
            return null;
          }

          try {
            await refreshCurrentUserProfile();
          } catch {
            // Leave the successful placement state intact even if profile refresh lags.
          }
          set({
            betPlaced: {
              bookingCode,
              potentialWin,
              response: response as Record<string, unknown>,
              totalStake: Number(latestState.totalStake || latestState.stake || 0),
              type: "place",
            },
            isBooking: false,
            isLoading: false,
            simulation: SIMULATION_INITIAL_STATE,
          });

          if ((latestState.mode as string) !== "sim") {
            void closeAbandonedBetslipSession("placed");
          }

          return response as Record<string, unknown>;
        } catch (error) {
          set({ isBooking: false, isLoading: false, simulation: SIMULATION_INITIAL_STATE });
          if (error instanceof Error && error.message === "One or more selections are invalid.") {
            return null;
          }
          get().showErrorDialog(
            "Place bet failed",
            error instanceof Error ? error.message : "Unable to place bet.",
          );
          return null;
        }
      },

      bookBet: async () => {
        const state = get();
        if (!state.selections.length || state.isBooking) return null;
        if (state.mode === "sim") {
          get().showErrorDialog(
            "Booking unavailable",
            "Switch back to Real mode to create a booking code for this betslip.",
          );
          return null;
        }

        set({ isBooking: true, isLoading: true });
        try {
          await get().ensureConfigLoaded();
          const validation = await get().validateSlip({ skipPreviews: true });
          if (!validation.canProceed) {
            if (getActiveSelections(get().selections).length === 0) {
              get().clearSlip();
            } else if (validation.reason === "inactiveSelections") {
              set({ isBooking: false, isLoading: false });
              get().showErrorDialog(
                "Selections unavailable",
                "One or more selections in this betslip are unavailable. Remove them before booking the bet.",
              );
            } else {
              set({ isBooking: false, isLoading: false });
            }
            return null;
          }

          const latestState = get();
          const suppressBonusFunding = Boolean(latestState.useCutOne || latestState.useFlex);
          const payload = {
            bets: buildBetsPayload(latestState),
            bonusId: suppressBonusFunding ? 0 : asNumber(latestState.bonusId, 0),
            isBooking: 1,
            source: "web",
            useBonus: suppressBonusFunding ? false : latestState.useBonus,
          };
          const response = await betsApi.placeBet(payload);
          if (getBetServiceStatusCode(response) !== 200) {
            set({ isBooking: false, isLoading: false });
            get().showErrorDialog(
              "Book bet failed",
              getBetServiceStatusDescription(response) || "Unable to book bet.",
            );
            return null;
          }

          const data = getBetServiceData<Record<string, unknown>>(response) ?? undefined;
          const bet = Array.isArray(data?.bets) ? (data?.bets?.[0] as Record<string, unknown> | undefined) : undefined;
          const bookingCode = String(
            bet?.share_code ??
              data?.share_code ??
              data?.booking_code ??
              (response as Record<string, unknown>)?.share_code ??
              "",
          );
          if (!bookingCode) {
            set({ isBooking: false, isLoading: false });
            get().showErrorDialog(
              "Book bet failed",
              "The bet service did not return a booking code for this bet.",
            );
            return null;
          }

          set({
            betPlaced: {
              bookingCode,
              potentialWin: asNumber(bet?.possibleWin, latestState.maxWin),
              response: response as Record<string, unknown>,
              totalStake: Number(latestState.totalStake || latestState.stake || 0),
              type: "book",
            },
            isBooking: false,
            isLoading: false,
          });

          return response as Record<string, unknown>;
        } catch (error) {
          set({ isBooking: false, isLoading: false });
          get().showErrorDialog(
            "Book bet failed",
            error instanceof Error ? error.message : "Unable to book bet.",
          );
          return null;
        }
      },

      dismissSuccess: () => set({ betPlaced: null }),

      advanceSimulation: () =>
        set((state) => {
          if (state.simulation.status !== "running") {
            return state;
          }

          const nextTimeSec = Number(
            Math.min(
              state.simulation.currentTimeSec + state.simulation.updateIntervalMs / 1000,
              state.simulation.durationSec,
            ).toFixed(1),
          );
          const timerEnded = nextTimeSec >= state.simulation.durationSec;

          return {
            simulation: {
              ...state.simulation,
              currentStage: getSimulationStage(nextTimeSec),
              currentTimeSec: nextTimeSec,
              scorePhase: getSimulationScorePhase(nextTimeSec),
              status: timerEnded ? "complete" : "running",
              timerEnded,
              timerStarted: nextTimeSec > 0,
            },
          };
        }),

      dismissSimulation: () =>
        set({
          simulation: SIMULATION_INITIAL_STATE,
        }),

      markSimulationWinShown: () =>
        set((state) => ({
          simulation: {
            ...state.simulation,
            winModalShown: true,
          },
        })),

      skipSimulationToResults: () =>
        set((state) => {
          if (state.simulation.status === "idle") {
            return state;
          }

          return {
            simulation: {
              ...state.simulation,
              currentStage: "fulltime",
              currentTimeSec: state.simulation.durationSec,
              scorePhase: 4,
              skipRequested: true,
              status: "complete",
              timerEnded: true,
              timerStarted: true,
            },
          };
        }),
    }),
    {
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CouponState>;
        const selections = Array.isArray(persisted.selections)
          ? persisted.selections.map((selection) => normalizeSelection(selection))
          : currentState.selections;
        const simulationRealSnapshot = persisted.simulationRealSnapshot
          ? {
              ...persisted.simulationRealSnapshot,
              selections: Array.isArray(persisted.simulationRealSnapshot.selections)
                ? persisted.simulationRealSnapshot.selections.map((selection) => normalizeSelection(selection))
                : [],
              combos: Array.isArray(persisted.simulationRealSnapshot.combos)
                ? persisted.simulationRealSnapshot.combos
                : [],
            }
          : null;
        const legacySystemStakes = (persisted as Partial<CouponState> & {
          systemStakes?: Record<string, number>;
        }).systemStakes;
        const persistedCombos = Array.isArray(persisted.combos)
          ? persisted.combos
          : legacySystemStakes
            ? Object.entries(legacySystemStakes).map(([grouping, stake]) => ({
                Combinations: 0,
                Grouping: Number(grouping),
                Stake: Number(stake || 0),
              }))
            : currentState.combos;
        const resolvedMode = resolveSimulationMode(
          persisted.mode === "sim" ? "sim" : "real",
          simulationRealSnapshot,
        );

        return {
          ...currentState,
          ...persisted,
          simulationRealSnapshot,
          ...applyCouponState(
            { ...currentState, ...persisted, selections } as CouponState,
            {
              betType: persisted.betType ?? currentState.betType,
              bonusId: persisted.bonusId ?? currentState.bonusId,
              flexMinWins: persisted.flexMinWins ?? currentState.flexMinWins,
              mode: resolvedMode,
              selections,
              stake: persisted.stake ?? currentState.stake,
              stakeCache: persisted.stakeCache ?? currentState.stakeCache,
              combos: persistedCombos,
              useBonus: persisted.useBonus ?? currentState.useBonus,
              useCashback: persisted.useCashback ?? currentState.useCashback,
              useCutOne: persisted.useCutOne ?? currentState.useCutOne,
              useEarlyGoal: persisted.useEarlyGoal ?? currentState.useEarlyGoal,
              useFlex: persisted.useFlex ?? currentState.useFlex,
            },
          ),
        };
      },
      name: "pitchside-coupon",
      partialize: (state) => ({
        betType: state.betType,
        bonusId: state.bonusId,
        combos: state.combos,
        selections: state.selections,
        stake: state.stake,
        stakeCache: state.stakeCache,
        totalOdds: state.totalOdds,
        totalStake: state.totalStake,
        useBonus: state.useBonus,
        useCashback: state.useCashback,
        useCutOne: state.useCutOne,
        useEarlyGoal: state.useEarlyGoal,
        useFlex: state.useFlex,
        mode: state.mode,
        simulationRealSnapshot: state.simulationRealSnapshot,
        flexMinWins: state.flexMinWins,
        earlyWinBulkMode: state.earlyWinBulkMode,
      }),
    },
  ),
);

export function selectSlip(state: CouponState) {
  return {
    betType:
      state.betType === "Single"
        ? "single"
        : state.betType === "System"
          ? "system"
          : "accumulator",
    potentialWin: state.maxWin,
    selections: state.selections,
    stake: state.stake,
    totalOdds: state.totalOdds,
  } as const;
}
