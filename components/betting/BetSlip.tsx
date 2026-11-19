"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { SimulationPanel } from "@/components/betting/SimulationPanel";
import { CodeHubItemCard, CodeHubItemCardSkeleton } from "@/components/betting/CodeHubItemCard";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { SportsbookFeatureIcon } from "@/components/ui/SportsbookFeatureIcon";
import { betsApi } from "@/lib/api/bets";
import { useCodeHub } from "@/lib/query/hooks/useBets";
import { getLiveFixtureHref, getPrematchFixtureHref } from "@/lib/utils/fixture-routes";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore, useUserStore } from "@/store";

function formatCurrency(currency = "NGN", amount = 0) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatNumber(amount = 0) {
  return Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function getMatchGroupColor(matchId: string) {
  const colors = ["#0D9737", "#1E88E5", "#F39C12", "#8E44AD", "#E91E63", "#00ACC1", "#6D4C41"];
  let hash = 0;
  for (let index = 0; index < matchId.length; index += 1) {
    hash = (hash * 31 + matchId.charCodeAt(index)) % 0x7fffffff;
  }
  return colors[hash % colors.length];
}

function getSelectionFixtureHref(selection: {
  matchId: string | number;
  sportName?: string;
  type: "prematch" | "live";
}) {
  const fixture = {
    matchID: selection.matchId,
    sportName: selection.sportName || "Football",
  };

  return selection.type === "live" ? getLiveFixtureHref(fixture) : getPrematchFixtureHref(fixture);
}

function parseStakeInput(value: string) {
  if (!value.trim()) return 0;
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function getGlobalNumber(globalVars: Record<string, unknown> | null, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(globalVars?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function displayComboName(grouping: number) {
  switch (grouping) {
    case 1:
      return "Single";
    case 2:
      return "Double";
    case 3:
      return "Treble";
    default:
      return `${grouping} folds`;
  }
}
function SelectionBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "danger" | "live" | "warning";
}) {
  const toneClassName =
    tone === "live"
      ? "bg-primary-action text-[#0C7A4D]"
      : tone === "danger"
        ? "bg-[#FDECEC] text-text-error-light"
        : tone === "warning"
          ? "bg-surface-warning text-text-gold"
          : "bg-white/8 text-[#46473E]";

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${toneClassName}`}>
      {label}
    </span>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
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

function getCustomCodeList(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  return payload.data
    .map((item) => isRecord(item) ? String(item.code_string ?? "").trim() : "")
    .filter(Boolean);
}

function getCustomCodeString(payload: unknown) {
  if (!isRecord(payload)) return "";
  if (!isRecord(payload.data)) return "";
  return String(payload.data.code_string ?? "").trim();
}

type CodeHubPreviewItem = {
  code: string;
  totalGames: number;
  totalOdds: number;
  selections: {
    eventName: string;
    marketName: string;
    outcomeName: string;
    odds: number;
    sportId: number;
    startTime: string;
  }[];
};

type CodeHubPreviewResponse = {
  data?: {
    data?: CodeHubPreviewItem[];
  };
};

const EMPTY_SLIP_CODE_HUB_PARAMS = {
  page: 1,
  perPage: 4,
  sort: "created|desc",
};

function FeatureChip({
  active,
  children,
  disabled,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-base font-black transition ${
        active
          ? "border-[var(--pitch)] bg-primary-action text-text-on-orange"
          : "border-white/12 bg-[#F1F2F0] text-white/82"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {children}
    </button>
  );
}

function FeatureOption({
  active,
  disabled,
  children,
  icon,
  label,
  onChange,
  showLabel = true,
}: {
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  onChange?: () => void;
  showLabel?: boolean;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2.5 transition ${
        active ? "text-white" : "text-[#3E4038]"
      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      aria-label={label}
      title={label}
    >
      <input
        type="checkbox"
        checked={Boolean(active)}
        disabled={disabled}
        onChange={() => onChange?.()}
        className="sr-only"
      />
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
          active ? "border-[var(--pitch)] bg-primary-action/12" : "border-[#2D2E28]"
        }`}
      >
        {active ? <span className="h-2 w-2 rounded-full bg-primary-action" /> : null}
      </span>
      <span className="inline-flex items-center gap-2 text-base font-black">
        {icon}
        {showLabel ? <span>{children ?? label}</span> : null}
      </span>
    </label>
  );
}

