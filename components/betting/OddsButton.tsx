"use client";

import type { CSSProperties, MouseEvent } from "react";
import { MdLock } from "react-icons/md";
import { useOddsChangePulse } from "@/lib/hooks/useOddsChangePulse";
import { cn } from "@/lib/utils";
import { formatHomeMarketName, formatHomeSportName } from "@/lib/utils/home-fixtures";
import { getOutcomeDisplayLabel } from "@/lib/utils/market-display-resolver";
import type { RawFixture, RawMarket, RawOutcome } from "@/lib/utils/normalize";
import { createID } from "@/lib/utils/coupon";
import { useCouponStore } from "@/store/couponStore";
import type { Market, SportEvent } from "@/types";

type OddsButtonLayout = "centered" | "split";

type EventOddsButtonProps = {
  event: SportEvent;
  market: Market;
  selectionKey: string;
  label?: string;
  layout?: OddsButtonLayout;
  fluid?: boolean;
  width?: number;
  showLockWhenDisabled?: boolean;
};

type FixtureOddsButtonProps = {
  mode: "fixture";
  fixture: RawFixture & { tournamentName?: string };
  market: RawMarket;
  outcome: RawOutcome;
  selectionType: "prematch" | "live";
  label?: string;
  layout?: OddsButtonLayout;
  fluid?: boolean;
  width?: number;
  showLockWhenDisabled?: boolean;
};

type OddsButtonProps = EventOddsButtonProps | FixtureOddsButtonProps;

function buildButtonStyles(isSelected: boolean, width?: number) {
  return {
    ...(width ? { width, minWidth: width, maxWidth: width } : null),
    "--odds-flash-base-bg": isSelected ? "var(--lime)" : "var(--paper)",
    "--odds-flash-base-text": isSelected ? "var(--ink)" : "var(--pitch)",
    "--app-odd-label-color": isSelected ? "var(--ink)" : "var(--ink-3)",
    "--app-odd-value-color": isSelected ? "var(--ink)" : "var(--pitch)",
  } as CSSProperties;
}

function renderDisabledContent(
  layout: OddsButtonLayout,
  label: string,
  showLockWhenDisabled: boolean,
) {
  if (showLockWhenDisabled && layout === "split") {
    return (
      <span className="app-odd-btn-split-content">
        <span className="app-odd-btn-label text-left text-base font-semibold">{label}</span>
        <MdLock size={16} className="shrink-0 text-white/45" aria-label="Locked" />
      </span>
    );
  }

  if (showLockWhenDisabled) {
    return (
      <span className="app-odd-btn-value text-lg font-bold">
        <MdLock size={18} className="text-white/55" />
      </span>
    );
  }

  const valueNode = "--";

  if (layout === "split") {
    return (
      <span className="app-odd-btn-split-content">
        <span className="app-odd-btn-label text-left text-base font-semibold">
          {label}
        </span>
        <span className="app-odd-btn-value shrink-0 text-xl font-bold">{valueNode}</span>
      </span>
    );
  }

  return <span className="app-odd-btn-value text-lg font-bold">{valueNode}</span>;
}

/**
 * Prices this extreme mean the outcome is effectively decided (e.g. a late two-goal
 * lead). Bookmakers lock these rather than show a cap price, so we do too.
 */
const DECIDED_LONG = 100;
const DECIDED_SHORT = 1.01;

function isDecidedPrice(odds: number) {
  return Number.isFinite(odds) && (odds >= DECIDED_LONG || odds <= DECIDED_SHORT);
}

