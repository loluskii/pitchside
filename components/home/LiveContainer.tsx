"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { LiveFixture } from "@/components/live/LiveFixture";
import { useLiveCounter, useLiveHighlights } from "@/lib/query/hooks/useSports";
import { cn } from "@/lib/utils";
import {
  deriveLiveSports,
  filterHomeMarketsBySport,
  formatOutcomeName,
  formatHomeMarketName,
  formatHomeSpecifierType,
  getCanonicalHomeMarkets,
  normalizeSportsMenu,
  sanitizeHomeMarkets,
  sortHomeOutcomesById,
} from "@/lib/utils/home-fixtures";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";
import { getMarketDisplayName } from "@/lib/utils/market-display-resolver";

type LiveHighlightsResponse = {
  data?: {
    fixtures?: RawFixture[];
    markets?: RawMarket[];
  };
};

const EMPTY_FIXTURES: RawFixture[] = [];
const EMPTY_MARKETS: RawMarket[] = [];

type LiveCounterResponse = {
  data?: {
    total?: number;
    sports?: Array<{
      sport_id?: number | string;
      sport_name?: string;
      games?: number | string;
    }>;
  };
};

export function LiveContainer() {
  const { data, isLoading } = useLiveHighlights();
  const { data: liveCounterData } = useLiveCounter();
  const [preferredSportId, setPreferredSportId] = useState("1");
  const [preferredMarketId, setPreferredMarketId] = useState<string | null>(null);

  const response = data as LiveHighlightsResponse | undefined;
  const counterResponse = liveCounterData as LiveCounterResponse | undefined;
  const fixtures = response?.data?.fixtures ?? EMPTY_FIXTURES;
  const hasLiveFixtures = fixtures.length > 0;
  const counterSports = useMemo(
    () => normalizeSportsMenu(counterResponse?.data?.sports ?? []),
    [counterResponse?.data?.sports],
  );
  const fixtureCountsBySport = useMemo(() => {
    const map = new Map<string, number>();
    fixtures.forEach((fixture) => {
      const sportId = String(fixture.sportID ?? "");
      if (!sportId) return;
      map.set(sportId, (map.get(sportId) ?? 0) + 1);
    });
    return map;
  }, [fixtures]);
  const counterCountsBySport = useMemo(
    () =>
      new Map(
        counterSports.map((sport) => [sport.id, Number(sport.matchCount ?? 0)]),
      ),
    [counterSports],
  );
  const sports = useMemo(
    () =>
      deriveLiveSports(fixtures).map((sport) => ({
        ...sport,
        matchCount:
          counterCountsBySport.get(sport.id) ?? fixtureCountsBySport.get(sport.id) ?? 0,
      })),
    [counterCountsBySport, fixtureCountsBySport, fixtures],
  );
  const activeSportId =
    sports.some((sport) => sport.id === preferredSportId) ? preferredSportId : (sports[0]?.id ?? "1");
  const activeSportFixtures = fixtures.filter((fixture) => String(fixture.sportID ?? "") === activeSportId);
  const sportMarkets = getCanonicalHomeMarkets(
    filterHomeMarketsBySport(
      sanitizeHomeMarkets(response?.data?.markets ?? EMPTY_MARKETS),
      activeSportId,
    ),
  );
  const activeMarketId =
    sportMarkets.some((market) => String(market.marketID ?? market.id ?? "") === preferredMarketId)
      ? preferredMarketId
      : (String(sportMarkets[0]?.marketID ?? sportMarkets[0]?.id ?? "") || null);
  const activeMarket =
    sportMarkets.find((market) => String(market.marketID ?? market.id ?? "") === activeMarketId) ??
    sportMarkets[0] ??
    null;
  const headerOutcomes = sortHomeOutcomesById(activeMarket?.outcomes ?? []);
  const headerHasSpecifier = Boolean(String(activeMarket?.specifier ?? "").trim());
  const headerSpecifierLabel = headerHasSpecifier
    ? formatHomeSpecifierType(String(activeMarket?.specifier ?? ""))
    : "";
  return (
    <section className="section-container">
      <div className="fc-live-header">
        <div className="fc-uh-title">
          Live <div className="live-indicator-dot" />
        </div>
        {sports.length ? <div className="fc-uh-divider">|</div> : null}
        {sports.length ? (
          <div className="fc-uh-sports">
            {sports.map((sport) => (
              <button
                key={sport.id}
                type="button"
                className={cn("fc-uh-sport", sport.id === activeSportId && "active")}
                onClick={() => setPreferredSportId(sport.id)}
              >
                {sport.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="live-matches-container">
          {Array.from({ length: 3 }).map((_, index) => (
            <FixtureSkeleton key={index} variant="live" />
          ))}
        </div>
      ) : !hasLiveFixtures ? (
        <div className="rounded-b-2xl px-4 py-5">
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-extrabold text-white">
              No matches in play
            </h3>
            <p className="mx-auto max-w-[30ch] text-md leading-5 text-[var(--text-dim)]">
              Live markets will show here when fixtures go in-play.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="fc-market-pills px-2">
            {sportMarkets.map((market, index) => {
              const marketId = String(market.marketID ?? market.id ?? "");
              return (
                <button
                  key={`${marketId}-${market.specifier ?? ""}-${market.sportID ?? ""}-${index}`}
                  type="button"
                  className={cn("fc-mp-pill capitalize", marketId === activeMarketId && "active")}
                  onClick={() => setPreferredMarketId(marketId)}
                >
                  {formatHomeMarketName(getMarketDisplayName(market))}
                </button>
              );
            })}
          </div>

          <div className="home-market-header-shell px-2">
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
                      {formatOutcomeName(outcome, activeMarket)}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="live-matches-container">
            {activeSportFixtures.length ? (
              activeSportFixtures.slice(0, 10).map((fixture) => (
                <LiveFixture
                  key={String(fixture.matchID ?? `${fixture.homeTeam}-${fixture.awayTeam}`)}
                  fixture={fixture}
                  market={activeMarket}
                />
              ))
            ) : (
              <div className="section-empty-state">
                No fixtures are live for this sport right now.
              </div>
            )}
          </div>

          {activeSportFixtures.length > 10 ? (
            <Link
              href={`/live?sportId=${activeSportId}`}
              className="see-all-link see-all-link-light"
            >
              All Live Events ({counterCountsBySport.get(activeSportId) ?? activeSportFixtures.length})
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
