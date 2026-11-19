"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { FixtureMarketCards } from "@/components/fixtures/FixtureMarketCards";
import {
  type FixtureDetailMarket,
  useFixtureDetailMarkets,
} from "@/lib/hooks/useFixtureDetailMarkets";
import { useCustomBetMarkets } from "@/lib/query/hooks/useSports";
import { sportsApi } from "@/lib/api/sports";
import type { RawFixture } from "@/lib/utils/normalize";
import { cn } from "@/lib/utils";
import { useCouponStore, type CouponCustomBetLeg, type CouponSelection } from "@/store/couponStore";

type CustomBetOutcome = {
  active?: number | boolean;
  marketID: number;
  odds: number;
  outcomeID: string;
  outcomeName: string;
  specifier?: string;
};

type CustomBetRecommendation = {
  odds: number;
  probability?: number;
  selections: Array<{
    event_id: number;
    market_id: number;
    market_name: string;
    outcome_id: string;
    outcome_name: string;
    single_odds: number;
    specifier?: string;
  }>;
};

type CustomBetMarketsResponse = {
  data?: {
    outcomes?: CustomBetOutcome[];
    prebuilt?: {
      recommendations?: CustomBetRecommendation[];
    };
  };
};

type CustomBetPriceResponse = {
  data?: {
    odds?: number;
    probability?: number;
  };
};

type CustomBetCompatibilityResponse = {
  data?: {
    incompatible_markets?: Array<{
      market_id: number;
      outcome_ids?: string[];
      specifier?: string;
    }>;
  };
};

type CustomBetPanelProps = {
  active: boolean;
  detail: RawFixture & {
    gameID?: string | number;
    producerID?: string | number;
    sportID?: string | number;
    tournamentName?: string;
  };
};

function legKey(leg: Pick<CouponCustomBetLeg, "marketId" | "matchId" | "outcomeId" | "specifier">) {
  return `${leg.matchId}:${leg.marketId}:${leg.outcomeId}:${leg.specifier || ""}`;
}

function selectionIdForCustomBet(matchId: string | number, legs: CouponCustomBetLeg[]) {
  return `custombet:${matchId}:${legs.map(legKey).sort().join("|")}`;
}

function getMarketKey(marketId: string | number, specifier = "") {
  return `${String(marketId)}|${String(specifier).trim()}`;
}

