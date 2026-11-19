"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdArrowBack, MdArrowDropDown, MdUnfoldLess, MdUnfoldMore } from "react-icons/md";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { LiveFixture } from "@/components/live/LiveFixture";
import { SportIconBadge } from "@/components/ui/SportIconBadge";
import { useLiveCounter, useLiveHighlights } from "@/lib/query/hooks/useSports";
import { cn } from "@/lib/utils";
import { MdHome } from "react-icons/md";
import {
  deriveLiveSports,
  filterHomeMarketsBySport,
  formatHomeMarketName,
  formatHomeSpecifierType,
  formatOutcomeName,
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

type LiveLeagueGroup = {
  id: string;
  categoryName: string;
  tournamentName: string;
  fixtures: RawFixture[];
};

const EMPTY_FIXTURES: RawFixture[] = [];
const EMPTY_MARKETS: RawMarket[] = [];

function groupFixturesByLeague(fixtures: RawFixture[]) {
  const groups = new Map<string, LiveLeagueGroup>();

  fixtures.forEach((fixture) => {
    const categoryName = String(fixture.categoryName ?? "").trim();
    const tournamentName = String(fixture.tournament ?? "Other").trim() || "Other";
    const categoryId = String(fixture.categoryID ?? categoryName);
    const tournamentId = String(fixture.tournamentID ?? tournamentName);
    const key = `${categoryId}:${tournamentId}:${tournamentName}`;
    const existing = groups.get(key);

    if (existing) {
      existing.fixtures.push(fixture);
      return;
    }

    groups.set(key, {
      id: key,
      categoryName,
      tournamentName,
      fixtures: [fixture],
    });
  });

  return [...groups.values()];
}

export function LivePageView({ initialSportId = "1" }: { initialSportId?: string }) {
  const router = useRouter();
  const { data, isLoading } = useLiveHighlights();
  const { data: liveCounterData } = useLiveCounter();
  const [preferredSportId, setPreferredSportId] = useState(initialSportId);
  const [preferredMarketId, setPreferredMarketId] = useState<string | null>(null);
  const [collapsedLeagueViews, setCollapsedLeagueViews] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const response = data as LiveHighlightsResponse | undefined;
  const counterResponse = liveCounterData as LiveCounterResponse | undefined;
  const fixtures = response?.data?.fixtures ?? EMPTY_FIXTURES;
  const hasAnyLiveFixtures = fixtures.length > 0;
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
  const allMarkets = getCanonicalHomeMarkets(
    filterHomeMarketsBySport(
      sanitizeHomeMarkets(response?.data?.markets ?? EMPTY_MARKETS),
      activeSportId,
    ),
  );
  const activeSportFixtures = fixtures.filter(
    (fixture) => String(fixture.sportID ?? "") === activeSportId,
  );

  const sportMarkets = allMarkets;

  const activeMarketId =
    sportMarkets.some((market) => String(market.marketID ?? market.id ?? "") === preferredMarketId)
      ? preferredMarketId
      : (String(sportMarkets[0]?.marketID ?? sportMarkets[0]?.id ?? "") || null);

  const activeMarket =
    sportMarkets.find((market) => String(market.marketID ?? market.id ?? "") === activeMarketId) ??
    sportMarkets[0] ??
    null;

  const collapseScopeKey = `${activeSportId}:${activeMarketId ?? "default"}`;
  const leagueGroups = groupFixturesByLeague(activeSportFixtures);
  const collapsedLeagues = {
    ...Object.fromEntries(leagueGroups.map((group) => [group.id, true])),
    ...(collapsedLeagueViews[collapseScopeKey] ?? {}),
  };
  const areAllLeaguesCollapsed =
    leagueGroups.length > 0 && leagueGroups.every((group) => collapsedLeagues[group.id]);

  const headerOutcomes = sortHomeOutcomesById(activeMarket?.outcomes ?? []);
  const headerHasSpecifier = Boolean(String(activeMarket?.specifier ?? "").trim());
  const headerSpecifierLabel = headerHasSpecifier
    ? formatHomeSpecifierType(String(activeMarket?.specifier ?? ""))
    : "";
  return (
    <>
      <div className="sticky top-0 z-40 -mx-3 bg-[#F6F6F5] px-3 pt-3 shadow-[0_10px_24px_rgba(0, 0, 0, 0.126)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.back()} aria-label="Back">
              <MdArrowBack size={24} color="currentColor" />
            </button>
            <span className="text-4xl font-semibold text-white">Live</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Home">
              <MdHome size={22} color="currentColor" />
            </Link>
          </div>
        </div>

        {hasAnyLiveFixtures ? (
          <>
            <div className="flex overflow-x-auto border-b border-white/5 no-scrollbar py-3">
              {sports.map((sport) => {
                const isActive = sport.id === activeSportId;
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => {
                      setPreferredSportId(sport.id);
                      setPreferredMarketId(null);
                    }}
                    className={cn("live-page-sport-tab", isActive && "active")}
                  >
                    <span className="absolute right-3 top-0 rounded-lg bg-[var(--bg-neutral)] px-[6px] py-[2px] text-xs font-extrabold text-[var(--primary-orange)]">
                      {sport.matchCount ?? fixtureCountsBySport.get(sport.id) ?? 0}
                    </span>
                    <SportIconBadge sport={sport.name} size="lg" active={isActive} />
                    <span className={cn("whitespace-nowrap text-md", isActive ? "text-white" : "text-[var(--text-dim)]")}>
                      {sport.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {sportMarkets.length ? (
              <div className="flex gap-2 overflow-x-auto border-b border-white/5 py-3 no-scrollbar">
                {sportMarkets.map((market, index) => {
                  const marketId = String(market.marketID ?? market.id ?? "");
                  const isActive = marketId === activeMarketId;
                  return (
                    <button
                      key={`${marketId}:${market.specifier ?? ""}:${market.sportID ?? ""}:${index}`}
                      type="button"
                      onClick={() => setPreferredMarketId(marketId)}
                      className={cn("live-page-market-pill", isActive && "active")}
                    >
                      {formatHomeMarketName(getMarketDisplayName(market))}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-xl bg-[var(--bg-card)]">
                <FixtureSkeleton variant="live" />
              </div>
            ))}
          </div>
        ) : !activeSportFixtures.length ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/[0.05] text-3xl font-black text-[var(--text-dim)]">
              0
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">No live fixtures</h2>
            <p className="mt-2 max-w-[240px] text-md leading-6 text-[var(--text-dim)]">
              There are no live events available right now. Check back shortly.
            </p>
          </div>
        ) : (
          <section className="mb-3">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setCollapsedLeagueViews((current) => ({
                    ...current,
                    [collapseScopeKey]: Object.fromEntries(
                      leagueGroups.map((group) => [group.id, !areAllLeaguesCollapsed]),
                    ),
                  }))
                }
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--primary-orange)] transition-colors hover:bg-white/[0.06]"
                aria-label={areAllLeaguesCollapsed ? "Expand all tournaments" : "Collapse all tournaments"}
              >
                {areAllLeaguesCollapsed ? <MdUnfoldMore size={18} /> : <MdUnfoldLess size={18} />}
                {areAllLeaguesCollapsed ? "Expand all" : "Collapse all"}
              </button>
            </div>
            {leagueGroups.map((group, groupIndex) => (
              <div
                key={group.id}
                className={cn(
                  "overflow-hidden rounded-xl bg-[var(--bg-card)]",
                  groupIndex !== leagueGroups.length - 1 && "mb-3",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedLeagueViews((current) => ({
                      ...current,
                      [collapseScopeKey]: {
                        ...(current[collapseScopeKey] ?? {}),
                        [group.id]: !collapsedLeagues[group.id],
                      },
                    }))
                  }
                  className={cn(
                    "live-page-league-toggle",
                    collapsedLeagues[group.id] && "is-collapsed",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <MdArrowDropDown
                      size={20}
                      color="var(--primary-orange)"
                      className={cn(
                        "live-page-caret",
                        collapsedLeagues[group.id] && "is-collapsed",
                      )}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-left text-lg font-bold text-white"
                      title={[group.categoryName, group.tournamentName].filter(Boolean).join(" - ") || "Other"}
                    >
                      {[group.categoryName, group.tournamentName].filter(Boolean).join(" - ") || "Other"}
                    </span>
                  </div>
                  <span className="ml-3 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-neutral)] px-2 text-sm font-extrabold text-[var(--primary-orange)]">
                    {group.fixtures.length}
                  </span>
                </button>

                {collapsedLeagues[group.id] ? null : (
                  <div className="px-2">
                    <div className="live-page-market-header">
                      <div className="live-page-market-columns">
                        {headerHasSpecifier ? (
                          <span className="fixture-specifier-width inline-block text-center">
                            {headerSpecifierLabel}
                          </span>
                        ) : null}
                        {(headerOutcomes.length
                          ? headerOutcomes
                          : [{ displayName: "1" }, { displayName: "X" }, { displayName: "2" }]).map(
                          (outcome, index) => (
                            <span
                              key={`${outcome.outcomeID ?? outcome.outcomeName ?? index}`}
                              className="inline-block text-center"
                            >
                              {formatOutcomeName(outcome, activeMarket)}
                            </span>
                          ),
                        )}
                      </div>
                    </div>

                    {group.fixtures.map((fixture, fixtureIndex) => (
                      <div
                        key={String(fixture.matchID ?? `${group.id}-${fixtureIndex}`)}
                        className={cn(
                          fixtureIndex !== group.fixtures.length - 1 && "live-page-fixture-divider",
                        )}
                      >
                        <LiveFixture fixture={fixture} market={activeMarket} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
