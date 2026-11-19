"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InformationCircleIcon } from "hugeicons-react";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { HighlightsSpecifierSelector } from "@/components/home/HighlightsSpecifierSelector";
import { PrematchFixture } from "@/components/prematch/PrematchFixture";
import { useHighlightsV2, useSportsMenu } from "@/lib/query/hooks/useSports";
import { getFeatureMarketIdForMode } from "@/lib/helpers/early-win";
import { cn } from "@/lib/utils";
import {
  filterHomeMarketsBySport,
  getAvailableHomeDerivedModes,
  getCanonicalHomeMarkets,
  formatOutcomeName,
  formatHomeMarketName,
  formatHomeSpecifierType,
  getHomeDerivedMarketConfig,
  getSharedMarketSpecifierOptions,
  resolveHomeDisplayMarket,
  sanitizeHomeMarkets,
  sortHomeOutcomesById,
  type HomeDerivedMode,
} from "@/lib/utils/home-fixtures";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";
import { getMarketDisplayName } from "@/lib/utils/market-display-resolver";

type HighlightsResponse = {
  data?: {
    fixtures?: RawFixture[];
    markets?: RawMarket[];
  };
};

type FixtureModeOption = {
  key: Exclude<HomeDerivedMode, "base">;
  label: string;
};

function PillBadge({ label }: { label: string }) {
  return <span className="fc-sf-box-icon">{label}</span>;
}