export function BetSlip() {
  const router = useRouter();
  const pathname = usePathname();
  const [loadCode, setLoadCode] = useState("");
  const [pendingAction, setPendingAction] = useState<null | "bet">(null);
  const [assignedCustomCode, setAssignedCustomCode] = useState("");
  const [customCodeError, setCustomCodeError] = useState("");
  const [customCodeLoading, setCustomCodeLoading] = useState(false);
  const [customCodeModal, setCustomCodeModal] = useState<"" | "assigned" | "create" | "select">("");
  const [customCodes, setCustomCodes] = useState<string[]>([]);
  const [customSuffix, setCustomSuffix] = useState("");
  const [isAssigningCustomCode, setIsAssigningCustomCode] = useState(false);
  const [isCreatingCustomCode, setIsCreatingCustomCode] = useState(false);
  const [isBookBetSubmitting, setIsBookBetSubmitting] = useState(false);
  const [customCodeLoadError, setCustomCodeLoadError] = useState("");
  const [isCodeHubExpanded, setIsCodeHubExpanded] = useState(false);
  const didBootstrapForOpen = useRef(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.currentUser);
  const { openLogin } = useAuthModal();
  const {
    selections,
    betType,
    nativeBetType,
    mode,
    stake,
    totalStake,
    totalOdds,
    maxWin,
    minOdds,
    minWin,
    acceptChanges,
    hasSplitBet,
    isOpen,
    isLoading,
    isBootstrapping,
    isBooking,
    isAccaBonusLoading,
    isCutOneLoading,
    isFlexLoading,
    isEarlyWinLoading,
    isEarlyGoalLoading,
    useCutOne,
    useFlex,
    useEarlyGoal,
    useBonus,
    useCashback,
    earlyWinBulkMode,
    flexMinWins,
    bonusId,
    globalVars,
    sportsbookFeatureConfig,
    combos,
    simulation,
    dialog,
    betPlaced,
    accaBonusPreview,
    splitMatchIds,
    toggleOpen,
    removeSelection,
    updateStake,
    updateSystemStake,
    requestClearSlip,
    setBetType,
    setMode,
    setFlexMinWins,
    toggleBanker,
    acceptOddsChanges,
    bootstrapSlip,
    toggleCutOne,
    toggleFlex,
    applyBulkEarlyWinMode,
    toggleEarlyGoal,
    setSelectionEarlyWinMode,
    setSelectionEarlyGoalMode,
    requestLoadByCode,
    closeDialog,
    confirmDialog,
    dismissSuccess,
    dismissSimulation,
    advanceSimulation,
    clearSlip,
    placeBet,
    bookBet,
    skipSimulationToResults,
  } = useCouponStore(
    useShallow((state) => ({
      selections: state.selections,
      betType: state.betType,
      nativeBetType: state.nativeBetType,
      mode: state.mode,
      stake: state.stake,
      totalStake: state.totalStake,
      totalOdds: state.totalOdds,
      maxWin: state.maxWin,
      minOdds: state.minOdds,
      minWin: state.minWin,
      acceptChanges: state.acceptChanges,
      hasSplitBet: state.hasSplitBet,
      isOpen: state.isOpen,
      isLoading: state.isLoading,
      isBootstrapping: state.isBootstrapping,
      isBooking: state.isBooking,
      isAccaBonusLoading: state.isAccaBonusLoading,
      isCutOneLoading: state.isCutOneLoading,
      isFlexLoading: state.isFlexLoading,
      isEarlyWinLoading: state.isEarlyWinLoading,
      isEarlyGoalLoading: state.isEarlyGoalLoading,
      useCutOne: state.useCutOne,
      useFlex: state.useFlex,
      useEarlyGoal: state.useEarlyGoal,
      useBonus: state.useBonus,
      useCashback: state.useCashback,
      earlyWinBulkMode: state.earlyWinBulkMode,
      flexMinWins: state.flexMinWins,
      bonusId: state.bonusId,
      globalVars: state.globalVars,
      sportsbookFeatureConfig: state.sportsbookFeatureConfig,
      combos: state.combos,
      simulation: state.simulation,
      dialog: state.dialog,
      betPlaced: state.betPlaced,
      accaBonusPreview: state.accaBonusPreview,
      splitMatchIds: state.splitMatchIds,
      toggleOpen: state.toggleOpen,
      removeSelection: state.removeSelection,
      updateStake: state.updateStake,
      updateSystemStake: state.updateSystemStake,
      requestClearSlip: state.requestClearSlip,
      setBetType: state.setBetType,
      setMode: state.setMode,
      setFlexMinWins: state.setFlexMinWins,
      toggleBanker: state.toggleBanker,
      acceptOddsChanges: state.acceptOddsChanges,
      bootstrapSlip: state.bootstrapSlip,
      toggleCutOne: state.toggleCutOne,
      toggleFlex: state.toggleFlex,
      applyBulkEarlyWinMode: state.applyBulkEarlyWinMode,
      toggleEarlyGoal: state.toggleEarlyGoal,
      setSelectionEarlyWinMode: state.setSelectionEarlyWinMode,
      setSelectionEarlyGoalMode: state.setSelectionEarlyGoalMode,
      requestLoadByCode: state.requestLoadByCode,
      closeDialog: state.closeDialog,
      confirmDialog: state.confirmDialog,
      dismissSuccess: state.dismissSuccess,
      dismissSimulation: state.dismissSimulation,
      advanceSimulation: state.advanceSimulation,
      clearSlip: state.clearSlip,
      placeBet: state.placeBet,
      bookBet: state.bookBet,
      skipSimulationToResults: state.skipSimulationToResults,
    })),
  );
  const totalSelections = selections.length;
  const {
    data: codeHubPreviewData,
    isLoading: isCodeHubPreviewLoading,
  } = useCodeHub(EMPTY_SLIP_CODE_HUB_PARAMS, isOpen && totalSelections === 0 && isCodeHubExpanded);
  const codeHubPreviewItems = (codeHubPreviewData as CodeHubPreviewResponse | undefined)?.data?.data ?? [];
  const isSimulationActive = simulation.status !== "idle";

  useEffect(() => {
    if (!isOpen) {
      didBootstrapForOpen.current = false;
      return;
    }
    if (isSimulationActive) return;
    if (!selections.length || didBootstrapForOpen.current) return;
    didBootstrapForOpen.current = true;
    void bootstrapSlip();
  }, [bootstrapSlip, isOpen, isSimulationActive, selections.length]);

  useEffect(() => {
    if (!isOpen || totalSelections !== 0 || mode === "real") return;
    void setMode("real");
  }, [isOpen, mode, setMode, totalSelections]);

  useEffect(() => {
    if (!isOpen) return;
    const previousHtmlOverflow = document.documentElement.style.overflowY;
    const previousBodyOverflow = document.body.style.overflowY;
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflowY = "hidden";

    return () => {
      document.documentElement.style.overflowY = previousHtmlOverflow;
      document.body.style.overflowY = previousBodyOverflow;
    };
  }, [isOpen]);

  const currentPath =
    typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}`;
  const balanceTooLow =
    isAuthenticated && mode === "real"
      ? Number(currentUser?.availableBalance ?? 0) < Number(totalStake || 0)
      : false;
  const minimumStake =
    betType === "System"
      ? getGlobalNumber(globalVars, ["comboMinStake", "systemMinStake"], 0)
      : betType === "Multiple"
        ? getGlobalNumber(globalVars, ["multipleMinStake", "singleMinStake"], 0)
        : getGlobalNumber(globalVars, ["singleMinStake"], 0);
  const stakeBelowMinimum = Number(totalStake || 0) < minimumStake;
  const hasSuspendedSelections = selections.some((selection) => selection.suspended || selection.unavailable);
  const amountNeededToStake = Math.max(
    0,
    Number(totalStake || 0) - Number(currentUser?.availableBalance ?? 0),
  );
  const stakedSystemRows = combos.filter((combo) => Number(combo.Stake || 0) > 0);
  const systemPlayAllStake = stakedSystemRows.length && stakedSystemRows.length === combos.length
    ? stakedSystemRows.every((combo) => Number(combo.Stake || 0) === Number(stakedSystemRows[0]?.Stake || 0))
      ? Number(stakedSystemRows[0]?.Stake || 0)
      : 0
    : 0;
  const activeSelections = selections.filter(
    (selection) => !selection.suspended && !selection.unavailable && Number(selection.odds || 0) > 1,
  );
  const maxFlexMinWins = Math.max(2, activeSelections.length - 1);
  const hasEarlyWinEligibleSelection = selections.some(
    (selection) =>
      Boolean(selection.hasExplicitDerivedMarkets) ||
      selection.earlyWinMode === "1up" ||
      selection.earlyWinMode === "2up",
  );
  const hasEarlyGoalEligibleSelection = selections.some(
    (selection) => selection.supportsEarlyGoal || selection.earlyGoalMode === "earlygoal",
  );
  const cutOneConfig = sportsbookFeatureConfig.cutOne;
  const flexConfig = sportsbookFeatureConfig.flex;
  const cutOneConfigEnabled =
    Boolean(cutOneConfig?.is_active) &&
    String(cutOneConfig?.status || "active").toLowerCase() === "active";
  const flexConfigEnabled =
    Boolean(flexConfig?.is_active) &&
    String(flexConfig?.status || "active").toLowerCase() === "active";
  const canUseCutOne =
    betType === "Multiple" &&
    nativeBetType === "Multiple" &&
    cutOneConfigEnabled &&
    !useFlex &&
    !useBonus &&
    !useCashback &&
    Number(bonusId || 0) === 0 &&
    activeSelections.length >= Number(cutOneConfig?.min_selections || 0) &&
    activeSelections.every(
      (selection) => Number(selection.odds || 0) >= Number(cutOneConfig?.min_odds_per_leg || 0),
    );
  const canUseFlex =
    betType === "Multiple" &&
    nativeBetType === "Multiple" &&
    flexConfigEnabled &&
    !useCutOne &&
    !useBonus &&
    !useCashback &&
    Number(bonusId || 0) === 0 &&
    activeSelections.length >= Number(flexConfig?.min_selections || 0) &&
    (Number(flexConfig?.max_selections || 0) === 0 ||
      activeSelections.length <= Number(flexConfig?.max_selections || 0));
  const previewLoading = isAccaBonusLoading || isCutOneLoading || isFlexLoading;
  const placeBetDisabled =
    isLoading ||
    isBootstrapping ||
    !totalSelections ||
    totalStake <= 0 ||
    stakeBelowMinimum ||
    hasSuspendedSelections ||
    balanceTooLow ||
    !acceptChanges ||
    previewLoading ||
    (mode === "sim" && totalSelections < 2);
  const bonusAmount =
    useCutOne || useFlex ? 0 : Number(accaBonusPreview?.bonus_amount ?? 0);
  const displayedOddsLabel = hasSplitBet
    ? `${Number(minOdds || 0).toFixed(2)} ~ ${Number(totalOdds || 0).toFixed(2)}`
    : Number(totalOdds || 0).toFixed(2);
  const showsPotentialWinRange =
    hasSplitBet || betType === "System" || (betType === "Single" && totalSelections > 1);
  const potentialWinDisplay = showsPotentialWinRange
    ? `${formatCurrency(currentUser?.currency ?? "NGN", minWin)} ~ ${formatCurrency(currentUser?.currency ?? "NGN", maxWin)}`
    : formatCurrency(currentUser?.currency ?? "NGN", maxWin);
  const canUseCustomCodes = Boolean(isAuthenticated && betPlaced?.bookingCode && !betPlaced?.isSimulation);
  const isPlaceBetSubmitting = isBooking && !isBookBetSubmitting;
  const successIsBookBet = betPlaced?.type === "book";
  const successTitle = successIsBookBet ? "Booking Code Created" : "Bet Successful";
  const successEyebrow = successIsBookBet ? "Bet booked" : "Ticket accepted";
  const successCodeLabel = successIsBookBet ? "Code" : "Booking code";
  const successPrimaryActionLabel = successIsBookBet ? "Done" : "OK";

  useEffect(() => {
    if (betPlaced) return;
    const resetId = window.setTimeout(() => {
      setAssignedCustomCode("");
      setCustomCodeError("");
      setCustomCodeLoading(false);
      setCustomCodeModal("");
      setCustomCodes([]);
      setCustomSuffix("");
      setIsAssigningCustomCode(false);
      setIsCreatingCustomCode(false);
      setCustomCodeLoadError("");
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [betPlaced]);

  useEffect(() => {
    if (simulation.status !== "running") return;

    const intervalId = window.setInterval(() => {
      advanceSimulation();
    }, simulation.updateIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [advanceSimulation, simulation.status, simulation.updateIntervalMs]);

  const handleConfirmAction = async () => {
    const action = pendingAction;
    setPendingAction(null);

    if (action === "bet") {
      if (!isAuthenticated && mode === "real") {
        openLogin(currentPath);
        return;
      }
      await placeBet();
    }
  };

  const handleBookBet = async () => {
    if (isBookBetSubmitting) return;

    setIsBookBetSubmitting(true);
    try {
      await bookBet();
    } finally {
      setIsBookBetSubmitting(false);
    }
  };

  const handleShareSuccess = async () => {
    if (!betPlaced?.bookingCode) return;

    try {
      if (navigator.share) {
        await navigator.share({
          text: `Booking code: ${betPlaced.bookingCode}`,
          title: "Pitchside booking code",
        });
        return;
      }

      await navigator.clipboard.writeText(betPlaced.bookingCode);
    } catch {
      // ignore share cancellations
    }
  };

  const handleCopyBookingCode = async () => {
    if (!betPlaced?.bookingCode) return;
    try {
      await navigator.clipboard.writeText(betPlaced.bookingCode);
    } catch {
      // clipboard failure can stay silent
    }
  };

  const handleCopyCustomCode = async () => {
    if (!assignedCustomCode) return;
    try {
      await navigator.clipboard.writeText(assignedCustomCode);
    } catch {
      // clipboard failure can stay silent
    }
  };

  const handleShareCustomCode = async () => {
    if (!assignedCustomCode) return;

    try {
      if (navigator.share) {
        await navigator.share({
          text: assignedCustomCode,
          title: "Pitchside custom code",
        });
        return;
      }

      await navigator.clipboard.writeText(assignedCustomCode);
    } catch {
      // ignore share cancellations
    }
  };

  const openCustomCodeFlow = async () => {
    if (!betPlaced?.bookingCode || customCodeLoading) return;

    setAssignedCustomCode("");
    setCustomCodeError("");
    setCustomCodeLoadError("");
    setCustomCodeLoading(true);
    try {
      const response = await betsApi.getCustomCodes();
      if (getBetServiceStatusCode(response) !== 200) {
        throw new Error(getBetServiceStatusDescription(response) || "Custom codes could not be loaded.");
      }
      const nextCodes = getCustomCodeList(response);
      setCustomCodes(nextCodes);
      setCustomCodeModal(nextCodes.length ? "select" : "create");
    } catch (error) {
      setCustomCodes([]);
      setCustomCodeLoadError(
        error instanceof Error
          ? error.message
          : "Custom codes could not be loaded.",
      );
      setCustomCodeModal("create");
    } finally {
      setCustomCodeLoading(false);
    }
  };

  const closeCustomCodeModal = () => {
    if (customCodeLoading || isAssigningCustomCode || isCreatingCustomCode) return;
    setCustomCodeError("");
    setCustomCodeLoadError("");
    setCustomCodeModal("");
  };

  const assignExistingCustomCode = async (code: string) => {
    if (!betPlaced?.bookingCode || !code || isAssigningCustomCode) return;
    setAssignedCustomCode(code);
    setCustomCodeError("");
    setIsAssigningCustomCode(true);
    try {
      const response = await betsApi.assignCustomCode(code, { system_code: betPlaced.bookingCode });
      if (getBetServiceStatusCode(response) !== 200) {
        throw new Error(getBetServiceStatusDescription(response) || "Custom code could not be assigned.");
      }
      setAssignedCustomCode(getCustomCodeString(response) || code);
      setCustomCodeModal("assigned");
    } catch (error) {
      setCustomCodeError(error instanceof Error ? error.message : "Custom code could not be assigned.");
    } finally {
      setIsAssigningCustomCode(false);
    }
  };

  const submitCustomCode = async () => {
    if (!betPlaced?.bookingCode || isCreatingCustomCode) return;
    const normalizedSuffix = customSuffix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
    setCustomSuffix(normalizedSuffix);
    if (!/^[a-zA-Z0-9]{1,25}$/.test(normalizedSuffix)) {
      setCustomCodeError("Use 1-25 letters or numbers.");
      return;
    }

    setCustomCodeError("");
    setIsCreatingCustomCode(true);
    try {
      const created = await betsApi.createCustomCode({ suffix: normalizedSuffix });
      if (getBetServiceStatusCode(created) !== 201) {
        throw new Error(getBetServiceStatusDescription(created) || "Custom code could not be created.");
      }
      const code = getCustomCodeString(created);
      if (!code) {
        throw new Error("Custom code could not be created.");
      }
      setAssignedCustomCode(code);
      const assigned = await betsApi.assignCustomCode(code, { system_code: betPlaced.bookingCode });
      if (getBetServiceStatusCode(assigned) !== 200) {
        throw new Error(getBetServiceStatusDescription(assigned) || "Custom code could not be assigned.");
      }
      setAssignedCustomCode(getCustomCodeString(assigned) || code);
      setCustomCodeModal("assigned");
    } catch (error) {
      setCustomCodeError(error instanceof Error ? error.message : "Custom code could not be created.");
    } finally {
      setIsCreatingCustomCode(false);
    }
  };

  if (!isOpen) return null;

  if (isSimulationActive) {
    return (
      <div className="fixed inset-0 z-[var(--z-menu)] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative max-h-[90vh] overflow-hidden rounded-t-2xl border border-white/8 bg-[#F5F5F4] shadow-sheet">
          <SimulationPanel
            selections={selections}
            simulation={simulation}
            onDismiss={dismissSimulation}
            onSkip={skipSimulationToResults}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-menu)] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={
          isSimulationActive
            ? undefined
            : () => {
                setIsCodeHubExpanded(false);
                toggleOpen();
              }
        }
        aria-label="Close betslip"
      />

      <div className="relative max-h-[90vh] overflow-hidden rounded-t-2xl border border-white/8 bg-[#F5F5F4] shadow-sheet">
        <div className="border-b border-white/6 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {totalSelections > 0 ? (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-action px-3 text-sm font-black text-text-on-orange">
                  {totalSelections}
                </span>
              ) : (
                <span className="text-2xl font-black text-white">Betslip</span>
              )}
              {totalSelections > 0 ? (
                <span className="font-heading text-[20px] font-extrabold tracking-[-0.03em]">Betslip</span>
              ) : null}
              {false ? (
                <div className="inline-flex rounded-full border border-[var(--pitch)]/70 bg-[#F2F3F1]">
                  <button
                    type="button"
                    disabled={isSimulationActive}
                    onClick={() => setMode("real")}
                    className={`rounded-full px-3 py-0.5 text-sm font-black ${
                      mode === "real" ? "bg-primary-action text-text-on-orange" : "text-muted-foreground"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    REAL
                  </button>
                  <button
                    type="button"
                    disabled={isSimulationActive}
                    onClick={() => setMode("sim")}
                    className={`rounded-full px-3 py-0.5 text-sm font-black ${
                      mode === "sim" ? "bg-primary-action text-text-on-orange" : "text-muted-foreground"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    SIM
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              {selections.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeHubExpanded(false);
                    requestClearSlip();
                  }}
                  className="inline-flex items-center gap-2 text-[#55574C]"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={
                  isSimulationActive
                    ? undefined
                    : () => {
                        setIsCodeHubExpanded(false);
                        toggleOpen();
                      }
                }
                disabled={isSimulationActive}
                className="text-white/70 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {totalSelections > 1 && mode !== "sim" ? (
          <div className="px-4">
            <div className="grid grid-cols-3 rounded-md bg-[#F7F7F6] p-1">
              {(["Single", "Multiple", "System"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={option === "System" && hasSplitBet}
                  onClick={() => setBetType(option)}
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                    betType === option
                      ? "bg-[#EAEAE7] text-white shadow-md"
                      : "text-[#9FA193]"
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-[calc(92vh-140px)] overflow-y-auto">
          {totalSelections === 0 ? (
            <div className="space-y-4 px-4 py-6">
              <section className="betslip-codehub-section">
                <button
                  type="button"
                  className="betslip-codehub-toggle"
                  aria-expanded={isCodeHubExpanded}
                  onClick={() => setIsCodeHubExpanded((current) => !current)}
                >
                  <span>
                    <strong>Recommended Football Codes</strong>
                    {!isCodeHubExpanded ? (
                      <small>Save the effort of building it from scratch</small>
                    ) : null}
                  </span>
                  <ChevronDown
                    size={22}
                    className={`betslip-codehub-chevron ${isCodeHubExpanded ? "is-open" : ""}`}
                  />
                </button>

                {isCodeHubExpanded ? (
                  <div className="betslip-codehub-body">
                    {isCodeHubPreviewLoading ? (
                      <div className="betslip-codes-carousel" aria-label="Loading booking codes">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <CodeHubItemCardSkeleton key={`empty-code-skeleton-${index}`} />
                        ))}
                      </div>
                    ) : codeHubPreviewItems.length ? (
                      <div className="betslip-codes-carousel" aria-label="Recommended booking codes">
                        {codeHubPreviewItems.map((item) => (
                          <CodeHubItemCard
                            key={item.code}
                            item={item}
                            disabled={isLoading}
                            onAdd={(code) => {
                              setIsCodeHubExpanded(false);
                              void requestLoadByCode(code);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="betslip-codehub-empty">No recommended codes available right now.</div>
                    )}
                  </div>
                ) : null}
              </section>

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    autoComplete="off"
                    value={loadCode}
                    onChange={(event) => setLoadCode(event.target.value)}
                    placeholder="Enter booking code"
                    className="h-12 flex-1 rounded-xl border border-white/10 bg-[#F6F6F4] p-4 text-lg font-semibold text-white outline-none placeholder:text-[#999B8C]"
                  />
                  <button
                    type="button"
                    disabled={!loadCode.trim() || isLoading}
                    onClick={() => {
                      setIsCodeHubExpanded(false);
                      void requestLoadByCode(loadCode);
                    }}
                    className="rounded-xl bg-primary-action py-3 text-md font-black text-text-on-orange disabled:opacity-45"
                  >
                    Load
                  </button>
                </div>
            </div>
          ) : (
            <>
              <div className="">
                {selections.map((selection) => {
                  const showEarlyWinControls =
                    Number(selection.baseMarketId || selection.marketId || 0) === 1 &&
                    (Boolean(selection.hasExplicitDerivedMarkets) ||
                      selection.earlyWinMode === "1up" ||
                      selection.earlyWinMode === "2up");
                  const showEarlyGoalControl =
                    Number(selection.baseMarketId || selection.marketId || 0) === 18 &&
                    (selection.supportsEarlyGoal || selection.earlyGoalMode === "earlygoal");
                  const showSingleStakeInput = betType === "Single" && totalSelections > 1;
                  const marketStatus =
                    selection.unavailable ? "Unavailable" : selection.suspended ? "Suspended" : null;
                  const isSplitSelection = splitMatchIds.includes(String(selection.matchId));
                  const customBetLegs = selection.customBetLegs ?? [];

                  return (
                    <div
                      key={selection.selectionId}
                      className="relative overflow-hidden border-b border-white/6 bg-surface-simulation px-4 py-2"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute bottom-2 left-0 top-2 w-1 rounded-full"
                        style={{
                          backgroundColor: isSplitSelection
                            ? getMatchGroupColor(String(selection.matchId))
                            : "transparent",
                        }}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {selection.type === "live" ? <SelectionBadge label="Live" tone="live" /> : null}
                            {marketStatus ? (
                              <SelectionBadge
                                label={marketStatus}
                                tone={marketStatus === "Unavailable" ? "danger" : "warning"}
                              />
                            ) : null}
                            {selection.changed ? <SelectionBadge label="Odds Changed" tone="warning" /> : null}
                          </div>
                          <p className="mt-2 text-md font-bold text-white">
                            {customBetLegs.length ? "BetBuilder" : selection.outcomeName}
                          </p>
                          <Link
                            href={getSelectionFixtureHref(selection)}
                            className="mt-1 block text-left text-lg text-[#2D2E28] underline-offset-2 hover:text-[var(--pitch)] hover:underline"
                          >
                            {selection.eventName}
                          </Link>
                          <p className="mt-1 text-md text-text-muted-4">
                            {customBetLegs.length ? `${customBetLegs.length} CustomBet picks` : selection.marketName}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => removeSelection(selection.selectionId)}
                            className="border text-white/55"
                          >
                            <X size={14} />
                          </button>
                          <span
                            className={`font-bold `}
                          >
                            {Number(selection.odds || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {customBetLegs.length ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-[#F6F6F4] p-3">
                          {customBetLegs.map((leg) => (
                            <div
                              key={`${leg.matchId}-${leg.marketId}-${leg.outcomeId}-${leg.specifier || ""}`}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-bold text-white">
                                  {leg.outcomeName || leg.outcomeId}
                                </span>
                                <span className="block truncate text-text-muted-4">
                                  {leg.marketName || "CustomBet"}{leg.specifier ? ` · ${leg.specifier}` : ""}
                                </span>
                              </span>
                              <span className="shrink-0 font-black text-[var(--pitch)]">
                                {Number(leg.odds || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {showEarlyWinControls ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <FeatureChip
                            active={selection.earlyWinMode === "1up"}
                            disabled={
                              isEarlyWinLoading ||
                              !selection.supportedEarlyWinModes?.includes("1up")
                            }
                            onClick={() => void setSelectionEarlyWinMode(selection.selectionId, "1up")}
                          >
                            1UP
                          </FeatureChip>
                          <FeatureChip
                            active={selection.earlyWinMode === "2up"}
                            disabled={
                              isEarlyWinLoading ||
                              !selection.supportedEarlyWinModes?.includes("2up")
                            }
                            onClick={() => void setSelectionEarlyWinMode(selection.selectionId, "2up")}
                          >
                            2UP
                          </FeatureChip>
                        </div>
                      ) : null}

                      {betType === "System" ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <FeatureChip
                            active={Boolean(selection.fixed)}
                            disabled={hasSplitBet}
                            onClick={() => toggleBanker(selection.selectionId)}
                          >
                            {selection.fixed ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Check size={12} />
                                Banker
                              </span>
                            ) : (
                              "Set Banker"
                            )}
                          </FeatureChip>
                        </div>
                      ) : null}

                      {showEarlyGoalControl ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <FeatureChip
                            active={selection.earlyGoalMode === "earlygoal"}
                            disabled={isEarlyGoalLoading || mode === "sim"}
                            onClick={() =>
                              void setSelectionEarlyGoalMode(
                                selection.selectionId,
                                selection.earlyGoalMode !== "earlygoal",
                              )
                            }
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <SportsbookFeatureIcon
                                kind="earlyGoals"
                                variant="chip"
                                className="h-[14px] w-[16px] shrink-0"
                              />
                              Early Goals
                            </span>
                          </FeatureChip>
                        </div>
                      ) : null}

                      {showSingleStakeInput ? (
                        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-[#F5F5F4] px-4 py-3">
                          <label
                            htmlFor={`single-stake-${selection.selectionId}`}
                            className="text-base font-bold uppercase tracking-[0.12em] text-text-muted-4"
                          >
                            Stake
                          </label>
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-betslip px-3 py-2">
                            <span className="text-lg font-semibold text-text-currency">₦</span>
                            <input
                              id={`single-stake-${selection.selectionId}`}
                              type="number"
                              autoComplete="off"
                              min={0}
                              value={selection.stake ?? stake ?? ""}
                              onChange={(event) =>
                                updateStake(parseStakeInput(event.target.value), selection.selectionId)
                              }
                              className="w-20 bg-transparent text-right text-2xl font-black text-white outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {acceptChanges ? null : (
                <div className="px-4 pb-2">
                  <button
                    type="button"
                    onClick={acceptOddsChanges}
                    className="w-full rounded-lg border border-[#0C7A4D]/40 bg-[#CBEA4E] px-4 py-3 text-md font-black text-text-gold"
                  >
                    Accept odds changes
                  </button>
                </div>
              )}

              {betType === "System" && combos.length ? (
                <div className="px-4 pb-2">
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-[#F5F5F4] px-4 py-3">
                      <div>
                        <p className="text-md font-black text-white">Play All</p>
                        <p className="mt-0.5 text-sm font-semibold text-text-muted-4">
                          Same stake on every system size
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-betslip px-3 py-2">
                        <span className="text-md font-semibold text-text-currency">₦</span>
                        <input
                          type="number"
                          autoComplete="off"
                          min={0}
                          value={systemPlayAllStake || ""}
                          onChange={(event) => updateSystemStake(parseStakeInput(event.target.value))}
                          className="w-20 bg-transparent text-right text-xl font-black text-white outline-none"
                        />
                      </div>
                    </div>
                    {combos.map((combo) => (
                      <div
                        key={combo.Grouping}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                          combo.checked || Number(combo.Stake || 0) > 0
                            ? "border-[var(--pitch)]/35 bg-[#F1F2F0]"
                            : "border-white/6 bg-[#F5F5F4]"
                        }`}
                      >
                        <div>
                          <p className="text-md font-black text-white">
                            {displayComboName(combo.Grouping)}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-text-muted-4">
                            {combo.Combinations}x
                          </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-betslip px-3 py-2">
                          <span className="text-md font-semibold text-text-currency">₦</span>
                          <input
                            type="number"
                            autoComplete="off"
                            min={0}
                            value={Number(combo.Stake || 0) || ""}
                            onChange={(event) =>
                              updateSystemStake(parseStakeInput(event.target.value), combo.Grouping)
                            }
                            className="w-20 bg-transparent text-right text-xl font-black text-white outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-white/6 px-4 pb-5 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xl font-bold text-white">
                    {betType === "System"
                      ? "Total Stake"
                      : betType === "Single"
                      ? totalSelections > 1
                        ? "Default stake"
                        : `Stake per bet (${totalSelections} bet${totalSelections === 1 ? "" : "s"})`
                      : "Total Stake"}
                  </label>
                  {betType === "System" ? (
                    <div className="rounded-2xl border border-white/10 bg-surface-betslip px-4 py-3 text-right text-4xl font-black text-white">
                      {formatNumber(totalStake)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-betslip px-4 py-2">
                      <span className="text-2xl font-semibold text-text-currency">₦</span>
                      <input
                        type="number"
                        autoComplete="off"
                        min={0}
                        value={stake || ""}
                        onChange={(event) => updateStake(parseStakeInput(event.target.value))}
                        className="w-20 bg-transparent text-right text-2xl font-black text-white outline-none"
                      />
                    </div>
                  )}
                </div>

                {balanceTooLow ? (
                  <div className="mt-3 rounded-2xl border border-[#D22B34] bg-[#FDECEC] px-4 py-3 text-md text-accent-pink">
                    You need a balance of {formatCurrency(currentUser?.currency ?? "NGN", totalStake)} to place this bet.
                    Please deposit an additional {formatCurrency(currentUser?.currency ?? "NGN", amountNeededToStake)}.
                    <button
                      type="button"
                      onClick={() => router.push("/deposit")}
                      className="ml-2 font-black text-[#D22B34]"
                    >
                      Go to Deposit
                    </button>
                  </div>
                ) : null}

                {stakeBelowMinimum && minimumStake > 0 ? (
                  <div className="mt-3 rounded-2xl border border-[#0C7A4D] bg-[#CBEA4E] px-4 py-3 text-md text-text-gold">
                    Minimum stake is {formatCurrency(currentUser?.currency ?? "NGN", minimumStake)}.
                  </div>
                ) : null}

                {hasSuspendedSelections ? (
                  <div className="mt-3 rounded-2xl border border-[#0C7A4D] bg-[#CBEA4E] px-4 py-3 text-md text-text-gold">
                    Some selections are suspended.
                  </div>
                ) : null}

                <div className="mt-4 hidden border-y border-white/6 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-white">Insure</p>
                    </div>
                    {(isEarlyWinLoading || isEarlyGoalLoading) ? (
                      <Loader2 size={18} className="animate-spin text-[var(--pitch)]" />
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-4">
                    <FeatureOption
                      active={earlyWinBulkMode === "1up"}
                      disabled={isEarlyWinLoading || !hasEarlyWinEligibleSelection}
                      label="1UP"
                      onChange={() => void applyBulkEarlyWinMode("1up")}
                      showLabel={false}
                      icon={
                        <SportsbookFeatureIcon
                          kind="oneUp"
                          tone={earlyWinBulkMode === "1up" ? "active" : "muted"}
                          variant="chip"
                          className="h-[14px] w-[28px] shrink-0"
                        />
                      }
                    />
                    <FeatureOption
                      active={earlyWinBulkMode === "2up"}
                      disabled={isEarlyWinLoading || !hasEarlyWinEligibleSelection}
                      label="2UP"
                      onChange={() => void applyBulkEarlyWinMode("2up")}
                      showLabel={false}
                      icon={
                        <SportsbookFeatureIcon
                          kind="twoUp"
                          tone={earlyWinBulkMode === "2up" ? "active" : "muted"}
                          variant="chip"
                          className="h-[14px] w-[30px] shrink-0"
                        />
                      }
                    />
                    <FeatureOption
                      active={useCutOne}
                      disabled={isCutOneLoading || !canUseCutOne}
                      label="Cut-1"
                      onChange={() => void toggleCutOne()}
                      icon={
                        <SportsbookFeatureIcon
                          kind="cutOne"
                          tone={useCutOne ? "active" : "muted"}
                          variant="chip"
                          className="h-[18px] w-[20px] shrink-0"
                        />
                      }
                    >
                      Cut 1
                    </FeatureOption>
                    <FeatureOption
                      active={useFlex}
                      disabled={isFlexLoading || !canUseFlex}
                      label="Flex"
                      onChange={() => void toggleFlex()}
                      icon={
                        <SportsbookFeatureIcon
                          kind="flex"
                          tone={useFlex ? "active" : "muted"}
                          variant="chip"
                          className="h-[18px] w-[20px] shrink-0"
                        />
                      }
                    >
                      Flex
                    </FeatureOption>
                    <FeatureOption
                      active={useEarlyGoal}
                      disabled={isEarlyGoalLoading || !hasEarlyGoalEligibleSelection || mode === "sim"}
                      label="Early Goals"
                      onChange={() => void toggleEarlyGoal()}
                      icon={
                        <SportsbookFeatureIcon
                          kind="earlyGoals"
                          variant="chip"
                          className="h-[18px] w-[20px] shrink-0"
                        />
                      }
                    >
                      Early Goals
                    </FeatureOption>
                  </div>

                  {useFlex ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#F2F3F1] px-4 py-3">
                      <p className="text-md font-semibold text-white">
                        Min. selections to win
                      </p>
                      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#F6F6F5] px-3 py-1.5">
                        <button
                          type="button"
                          disabled={flexMinWins <= 2}
                          onClick={() => setFlexMinWins(flexMinWins - 1)}
                          className="text-3xl font-black text-white disabled:opacity-35"
                        >
                          -
                        </button>
                        <span className="min-w-6 text-center text-lg font-black text-[var(--pitch)]">
                          {flexMinWins}
                        </span>
                        <button
                          type="button"
                          disabled={flexMinWins >= maxFlexMinWins}
                          onClick={() => setFlexMinWins(flexMinWins + 1)}
                          className="text-3xl font-black text-white disabled:opacity-35"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3 text-lg">
                  <div className="flex items-center justify-between text-text-muted-3">
                    <span>Total Odds</span>
                    <span className="font-bold text-white">{displayedOddsLabel}</span>
                  </div>
                  {bonusAmount > 0 ? (
                    <div className="flex items-center justify-between text-text-muted-3">
                      <span>Bonus</span>
                      <span className="font-bold text-text-green-bright">
                        {formatCurrency(currentUser?.currency ?? "NGN", bonusAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted-3">Potential Win</span>
                    <span className="inline-flex items-center gap-2 text-lg font-black text-white">
                      {previewLoading ? <RefreshCw size={16} className="animate-spin text-[var(--pitch)]" /> : null}
                      {potentialWinDisplay}
                    </span>
                  </div>
                </div>

                <div className={`mt-3 grid gap-2 ${mode === "sim" ? "grid-cols-1" : "grid-cols-[0.9fr_1.1fr]"}`}>
                  {mode === "real" ? (
                    <button
                      type="button"
                      disabled={isLoading || isBootstrapping || !totalSelections || totalStake <= 0 || isBookBetSubmitting}
                      onClick={() => void handleBookBet()}
                      className="rounded-md bg-[#EBECE9] px-4 py-3  text-white disabled:opacity-45"
                    >
                      {isBookBetSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          Booking
                        </span>
                      ) : (
                        "Book Bet"
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={placeBetDisabled}
                    onClick={() => {
                      if (mode === "sim") {
                        void placeBet();
                        return;
                      }
                      setPendingAction("bet");
                    }}
                    className="rounded-md bg-primary-action px-4 py-3 text-text-on-orange disabled:opacity-45"
                  >
                    {isPlaceBetSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Processing
                      </span>
                    ) : mode === "sim" ? (
                      "Place Simulate Bet"
                    ) : (
                      "Place Bet"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AppDialog
        open={pendingAction !== null && mode === "real"}
        title="Place this bet?"
        description={`Confirm payment of ${formatCurrency(currentUser?.currency ?? "NGN", totalStake)}.`}
        confirmLabel="Confirm"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirmLabel={dialog?.kind === "error" ? dialog?.cancelLabel ?? "Okay" : dialog?.confirmLabel ?? "Confirm"}
        cancelLabel={dialog?.cancelLabel ?? "Cancel"}
        onCancel={dialog?.kind === "error" ? undefined : closeDialog}
        onConfirm={dialog?.kind === "error" ? closeDialog : () => void confirmDialog()}
        variant={dialog?.kind === "error" ? "error" : "default"}
      />

      {betPlaced ? (
        <div className="fixed inset-0 z-modal flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/78" />
          <div className="relative w-full max-w-96 rounded-3xl border border-white/8 bg-[#F4F5F3] p-5 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E2F5E9] text-text-green-bright">
              <Check size={26} />
            </div>
            <p className="mt-4 text-center text-base font-black uppercase tracking-[0.18em] text-text-green-bright">
              {successEyebrow}
            </p>
            <h3 className="mt-1 text-center text-4xl font-black text-white">{successTitle}</h3>

            <div className="my-5 space-y-3">
              <div className="flex items-center justify-between text-md text-text-muted-3">
                <span>Total stake</span>
                <span className="font-bold text-white">
                  {formatCurrency(currentUser?.currency ?? "NGN", betPlaced.totalStake)}
                </span>
              </div>
              <div className="flex items-center justify-between text-md text-text-muted-3">
                <span>Potential win</span>
                <span className="font-bold text-white">
                  {formatCurrency(currentUser?.currency ?? "NGN", betPlaced.potentialWin)}
                </span>
              </div>
              <div className="flex items-start justify-between text-md text-text-muted-3">
                <span>{successCodeLabel}</span>
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-black text-[var(--pitch)]">
                    {betPlaced.bookingCode || "--"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyBookingCode()}
                      className="inline-flex items-center justify-center gap-2 text-base font-semibold text-white"
                    >
                      <Copy size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareSuccess()}
                      className="inline-flex items-center justify-center gap-2 text-base font-semibold text-white"
                    >
                      <Share2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {canUseCustomCodes ? (
              <>
                <hr />

                <div className="my-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">Assign Custom Code</p>
                    </div>
                    <button
                      type="button"
                      disabled={customCodeLoading}
                      onClick={() => void openCustomCodeFlow()}
                      className="rounded-full border border-[var(--pitch)]/35 bg-[#EEEEEB] px-4 py-2 text-base font-black text-[var(--pitch)] disabled:opacity-45"
                    >
                      {customCodeLoading ? "Checking..." : "Create"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  dismissSuccess();
                }}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-lg font-semibold text-white"
              >
                {successIsBookBet ? "Keep Slip" : "Rebet"}
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissSuccess();
                  clearSlip();
                  setIsCodeHubExpanded(false);
                  toggleOpen();
                }}
                className="rounded-lg bg-primary-action px-4 py-3 text-lg font-black text-text-on-orange"
              >
                {successPrimaryActionLabel}
              </button>
            </div>

            {customCodeModal ? (
              <div className="absolute inset-0 z-10 flex items-end rounded-3xl bg-black/80 p-3">
                <div className="w-full rounded-3xl border border-white/8 bg-[#F2F2F0] p-4 shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-text-muted-4">
                        {customCodeModal === "assigned" ? "Custom code ready" : "Custom code"}
                      </p>
                      <h4 className="mt-1 text-4xl font-black text-white">
                        {customCodeModal === "select"
                          ? "Select a custom code"
                          : customCodeModal === "create"
                            ? "Create custom code"
                            : "Custom code assigned"}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={closeCustomCodeModal}
                      className="rounded-full border border-white/10 p-2 text-white/70 disabled:opacity-45"
                      disabled={customCodeLoading || isAssigningCustomCode || isCreatingCustomCode}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {customCodeModal === "select" ? (
                    <>
                      {customCodeLoadError ? (
                        <div className="mt-2 rounded-xl border border-[#E6E7E3] bg-[#FDECEC] px-4 py-3 text-base leading-5 text-accent-pink">
                          {customCodeLoadError}
                        </div>
                      ) : null}
                      <p className="mt-2 text-md leading-6 text-[#66695B]">
                        Select a saved code or create one.
                      </p>
                      <div className="mt-4 space-y-2">
                        {customCodes.map((code) => (
                          <button
                            key={code}
                            type="button"
                            disabled={isAssigningCustomCode}
                            onClick={() => void assignExistingCustomCode(code)}
                            className="flex w-full items-center justify-between rounded-lg border border-white/8 bg-[#F0F0EE] px-4 py-3 text-left text-white disabled:opacity-45"
                          >
                            <span className="font-semibold">{code}</span>
                            <span className="text-base font-black text-[var(--pitch)]">
                              {isAssigningCustomCode && assignedCustomCode === code ? "Linking..." : "Use"}
                            </span>
                          </button>
                        ))}
                      </div>
                      {customCodeError ? (
                        <p className="mt-3 text-base font-medium text-text-error-light">{customCodeError}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCodeError("");
                          setCustomCodeModal("create");
                        }}
                        className="mt-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-lg font-semibold text-white"
                      >
                        Make a new code
                      </button>
                    </>
                  ) : null}

                  {customCodeModal === "create" ? (
                    <>
                      {customCodeLoadError ? (
                        <div className="mt-2 rounded-xl border border-[#E6E7E3] bg-[#FDECEC] px-4 py-3 text-base leading-5 text-accent-pink">
                          {customCodeLoadError}
                        </div>
                      ) : null}
                      <p className="mt-2 text-md leading-6 text-[#66695B]">
                        Enter a short custom code for this ticket.
                      </p>
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          value={customSuffix}
                          maxLength={25}
                          autoComplete="off"
                          inputMode="text"
                          onChange={(event) =>
                            setCustomSuffix(
                              event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25),
                            )
                          }
                          className="h-12 flex-1 rounded-2xl border border-white/10 bg-[#F6F6F4] px-4 text-lg font-semibold text-white outline-none placeholder:text-[#999B8C]"
                          placeholder="CustomCode"
                        />
                        <button
                          type="button"
                          disabled={isCreatingCustomCode}
                          onClick={() => void submitCustomCode()}
                          className="rounded-lg bg-primary-action px-4 text-md font-black text-text-on-orange disabled:opacity-45"
                        >
                          {isCreatingCustomCode ? "Creating..." : "Attach"}
                        </button>
                      </div>
                      {customCodeError ? (
                        <p className="mt-3 text-base font-medium text-text-error-light">{customCodeError}</p>
                      ) : null}
                    </>
                  ) : null}

                  {customCodeModal === "assigned" ? (
                    <>
                      <div className="mt-4 rounded-xl border border-white/8 bg-[#F0F0EE] p-4">
                        <div className="flex items-center justify-between text-base font-semibold text-text-muted-3">
                          <span>Linked ticket</span>
                          <span className="text-white">{betPlaced.bookingCode}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-md text-text-muted-3">Use</span>
                          <span className="text-4xl font-black text-[var(--pitch)]">{assignedCustomCode}</span>
                        </div>
                        <p className="mt-3 text-base leading-5 text-[#66695B]">
                          This custom code opens the same selections as the booking code.
                        </p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCopyCustomCode()}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-lg font-semibold text-white"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleShareCustomCode()}
                          className="rounded-lg bg-primary-action px-4 py-3 text-lg font-black text-text-on-orange"
                        >
                          Share
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