export function CustomBetPanel({ active, detail }: CustomBetPanelProps) {
  const matchId = String(detail.matchID ?? detail.gameID ?? "");
  const addSelection = useCouponStore((state) => state.addSelection);
  const isBetslipOpen = useCouponStore((state) => state.isOpen);
  const toggleOpen = useCouponStore((state) => state.toggleOpen);
  const [mode, setMode] = useState<"create" | "quick">("create");
  const [selectedLegs, setSelectedLegs] = useState<CouponCustomBetLeg[]>([]);
  const [incompatibleMarkets, setIncompatibleMarkets] = useState<
    NonNullable<CustomBetCompatibilityResponse["data"]>["incompatible_markets"]
  >([]);
  const [pricedOdds, setPricedOdds] = useState(0);
  const [pricedProbability, setPricedProbability] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [isPricing, setIsPricing] = useState(false);
  const [collapsedState, setCollapsedState] = useState<Record<string, boolean>>({});
  const { data, error, isLoading } = useCustomBetMarkets(matchId, active);
  const payload = data as CustomBetMarketsResponse | undefined;
  const outcomes = payload?.data?.outcomes ?? [];
  const quickPicks = payload?.data?.prebuilt?.recommendations ?? [];
  const fixtureMarkets = [
    ...((detail.market ?? []) as FixtureDetailMarket[]),
    ...((detail.markets ?? []) as FixtureDetailMarket[]),
  ];

  const customBetMarkets = useMemo(() => {
    const marketsByKey = new Map<string, FixtureDetailMarket>();
    const marketsById = new Map<string, FixtureDetailMarket>();
    const exactOrder = new Map<string, number>();
    const idOrder = new Map<string, number>();

    fixtureMarkets.forEach((market, index) => {
      const marketId = String(market.marketID ?? market.id ?? "");
      if (!marketId) return;
      const specifier = String(market.specifier ?? market.specifiers ?? "").trim();
      const key = getMarketKey(marketId, specifier);
      marketsByKey.set(key, market);
      if (!exactOrder.has(key)) {
        exactOrder.set(key, index);
      }
      if (!marketsById.has(marketId)) {
        marketsById.set(marketId, market);
      }
      if (!idOrder.has(marketId)) {
        idOrder.set(marketId, index);
      }
    });

    const groups = new Map<string, FixtureDetailMarket>();

    outcomes.forEach((outcome) => {
      const marketId = String(outcome.marketID ?? "");
      if (!marketId) return;
      const specifier = String(outcome.specifier || "").trim();
      const meta = marketsByKey.get(getMarketKey(marketId, specifier)) ?? marketsById.get(marketId);
      const matchingOutcome = meta?.outcomes?.find(
        (item) =>
          String(item.outcomeID ?? "") === String(outcome.outcomeID) &&
          String(item.specifier ?? item.specifiers ?? specifier).trim() === specifier,
      );
      const key = getMarketKey(marketId, specifier);
      const group =
        groups.get(key) ??
        ({
          ...meta,
          marketID: marketId,
          marketName:
            String(meta?.marketName ?? meta?.name ?? "").trim() || `Market ${marketId}`,
          specifier,
          outcomes: [],
        } as FixtureDetailMarket);

      group.outcomes.push({
        ...matchingOutcome,
        ...outcome,
        active: outcome.active,
        displayName:
          matchingOutcome?.displayName ??
          matchingOutcome?.outcomeName ??
          outcome.outcomeName,
        marketID: marketId,
        odds: outcome.odds,
        outcomeID: outcome.outcomeID,
        outcomeName: outcome.outcomeName,
        specifier,
      });
      groups.set(key, group);
    });

    return [...groups.values()].sort((left, right) => {
      const leftId = String(left.marketID ?? "");
      const rightId = String(right.marketID ?? "");
      const leftKey = getMarketKey(leftId, String(left.specifier ?? ""));
      const rightKey = getMarketKey(rightId, String(right.specifier ?? ""));
      const leftOrder =
        exactOrder.get(leftKey) ?? idOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        exactOrder.get(rightKey) ?? idOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return Number(leftId) - Number(rightId);
    });
  }, [fixtureMarkets, outcomes]);

  const {
    displayGroupedMarkets,
    getActiveSection,
    hasSectionTabs,
    setActiveSection,
  } = useFixtureDetailMarkets({
    eventMarkets: customBetMarkets,
    marketGroups: [],
    fixtureDetail: detail,
  });

  const priceLegs = async (legs: CouponCustomBetLeg[]) => {
    if (!legs.length) {
      setSelectedLegs([]);
      setIncompatibleMarkets([]);
      setPricedOdds(0);
      setPricedProbability(undefined);
      setMessage("");
      return;
    }

    setIsPricing(true);
    setMessage("");

    try {
      const compatibility = await sportsApi.checkCustomBetCompatibility(
        legs.map((leg) => ({
          market_id: leg.marketId,
          match_id: leg.matchId,
          outcome_id: leg.outcomeId,
          specifier: leg.specifier || "",
        })),
      ) as CustomBetCompatibilityResponse;
      const price = await sportsApi.priceCustomBet({
        legs: legs.map((leg) => ({
          event_id: leg.matchId,
          market_id: leg.marketId,
          outcome_id: leg.outcomeId,
          specifier: leg.specifier || "",
        })),
      }) as CustomBetPriceResponse;

      setSelectedLegs(legs);
      setIncompatibleMarkets(compatibility.data?.incompatible_markets ?? []);
      setPricedOdds(Number(price.data?.odds ?? 0));
      setPricedProbability(price.data?.probability);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to price this CustomBet.");
    } finally {
      setIsPricing(false);
    }
  };

  const addCustomBetToSlip = (
    legs: CouponCustomBetLeg[],
    odds: number,
    probability?: number,
  ) => {
    if (legs.length < 2 || odds <= 1) return;
    const selectionId = selectionIdForCustomBet(matchId, legs);
    const selection: CouponSelection = {
      currentSelectionId: selectionId,
      customBetLegs: legs,
      customBetProbability: probability,
      displayName: "BetBuilder",
      eventId: matchId,
      eventName: `${String(detail.homeTeam ?? "Home")} vs ${String(detail.awayTeam ?? "Away")}`,
      homeTeam: String(detail.homeTeam ?? ""),
      awayTeam: String(detail.awayTeam ?? ""),
      id: selectionId,
      marketId: legs[0].marketId,
      marketName: "BetBuilder",
      matchId,
      odds,
      outcomeId: legs[0].outcomeId,
      outcomeName: `${legs.length} CustomBet picks`,
      producerId: detail.producerID,
      selectionId,
      specifier: legs[0].specifier || "",
      sportId: detail.sportID,
      sportName: String(detail.sportName ?? "Football"),
      startTime: String(detail.date ?? ""),
      tournamentName: String(detail.tournamentName ?? detail.tournament ?? ""),
      type: "prematch",
    };
    addSelection(selection);
    if (!isBetslipOpen) {
      toggleOpen();
    }
  };

  const toggleOutcome = (
    market: FixtureDetailMarket,
    outcome: FixtureDetailMarket["outcomes"][number],
  ) => {
    const marketId = Number(outcome.marketID ?? market.marketID);
    const specifier = String(outcome.specifier ?? market.specifier ?? "");
    const leg: CouponCustomBetLeg = {
      marketId,
      matchId: Number(matchId),
      odds: Number(outcome.odds),
      outcomeId: String(outcome.outcomeID),
      outcomeName: String(outcome.outcomeName),
      specifier,
      marketName: String(market.marketName ?? market.name ?? `Market ${marketId}`),
    };
    const exists = selectedLegs.some((selected) => legKey(selected) === legKey(leg));
    void priceLegs(exists ? selectedLegs.filter((selected) => legKey(selected) !== legKey(leg)) : [...selectedLegs, leg]);
  };

  const addQuickPick = (recommendation: CustomBetRecommendation) => {
    const legs = recommendation.selections.map((selection) => ({
      marketId: Number(selection.market_id),
      marketName: String(selection.market_name),
      matchId: Number(selection.event_id),
      odds: Number(selection.single_odds),
      outcomeId: String(selection.outcome_id),
      outcomeName: String(selection.outcome_name),
      specifier: String(selection.specifier || ""),
    }));
    addCustomBetToSlip(legs, Number(recommendation.odds), recommendation.probability);
  };

  const isIncompatible = (
    market: FixtureDetailMarket,
    outcome: FixtureDetailMarket["outcomes"][number],
  ) =>
    incompatibleMarkets?.some(
      (item) =>
        Number(item.market_id) === Number(outcome.marketID ?? market.marketID) &&
        String(item.specifier || "") === String(outcome.specifier ?? market.specifier ?? "") &&
        (item.outcome_ids ?? []).map(String).includes(String(outcome.outcomeID)),
    );

  if (isLoading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-[var(--bg-card)] text-text-muted-4">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading BetBuilder
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-5 text-sm font-semibold text-red-100">
        {error instanceof Error ? error.message : "Unable to load CustomBet markets."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 border-y border-white/6 bg-[#F6F6F5] px-4 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-md font-extrabold",
              mode === "create"
                ? "bg-[var(--lime)] text-black"
                : "bg-[var(--bg-card)] text-white",
            )}
          >
            Create your own
          </button>
          <button
            type="button"
            onClick={() => setMode("quick")}
            className={cn(
              "flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-md font-extrabold",
              mode === "quick"
                ? "bg-[var(--lime)] text-black"
                : "bg-[var(--bg-card)] text-white",
            )}
          >
            Quick picks
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
          {message}
        </div>
      ) : null}

      {mode === "quick" ? (
        <div className="space-y-3">
          {quickPicks.length ? (
            quickPicks.map((recommendation, index) => (
              <div
                key={`${index}-${recommendation.odds}`}
                className="overflow-hidden rounded-xl bg-[var(--bg-card)]"
              >
                <div className="flex w-full items-center justify-between border-b border-white/[0.05] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronDown size={16} className="shrink-0 text-[var(--primary-orange)]" />
                    <span className="text-md font-bold leading-tight text-white">
                      Quick Pick {index + 1}
                    </span>
                    <span className="shrink-0 rounded-lg bg-[var(--lime)] px-2 py-0.5 text-xs font-extrabold text-black">
                      {recommendation.selections.length} picks
                    </span>
                  </div>
                  <span className="shrink-0 text-xl font-black text-[var(--text-orange)]">
                    {Number(recommendation.odds).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-2 px-4 py-3">
                  {recommendation.selections.map((selection) => (
                    <div
                      key={`${selection.market_id}-${selection.outcome_id}-${selection.specifier || ""}`}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-white">
                          {selection.outcome_name}
                        </span>
                        <span className="block truncate text-text-muted-4">
                          {selection.market_name}
                        </span>
                      </span>
                      <span className="shrink-0 font-black text-white">
                        {Number(selection.single_odds).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addQuickPick(recommendation)}
                  className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-lg bg-primary-action py-2.5 text-base font-black text-text-on-orange"
                >
                  <Plus size={16} />
                  Add to betslip
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-[var(--bg-card)] px-4 py-8 text-center text-sm font-semibold text-text-muted-4">
              No quick picks are available for this match.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {selectedLegs.length ? (
            <div className="sticky top-0 z-10 rounded-xl border border-white/8 bg-[var(--bg-card)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-text-muted-4">{selectedLegs.length} selected</span>
                <span className="text-2xl font-black text-[var(--pitch)]">
                  {isPricing ? "..." : pricedOdds > 0 ? pricedOdds.toFixed(2) : "--"}
                </span>
              </div>
              <button
                type="button"
                disabled={isPricing || selectedLegs.length < 2 || pricedOdds <= 1}
                onClick={() => addCustomBetToSlip(selectedLegs, pricedOdds, pricedProbability)}
                className="mt-3 w-full rounded-lg bg-primary-action py-2.5 text-base font-black text-text-on-orange disabled:opacity-45"
              >
                {selectedLegs.length < 2 ? "Select at least 2 picks" : "Add CustomBet to betslip"}
              </button>
            </div>
          ) : null}

          <FixtureMarketCards
            collapsedMarkets={collapsedState}
            collapsedStateKey={`custombet:${matchId}`}
            detail={detail}
            displayGroupedMarkets={displayGroupedMarkets}
            getActiveSection={getActiveSection}
            hasSectionTabs={hasSectionTabs}
            onToggleMarket={(accordionKey, isCollapsed) =>
              setCollapsedState((current) => ({
                ...current,
                [accordionKey]: !isCollapsed,
              }))
            }
            renderCell={({ defaultLabel, layout, market, outcome }) => {
              const selected = selectedLegs.some(
                (leg) =>
                  leg.marketId === Number(outcome.marketID ?? market.marketID) &&
                  leg.outcomeId === String(outcome.outcomeID) &&
                  String(leg.specifier || "") ===
                    String(outcome.specifier ?? market.specifier ?? ""),
              );
              const disabled =
                !selected &&
                (outcome.active === 0 || outcome.active === false || isIncompatible(market, outcome));

              return (
                <button
                  type="button"
                  disabled={disabled || isPricing}
                  onClick={() => toggleOutcome(market, outcome)}
                  style={{
                    "--odds-flash-base-bg": selected
                      ? "var(--primary-orange)"
                      : "rgba(255,255,255,0.05)",
                    "--odds-flash-base-text": selected ? "#000000" : "var(--text-orange)",
                    "--app-odd-label-color": selected ? "#000000" : "#ffffff",
                    "--app-odd-value-color": selected ? "#000000" : "var(--text-orange)",
                  } as CSSProperties}
                  className={cn(
                    "app-odd-btn app-odd-btn-fluid",
                    layout === "split" ? "app-odd-btn-split" : "app-odd-btn-centered",
                    selected && "selected",
                    disabled && "app-odd-btn-disabled opacity-45",
                  )}
                >
                  {layout === "split" ? (
                    <span className="app-odd-btn-split-content">
                      <span className="app-odd-btn-label text-left text-base font-semibold">
                        {defaultLabel}
                      </span>
                      <span className="app-odd-btn-value shrink-0 text-xl font-bold">
                        {Number(outcome.odds).toFixed(2)}
                      </span>
                    </span>
                  ) : (
                    <span className="app-odd-btn-value text-lg font-bold">
                      {Number(outcome.odds).toFixed(2)}
                    </span>
                  )}
                </button>
              );
            }}
            selectionType="prematch"
            setActiveSection={setActiveSection}
          />
        </div>
      )}
    </div>
  );
}