export function HighlightsContainer() {
  const { data: sports = [] } = useSportsMenu();
  const [preferredSportId, setPreferredSportId] = useState("1");
  const [preferredMarketId, setPreferredMarketId] = useState<string | null>(null);
  const [preferredMode, setPreferredMode] = useState<HomeDerivedMode>("base");
  const [preferredSpecifier, setPreferredSpecifier] = useState("");
  const activeSportId =
    sports.some((sport) => sport.id === preferredSportId) ? preferredSportId : (sports[0]?.id ?? "1");
  const activeSportSlug =
    sports.find((sport) => sport.id === activeSportId)?.slug ?? "football";
  const derivedFeatureMarketId =
    preferredMode === "base" ? "" : getFeatureMarketIdForMode(preferredMode);
  const { data: baseData, isLoading: isBaseLoading } = useHighlightsV2({
    sportId: activeSportId,
    page: 1,
    perPage: 15,
    upcoming: 1,
    orderType: "priority|desc",
  });
  const { data: derivedData, isLoading: isDerivedLoading } = useHighlightsV2({
    sportId: preferredMode === "base" ? undefined : activeSportId,
    page: 1,
    perPage: 15,
    upcoming: 1,
    orderType: "priority|desc",
    featureMarketId: derivedFeatureMarketId,
  });

  const baseResponse = baseData as HighlightsResponse | undefined;
  const derivedResponse = derivedData as HighlightsResponse | undefined;
  const baseMarkets = useMemo(
    () =>
      getCanonicalHomeMarkets(
        filterHomeMarketsBySport(
          sanitizeHomeMarkets(baseResponse?.data?.markets ?? []),
          activeSportId,
        ),
      ),
    [activeSportId, baseResponse?.data?.markets],
  );
  const derivedMarkets = useMemo(
    () =>
      filterHomeMarketsBySport(
        sanitizeHomeMarkets(derivedResponse?.data?.markets ?? [], {
          includeDerived: true,
        }),
        activeSportId,
      ),
    [activeSportId, derivedResponse?.data?.markets],
  );
  const activeBaseMarketId =
    baseMarkets.some((market) => String(market.marketID ?? market.id ?? "") === preferredMarketId)
      ? preferredMarketId
      : (String(baseMarkets[0]?.marketID ?? baseMarkets[0]?.id ?? "") || null);
  const activeBaseMarket =
    baseMarkets.find((market) => String(market.marketID ?? market.id ?? "") === activeBaseMarketId) ??
    baseMarkets[0] ??
    null;
  const activeBaseMarketNumber = Number(activeBaseMarket?.marketID ?? activeBaseMarket?.id ?? 0);
  const derivedConfig =
    activeSportId === "1" ? getHomeDerivedMarketConfig(activeBaseMarketNumber) : null;
  const availableDerivedModes = useMemo(
    () => getAvailableHomeDerivedModes(activeBaseMarketNumber, derivedMarkets),
    [activeBaseMarketNumber, derivedMarkets],
  );

  const modeOptions: FixtureModeOption[] = availableDerivedModes.map((mode) => ({
    key: mode.key,
    label: mode.label,
  }));
  const activeMode =
    preferredMode === "base" || modeOptions.some((option) => option.key === preferredMode)
      ? preferredMode
      : "base";
  const displayFixtures =
    activeMode === "base"
      ? baseResponse?.data?.fixtures ?? []
      : derivedResponse?.data?.fixtures ?? [];
  const displayMarket = resolveHomeDisplayMarket(activeBaseMarket, activeMode, derivedMarkets);
  const headerMarket = displayMarket ?? activeBaseMarket;
  const headerOutcomes = sortHomeOutcomesById(headerMarket?.outcomes ?? []);
  const headerHasSpecifier =
    Boolean(String(headerMarket?.specifier ?? "").trim()) &&
    !String(headerMarket?.specifier ?? "").trim().toLowerCase().startsWith("xup=");
  const headerSpecifierLabel = headerHasSpecifier
    ? formatHomeSpecifierType(String(headerMarket?.specifier ?? ""))
    : "";
  const sharedSpecifierOptions = headerHasSpecifier
    ? getSharedMarketSpecifierOptions(displayFixtures, headerMarket)
    : [];
  const activeSharedSpecifier = sharedSpecifierOptions.some(
    (option) => option.specifier === preferredSpecifier,
  )
    ? preferredSpecifier
    : (sharedSpecifierOptions[0]?.specifier ?? "");
  const isLoading = activeMode === "base" ? isBaseLoading : isDerivedLoading;
  const orderedModeOptions = [...modeOptions].sort((left, right) => {
    const priority: Record<FixtureModeOption["key"], number> = {
      "1up": 1,
      "2up": 2,
      "earlygoal": 3,
    };

    return (priority[left.key] ?? 10) - (priority[right.key] ?? 10);
  });

  return (
    <section className="section">
      <div className="fc-upcoming-header px-0">
        <div className="fc-uh-title">Coming up</div>
        <div className="fc-uh-divider">|</div>
        <div className="fc-uh-sports">
          {sports.map((sport) => (
            <button
              key={sport.id}
              type="button"
              className={cn("fc-uh-sport", sport.id === activeSportId && "active")}
              onClick={() => {
                setPreferredMode("base");
                setPreferredSportId(sport.id);
              }}
            >
              {sport.name}
            </button>
          ))}
        </div>
      </div>

      <div className="fc-market-pills">
        {baseMarkets.map((market, index) => {
          const marketId = String(market.marketID ?? market.id ?? "");
          return (
            <button
              key={`${marketId}-${market.specifier ?? ""}-${market.sportID ?? ""}-${index}`}
              type="button"
              className={cn("fc-mp-pill capitalize", marketId === activeBaseMarketId && "active")}
              onClick={() => {
                setPreferredMode("base");
                setPreferredMarketId(marketId);
              }}
            >
              {formatHomeMarketName(getMarketDisplayName(market))}
            </button>
          );
        })}
      </div>

      {derivedConfig ? (
        <div className="fc-sub-filters">
          {headerHasSpecifier ? (
            <HighlightsSpecifierSelector
              activeSpecifier={activeSharedSpecifier}
              label={headerSpecifierLabel}
              onSelect={setPreferredSpecifier}
              options={sharedSpecifierOptions}
            />
          ) : null}
          {headerHasSpecifier ? <div className="fc-sf-divider">|</div> : null}
          <div className="fc-sf-track">
            <div className="fc-sf-modes">
              <button
                type="button"
                className={cn("fc-sf-pill", activeMode === "base" && "active")}
                onClick={() => setPreferredMode("base")}
              >
                <PillBadge label={derivedConfig.baseBadge} />
                <span>Base</span>
              </button>
              {orderedModeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={cn("fc-sf-pill", activeMode === option.key && "active")}
                  disabled={activeMode !== "base" && isDerivedLoading}
                  onClick={() => setPreferredMode(activeMode === option.key ? "base" : option.key)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="home-market-header-shell">
        <div className="lm-body home-market-header-body">
          <div className="lm-teams home-market-header-spacer">
            <div className="lm-team-row">
              <span className="lm-team-name">Spacer</span>
            </div>
          </div>
          <div className="lm-odds lm-fluid-odds home-market-header-odds">
            {headerHasSpecifier ? (
              <span className="lm-specifier-title fixture-specifier-width">
                {headerSpecifierLabel}
              </span>
            ) : null}
            {(headerOutcomes.length
              ? headerOutcomes
              : [{ displayName: "1" }, { displayName: "X" }, { displayName: "2" }]).map(
              (outcome, index) => (
                <span
                  key={`${outcome.outcomeID ?? outcome.outcomeName ?? index}`}
                  className="home-market-header-column"
                >
                  {formatOutcomeName(outcome, headerMarket)}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="pre-matches-container px-0">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <FixtureSkeleton key={index} />
          ))
        ) : displayFixtures.length ? (
          displayFixtures.map((fixture) => (
            <PrematchFixture
              key={`${String(fixture.matchID ?? `${fixture.homeTeam}-${fixture.awayTeam}`)}-${activeSharedSpecifier}`}
              fixture={fixture}
              market={displayMarket}
              selectedSpecifier={activeSharedSpecifier}
            />
          ))
        ) : (
          <div className="section-empty-state">
            No prematch fixtures are available right now.
          </div>
        )}
      </div>

      <Link href={`/sports/${activeSportSlug}`} className="fc-full-schedule">
        Full Schedule
      </Link>
    </section>
  );
}