export function OddsButton(props: OddsButtonProps) {
  const { selections, addSelection, removeSelection } = useCouponStore();
  const layout = props.layout ?? "centered";
  const fluid = props.fluid ?? false;
  const width = props.width;
  const isFixtureMode = "mode" in props;
  const showLockWhenDisabled = props.showLockWhenDisabled ?? isFixtureMode;

  let selectionId = "";
  let displayLabel = "";
  let marketName = "";
  let odds = Number.NaN;
  let isUnavailable = false;
  let type: "prematch" | "live";
  let eventName = "";
  let matchId = "";
  let sportId = "";
  let sportName = "";
  let homeTeam = "";
  let awayTeam = "";
  let startTime = "";
  let tournamentName = "";
  let marketId = "";
  let outcomeId = "";
  let outcomeName = "";
  let specifier = "";
  let selectionKeySpecifier = "";
  let marketStatus = "";
  let fixturePayload: Record<string, unknown>;
  let marketPayload: Record<string, unknown>;
  let outcomePayload: Record<string, unknown>;

  if (isFixtureMode) {
    const { fixture, market, outcome, label, selectionType } = props;
    matchId = String(fixture.matchID ?? "");
    marketId = String(market.marketID ?? market.id ?? "");
    outcomeId = String(outcome.outcomeID ?? "");
    const outcomeSpecifier = String(outcome.specifier ?? outcome.specifiers ?? "").trim();
    const marketSpecifier = String(market.specifier ?? market.specifiers ?? "").trim();
    specifier = outcomeSpecifier || marketSpecifier;
    selectionKeySpecifier = outcomeSpecifier || marketSpecifier;
    selectionId = createID(matchId, marketId, outcomeId, selectionKeySpecifier);
    odds = Number(outcome.odds);
    marketName = formatHomeMarketName(String(market.marketName ?? market.name ?? ""));
    marketStatus = String((market as { statusName?: string }).statusName ?? "")
      .trim()
      .toLowerCase();
    outcomeName = String(
      outcome.outcomeName ?? outcome.displayName ?? label ?? outcome.outcomeID ?? "",
    ).trim();
    displayLabel = String(label ?? getOutcomeDisplayLabel(market, outcome)).trim();
    isUnavailable =
      ["suspended", "deactivated", "settled", "handedover"].includes(marketStatus) ||
      outcome.active === 0 ||
      outcome.active === false ||
      !Number.isFinite(odds) ||
      odds <= 1;
    type = selectionType;
    eventName = `${fixture.homeTeam ?? ""} vs ${fixture.awayTeam ?? ""}`;
    sportId = String(fixture.sportID ?? "");
    sportName = formatHomeSportName(String(fixture.sportName ?? "Football"));
    homeTeam = String(fixture.homeTeam ?? "");
    awayTeam = String(fixture.awayTeam ?? "");
    startTime = String(fixture.date ?? "");
    tournamentName = String(fixture.tournamentName ?? fixture.tournament ?? "");
    fixturePayload = { ...fixture };
    marketPayload = { ...market, marketID: marketId, marketName, specifier };
    outcomePayload = { ...outcome, outcomeID: outcomeId, outcomeName, odds, specifier };
  } else {
    const { event, market, selectionKey, label } = props;
    matchId = String(event.id);
    marketId = String(market.id);
    outcomeId = String(selectionKey);
    selectionKeySpecifier = String(selectionKey);
    selectionId = createID(matchId, marketId, outcomeId, selectionKeySpecifier);
    odds = Number(market.odds[selectionKey]);
    marketName = market.name;
    outcomeName = String(label ?? selectionKey).trim();
    displayLabel = outcomeName;
    isUnavailable = Boolean(market.suspended) || !Number.isFinite(odds) || odds <= 1;
    type = event.status === "live" ? "live" : "prematch";
    eventName = `${event.homeTeam.name} vs ${event.awayTeam.name}`;
    sportId = String(event.sport.id);
    sportName = event.sport.name;
    homeTeam = event.homeTeam.name;
    awayTeam = event.awayTeam.name;
    startTime = event.startTime;
    tournamentName = event.league.name;
    fixturePayload = {
      awayTeam: event.awayTeam.name,
      gameID: matchId,
      homeTeam: event.homeTeam.name,
      matchID: matchId,
      sportID: event.sport.id,
      sportName: event.sport.name,
      tournament: event.league.name,
      markets: event.fixtureMarkets ?? [],
      derived_market_ids: event.fixtureMarkets
        ?.map((fixtureMarket) => fixtureMarket.marketID)
        .filter((id) => [1601, 60180].includes(Number(id))),
    };
    marketPayload = { ...market, marketID: marketId, marketName: market.name };
    outcomePayload = {
      active: market.suspended ? 0 : 1,
      odds,
      outcomeID: selectionKey,
      outcomeName: label ?? selectionKey,
      specifier: selectionKeySpecifier,
    };
  }

  const selectedSelection = selections.find((selection) => {
    if (selection.currentSelectionId === selectionId) return true;

    const selectionSpecifier = String(
      selection.selectionKeySpecifier ??
        selection.specifier ??
        selection.market?.specifier ??
        selection.market?.specifiers ??
        selection.outcome?.specifier ??
        selection.outcome?.specifiers ??
        "",
    ).trim();
    const sameSelectionFields =
      String(selection.matchId) === matchId &&
      String(selection.marketId) === marketId &&
      String(selection.outcomeId) === outcomeId &&
      selectionSpecifier === selectionKeySpecifier;

    if (sameSelectionFields) return true;

    return (
      selection.selectionId === selectionId &&
      (!selection.currentSelectionId || selection.currentSelectionId === selection.selectionId)
    );
  });
  const isSelected = Boolean(selectedSelection);
  const pulseResetKey = [
    isFixtureMode ? "fixture" : "event",
    matchId,
    marketId,
    specifier,
    selectionKeySpecifier,
    outcomeId,
  ].join(":");
  const oddsChange = useOddsChangePulse(odds, {
    enabled: !isUnavailable,
    resetKey: pulseResetKey,
  });
  const buttonStyles = buildButtonStyles(isSelected, width);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (isUnavailable) return;

    if (isSelected) {
      removeSelection(selectedSelection?.selectionId || selectionId);
      return;
    }

    addSelection({
      id: selectionId,
      selectionId,
      currentSelectionId: selectionId,
      matchId,
      eventId: matchId,
      eventName,
      homeTeam,
      awayTeam,
      startTime,
      sportId,
      sportName,
      tournamentName,
      marketId,
      marketName,
      displayName: displayLabel,
      outcomeId,
      outcomeName,
      selectionKeySpecifier,
      specifier,
      odds,
      probability: Number((props as { outcome?: { probability?: number } }).outcome?.probability ?? 0),
      producerId:
        (fixturePayload.producerID as string | number | undefined) ??
        (outcomePayload.producerID as string | number | undefined),
      type,
      fixture: fixturePayload,
      market: marketPayload,
      outcome: outcomePayload,
    });
  };

  const isDecided = !isUnavailable && isDecidedPrice(odds);

  if (isUnavailable || (isDecided && !isSelected)) {
    return (
      <div
        style={buttonStyles}
        className={cn(
          "app-odd-btn app-odd-btn-disabled",
          isDecided && "app-odd-btn-locked",
          fluid && "app-odd-btn-fluid",
          layout === "split" ? "app-odd-btn-split" : "app-odd-btn-centered",
        )}
      >
        {renderDisabledContent(layout, displayLabel, isDecided || showLockWhenDisabled)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={buttonStyles}
      className={cn(
        "app-odd-btn",
        fluid && "app-odd-btn-fluid",
        layout === "split" ? "app-odd-btn-split" : "app-odd-btn-centered",
        isSelected && "selected",
        oddsChange === "up" && "odds-change-up",
        oddsChange === "down" && "odds-change-down",
      )}
    >
      {layout === "split" ? (
        <span className="app-odd-btn-split-content">
          <span className="app-odd-btn-label text-left text-base font-semibold">
            {displayLabel}
          </span>
          <span className="app-odd-btn-value shrink-0 text-xl font-bold">
            {odds.toFixed(2)}
          </span>
        </span>
      ) : (
        <span className="app-odd-btn-value text-lg font-bold">{odds.toFixed(2)}</span>
      )}
    </button>
  );
}
