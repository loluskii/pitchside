"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MdArrowDropDown } from "react-icons/md";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { HighlightsSpecifierSelector } from "@/components/home/HighlightsSpecifierSelector";
import { PrematchFixture } from "@/components/prematch/PrematchFixture";
import { SportIconBadge } from "@/components/ui/SportIconBadge";
import { sportsApi } from "@/lib/api/sports";
import { getFeatureMarketIdForMode } from "@/lib/helpers/early-win";
import {
  useCategories,
  useSportsMenu,
  useTournaments,
} from "@/lib/query/hooks/useSports";
import { cn } from "@/lib/utils";
import { getDateRange } from "@/lib/utils/date";
import {
  filterHomeMarketsBySport,
  getAvailableHomeDerivedModes,
  getCanonicalHomeMarkets,
  formatHomeMarketName,
  formatHomeSpecifierType,
  formatOutcomeName,
  getHomeDerivedMarketConfig,
  getSharedMarketSpecifierOptions,
  resolveHomeDisplayMarket,
  sanitizeHomeMarkets,
  sortHomeOutcomesById,
  type HomeDerivedMode,
} from "@/lib/utils/home-fixtures";
import type { PeriodFilter } from "@/lib/api/config";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";
import { getSportDisplayName } from "@/lib/utils/sports";

type SearchParamValue = string | string[] | undefined;

type Props = {
  params: Promise<{ sport: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type HighlightsResponse = {
  data?: {
    fixtures?: RawFixture[];
    markets?: RawMarket[];
  };
};

type CategoryItem = {
  category_id?: number | string;
  country_name?: string;
  games?: number | string;
};

type TournamentItem = {
  tournament_id?: number | string;
  name?: string;
  games?: number | string;
};

type SelectedTournament = {
  id: string;
  categoryId?: string;
};

type FixtureGroup = {
  key: string;
  label: string;
  subtitle: string;
  fixtures: RawFixture[];
};

type FixtureModeOption = {
  key: Exclude<HomeDerivedMode, "base">;
  label: string;
};

type FilterPanel = "period" | "league" | "sort" | null;

const PERIOD_OPTIONS = [
  { label: "All dates", value: "" },
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "Today & Tomorrow", value: "today_tomorrow" },
  { label: "This Week", value: "week" },
] as const;

const SORT_OPTIONS = [
  { label: "By league", value: "priority" },
  { label: "By kick-off", value: "start_time" },
] as const;

function readQueryParam(value: SearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function readIdList(value: SearchParamValue): string[] {
  return readQueryParam(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: T[] }).data;
  }

  return [];
}

function asCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function dedupeFixtures(fixtures: RawFixture[]): RawFixture[] {
  const seen = new Set<string>();

  return fixtures.filter((fixture, index) => {
    const matchId = String(fixture.matchID ?? "").trim();
    const key = matchId || `${fixture.homeTeam ?? ""}-${fixture.awayTeam ?? ""}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFixtureFilterPayload(period: string, startDate: string, endDate: string, hours: number) {
  if (hours > 0) {
    return {
      hours,
      upcoming: 1 as const,
    };
  }

  if (period === "today") return { today: 1 as const };
  if (period === "tomorrow") return { tomorrow: 1 as const };

  if (period === "custom" && startDate && endDate) {
    return {
      start: startDate,
      end: endDate,
      upcoming: 1 as const,
    };
  }

  const rangedPeriod = getDateRange(period);
  if (rangedPeriod && typeof rangedPeriod !== "string") {
    return {
      start: rangedPeriod.startDate,
      end: rangedPeriod.endDate,
      upcoming: 1 as const,
    };
  }

  return { upcoming: 1 as const };
}

function getPeriodFilter(period: string, startDate: string, endDate: string): PeriodFilter | undefined {
  if (period === "custom" && startDate && endDate) {
    return { startDate, endDate };
  }

  const rangedPeriod = getDateRange(period);
  if (rangedPeriod && typeof rangedPeriod !== "string") {
    return rangedPeriod;
  }

  return undefined;
}

function mergeHighlightsResponses(
  responses: HighlightsResponse[],
  options: { includeDerived?: boolean } = {},
) {
  const fixtures = dedupeFixtures(
    responses.flatMap((response) => response.data?.fixtures ?? []),
  );
  const markets = sanitizeHomeMarkets(
    responses.flatMap((response) => response.data?.markets ?? []),
    options,
  );

  return { fixtures, markets };
}

function parseFixtureStartTime(fixture: RawFixture) {
  const timestamp = Date.parse(String(fixture.date ?? ""));
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function sortFixtures(fixtures: RawFixture[], sortBy: string) {
  if (sortBy !== "start_time") return fixtures;

  return [...fixtures].sort((left, right) => parseFixtureStartTime(left) - parseFixtureStartTime(right));
}

function getPeriodLabel(period: string, startDate: string, endDate: string, hours: number) {
  if (hours > 0) return `Next ${hours} Hours`;
  if (period === "today") return "Today";
  if (period === "tomorrow") return "Tomorrow";
  if (period === "today_tomorrow") return "Today & Tomorrow";
  if (period === "week") return "This Week";
  if (period === "custom" && startDate && endDate) {
    return "Custom Date";
  }
  return "All dates";
}

function getSortLabel(sortBy: string) {
  return sortBy === "start_time" ? "By kick-off" : "By league";
}

function groupFixturesByTournament(fixtures: RawFixture[]) {
  const groups = new Map<string, FixtureGroup>();

  fixtures.forEach((fixture) => {
    const label = String(fixture.tournament ?? fixture.categoryName ?? "Other").trim() || "Other";
    const subtitle = String(fixture.categoryName ?? "").trim();
    const key = String(fixture.tournamentID ?? fixture.tournament ?? fixture.categoryID ?? label);
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.fixtures.push(fixture);
      return;
    }

    groups.set(key, {
      key,
      label,
      subtitle,
      fixtures: [fixture],
    });
  });

  return [...groups.values()];
}

async function fetchSportHighlights({
  categoryIds,
  endDate,
  featureMarketId = "",
  hours,
  period,
  sportId,
  startDate,
  tournamentIds,
}: {
  categoryIds: string[];
  endDate: string;
  featureMarketId?: number | string;
  hours: number;
  period: string;
  sportId: string;
  startDate: string;
  tournamentIds: string[];
}) {
  const basePayload = {
    sportId,
    page: 1,
    perPage: 60,
    orderType: "priority|asc",
    featureMarketId,
    ...buildFixtureFilterPayload(period, startDate, endDate, hours),
  };

  if (tournamentIds.length) {
    const responses = (await Promise.all(
      tournamentIds.map((tournamentId) =>
        sportsApi.getHighlightsV2({
          ...basePayload,
          tournamentId,
        }),
      ),
    )) as HighlightsResponse[];

    return mergeHighlightsResponses(responses, {
      includeDerived: Boolean(featureMarketId),
    });
  }

  if (categoryIds.length) {
    const responses = (await Promise.all(
      categoryIds.map((categoryId) =>
        sportsApi.getHighlightsV2({
          ...basePayload,
          categoryId,
        }),
      ),
    )) as HighlightsResponse[];

    return mergeHighlightsResponses(responses, {
      includeDerived: Boolean(featureMarketId),
    });
  }

  const response = (await sportsApi.getHighlightsV2(basePayload)) as HighlightsResponse;
  return mergeHighlightsResponses([response], {
    includeDerived: Boolean(featureMarketId),
  });
}

function PillBadge({ label }: { label: string }) {
  return <span className="fc-sf-box-icon">{label}</span>;
}

export default function SportPage({ params, searchParams }: Props) {
  const router = useRouter();
  const { sport } = use(params);
  const resolvedSearchParams = use(searchParams);
  const { data: sports = [] } = useSportsMenu();

  const [openFilterPanel, setOpenFilterPanel] = useState<FilterPanel>(null);
  const [preferredCategoryId, setPreferredCategoryId] = useState("");
  const [preferredMarketId, setPreferredMarketId] = useState<string | null>(null);
  const [preferredMode, setPreferredMode] = useState<HomeDerivedMode>("base");
  const [preferredSpecifier, setPreferredSpecifier] = useState("");
  const [draftTournaments, setDraftTournaments] = useState<SelectedTournament[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const sportSlug = String(sport ?? "").trim().toLowerCase();
  const sportMeta = sports.find((item) => item.slug === sportSlug) ?? null;
  const sportId = sportMeta?.id ?? "";

  const period = readQueryParam(resolvedSearchParams.period);
  const startDate = readQueryParam(resolvedSearchParams.startDate);
  const endDate = readQueryParam(resolvedSearchParams.endDate);
  const hours = Math.max(0, Number(readQueryParam(resolvedSearchParams.hours) || 0) || 0);
  const sortBy = readQueryParam(resolvedSearchParams.sort) === "start_time" ? "start_time" : "priority";
  const tournamentIds = useMemo(
    () => readIdList(resolvedSearchParams.tournamentIds),
    [resolvedSearchParams.tournamentIds],
  );
  const categoryIds = useMemo(
    () => readIdList(resolvedSearchParams.categoryIds),
    [resolvedSearchParams.categoryIds],
  );

  const periodFilter = useMemo(
    () => getPeriodFilter(period, startDate, endDate),
    [endDate, period, startDate],
  );

  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories(sportId, periodFilter);
  const categories = useMemo(
    () =>
      extractItems<CategoryItem>(categoriesData).filter(
        (item) => String(item.category_id ?? "").trim() && asCount(item.games) > 0,
      ),
    [categoriesData],
  );
  const categoryIdsFromQuery = categoryIds.filter((value) =>
    categories.some((category) => String(category.category_id ?? "") === value),
  );
  const activeCategoryId =
    preferredCategoryId && categories.some((category) => String(category.category_id ?? "") === preferredCategoryId)
      ? preferredCategoryId
      : (categoryIdsFromQuery[0] ?? String(categories[0]?.category_id ?? ""));

  const { data: tournamentsData, isLoading: isTournamentsLoading } = useTournaments(
    sportId,
    activeCategoryId,
    periodFilter ?? null,
  );
  const tournaments = useMemo(
    () =>
      extractItems<TournamentItem>(tournamentsData).filter(
        (item) => String(item.tournament_id ?? "").trim() && asCount(item.games) > 0,
      ),
    [tournamentsData],
  );

  const derivedFeatureMarketId =
    preferredMode === "base" ? "" : getFeatureMarketIdForMode(preferredMode);

  const baseFixturesQuery = useQuery({
    queryKey: [
      "sports-route-base-fixtures",
      sportId,
      hours,
      period,
      startDate,
      endDate,
      tournamentIds.join(","),
      categoryIds.join(","),
    ],
    enabled: Boolean(sportId),
    queryFn: () =>
      fetchSportHighlights({
        sportId,
        hours,
        period,
        startDate,
        endDate,
        tournamentIds,
        categoryIds,
      }),
  });

  const derivedFixturesQuery = useQuery({
    queryKey: [
      "sports-route-derived-fixtures",
      sportId,
      derivedFeatureMarketId,
      hours,
      period,
      startDate,
      endDate,
      tournamentIds.join(","),
      categoryIds.join(","),
    ],
    enabled: Boolean(sportId) && preferredMode !== "base" && Boolean(derivedFeatureMarketId),
    queryFn: () =>
      fetchSportHighlights({
        sportId,
        hours,
        period,
        startDate,
        endDate,
        tournamentIds,
        categoryIds,
        featureMarketId: derivedFeatureMarketId,
      }),
  });

  const baseMarkets = useMemo(
    () =>
      getCanonicalHomeMarkets(
        filterHomeMarketsBySport(baseFixturesQuery.data?.markets ?? [], sportId),
      ),
    [baseFixturesQuery.data?.markets, sportId],
  );
  const derivedMarkets = useMemo(
    () => filterHomeMarketsBySport(derivedFixturesQuery.data?.markets ?? [], sportId),
    [derivedFixturesQuery.data?.markets, sportId],
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
    sportId === "1" ? getHomeDerivedMarketConfig(activeBaseMarketNumber) : null;
  const availableDerivedModes = useMemo(
    () => getAvailableHomeDerivedModes(activeBaseMarketNumber, derivedMarkets),
    [activeBaseMarketNumber, derivedMarkets],
  );
  const activeMode =
    preferredMode === "base" || availableDerivedModes.some((option) => option.key === preferredMode)
      ? preferredMode
      : "base";
  const displayFixtures = useMemo(
    () =>
      sortFixtures(
        activeMode === "base"
          ? (baseFixturesQuery.data?.fixtures ?? [])
          : (derivedFixturesQuery.data?.fixtures ?? []),
        sortBy,
      ),
    [activeMode, baseFixturesQuery.data?.fixtures, derivedFixturesQuery.data?.fixtures, sortBy],
  );
  const groupedFixtures = useMemo(
    () => groupFixturesByTournament(displayFixtures),
    [displayFixtures],
  );
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
  const orderedModeOptions = [...availableDerivedModes]
    .map((mode): FixtureModeOption => ({
      key: mode.key,
      label: mode.label,
    }))
    .sort((left, right) => {
      const priority: Record<FixtureModeOption["key"], number> = {
        "1up": 1,
        "2up": 2,
        "earlygoal": 3,
      };

      return (priority[left.key] ?? 10) - (priority[right.key] ?? 10);
    });
  const isFixturesLoading = activeMode === "base"
    ? baseFixturesQuery.isLoading
    : derivedFixturesQuery.isLoading;
  const isFixturesError = activeMode === "base"
    ? baseFixturesQuery.isError
    : derivedFixturesQuery.isError;

  const draftSelectionIds = draftTournaments.map((item) => item.id);
  const reachedSelectionCap = draftSelectionIds.length >= 10;
  const isPeriodOpen = openFilterPanel === "period";
  const isLeagueOpen = openFilterPanel === "league";
  const isSortOpen = openFilterPanel === "sort";

  function pushRoute(next: {
    categoryIds?: string[];
    endDate?: string;
    hours?: number;
    period?: string;
    sortBy?: string;
    startDate?: string;
    tournamentIds?: string[];
  }, nextSportSlug = sportSlug) {
    const nextPeriod = next.period ?? period;
    const nextSort = next.sortBy ?? sortBy;
    const nextHours =
      next.hours ??
      (next.period !== undefined || next.startDate !== undefined || next.endDate !== undefined
        ? 0
        : hours);
    const nextTournamentIds = next.tournamentIds ?? tournamentIds;
    const nextCategoryIds = next.categoryIds ?? categoryIds;
    const nextStartDate =
      next.startDate ?? (nextPeriod === "custom" ? startDate : "");
    const nextEndDate =
      next.endDate ?? (nextPeriod === "custom" ? endDate : "");
    const params = new URLSearchParams();

    if (nextPeriod) {
      params.set("period", nextPeriod);
    }
    if (nextHours > 0) {
      params.set("hours", String(nextHours));
    }
    if (nextPeriod === "custom" && nextStartDate && nextEndDate) {
      params.set("startDate", nextStartDate);
      params.set("endDate", nextEndDate);
    }
    if (nextTournamentIds.length) {
      params.set("tournamentIds", nextTournamentIds.join(","));
    }
    if (nextCategoryIds.length) {
      params.set("categoryIds", nextCategoryIds.join(","));
    }
    if (nextSort === "start_time") {
      params.set("sort", "start_time");
    }

    const query = params.toString();
    router.push(query ? `/sports/${nextSportSlug}?${query}` : `/sports/${nextSportSlug}`);
  }

  function handlePeriodChange(nextPeriod: string) {
    pushRoute({
      period: nextPeriod,
      hours: 0,
      startDate: "",
      endDate: "",
    });
    setOpenFilterPanel(null);
  }

  function handleSortChange(nextSort: string) {
    pushRoute({
      sortBy: nextSort,
    });
    setOpenFilterPanel(null);
  }

  function toggleDraftTournament(tournamentId: string) {
    setDraftTournaments((current) => {
      const exists = current.some((item) => item.id === tournamentId);

      if (exists) {
        return current.filter((item) => item.id !== tournamentId);
      }

      if (current.length >= 10) {
        return current;
      }

      return [...current, { id: tournamentId, categoryId: activeCategoryId || undefined }];
    });
  }

  function applyLeagueFilters() {
    const nextTournamentIds = draftTournaments.map((item) => item.id);
    const nextCategoryIds = [...new Set(
      draftTournaments.map((item) => item.categoryId).filter(Boolean),
    )] as string[];

    pushRoute({
      tournamentIds: nextTournamentIds,
      categoryIds: nextCategoryIds,
    });
    setOpenFilterPanel(null);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleFilterPanel(panel: Exclude<FilterPanel, null>) {
    setOpenFilterPanel((current) => current === panel ? null : panel);
  }

  const shouldGroupFixtures = sortBy !== "start_time" && groupedFixtures.length > 0;

  return (
    <div>
      {sportMeta ? (
        <div className="mb-3">
          <div className="overflow-x-auto no-scrollbar mb-3">
            <div className="flex gap-3">
              {sports.map((sportItem) => (
                <button
                  key={sportItem.id}
                  type="button"
                  className={cn(
                    "flex shrink-0 min-w-16 flex-col items-center gap-2 text-center transition-colors",
                    sportItem.id === sportId
                      ? "text-active-tab"
                      : "text-white/70",
                  )}
                  onClick={() => {
                    setPreferredMode("base");
                    setPreferredMarketId(null);
                    setPreferredSpecifier("");
                    pushRoute(
                      {
                        categoryIds: [],
                        tournamentIds: [],
                      },
                      sportItem.slug,
                    )
                  }}
                >
                  <SportIconBadge
                    sport={sportItem.name}
                    size="lg"
                    active={sportItem.id === sportId}
                  />
                  <span className="text-base font-semibold leading-4">
                    {getSportDisplayName(sportItem.name)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative z-50">
            <div className="flex">
              <button
                type="button"
                onClick={() => toggleFilterPanel("period")}
                className={cn(
                  "relative flex-1 rounded-md border border-white/8 bg-surface-elevated px-4 py-3 pr-10 text-left text-md font-semibold text-white transition-colors",
                  isPeriodOpen && "border-border-action/40 bg-surface-dropdown",
                )}
              >
                {getPeriodLabel(period, startDate, endDate, hours)}
                <MdArrowDropDown
                  size={18}
                  color="var(--primary-orange)"
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 transition-transform",
                    isPeriodOpen && "rotate-180",
                  )}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isLeagueOpen) {
                    setOpenFilterPanel(null);
                    return;
                  }
                  setDraftTournaments(
                    tournamentIds.map((id) => ({
                      id,
                      categoryId: categoryIds[0],
                    })),
                  );
                  toggleFilterPanel("league");
                }}
                className={cn(
                  "relative flex-1 rounded-md border border-white/8 bg-surface-elevated px-4 py-3 pr-10 text-left text-md font-semibold text-white transition-colors",
                  isLeagueOpen && "border-border-action/40 bg-surface-dropdown",
                )}
              >
                Leagues
                {tournamentIds.length ? (
                  <span className="ml-2 rounded-full bg-[#F2F3F1] px-2 py-0.5 text-sm font-bold text-nav-active">
                    {tournamentIds.length}
                  </span>
                ) : null}
                <MdArrowDropDown
                  size={18}
                  color="var(--primary-orange)"
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 transition-transform",
                    isLeagueOpen && "rotate-180",
                  )}
                />
              </button>

              <button
                type="button"
                onClick={() => toggleFilterPanel("sort")}
                className={cn(
                  "relative flex-1 rounded-md border border-white/8 bg-surface-elevated px-4 py-3 pr-10 text-left text-md font-semibold text-white transition-colors",
                  isSortOpen && "border-border-action/40 bg-surface-dropdown",
                )}
              >
                {getSortLabel(sortBy)}
                <MdArrowDropDown
                  size={18}
                  color="var(--primary-orange)"
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 transition-transform",
                    isSortOpen && "rotate-180",
                  )}
                />
              </button>
            </div>

            {openFilterPanel ? (
              <div className="absolute left-0 right-0 top-[calc(100%-1px)] z-sticky overflow-hidden rounded-b-[22px] border border-white/8 border-t-0 bg-[#F2F2F0] shadow-xl">
                {isPeriodOpen ? (
                  <div className="p-2">
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.value || "all"}
                        type="button"
                        onClick={() => handlePeriodChange(option.value)}
                        className={cn(
                          "block w-full rounded-xl px-4 py-3 text-left text-md font-semibold text-white/78 transition-colors hover:bg-white/[0.06]",
                          option.value === period && "bg-active-tab text-text-on-green",
                          !option.value && !period && "bg-active-tab text-text-on-green",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isSortOpen ? (
                  <div className="p-2">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSortChange(option.value)}
                        className={cn(
                          "block w-full rounded-xl px-4 py-3 text-left text-md font-semibold text-white/78 transition-colors hover:bg-white/[0.06]",
                          option.value === sortBy && "bg-active-tab text-text-on-green",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isLeagueOpen ? (
                  <>
                    <div className="border-b border-white/6 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-3xl font-black text-white">Leagues</h3>
                        </div>
                        {reachedSelectionCap ? (
                          <span className="text-base font-semibold text-[#0C7A4D]">Cap reached</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid max-h-[56vh] grid-cols-[148px_1fr]">
                      <div className="overflow-y-auto border-r border-white/6 bg-[#F5F5F3]">
                        {isCategoriesLoading ? (
                          <div className="space-y-2 p-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <div
                                key={`fixture-categories-loading-${index}`}
                                className="h-11 animate-pulse rounded-xl bg-white/5"
                              />
                            ))}
                          </div>
                        ) : categories.length ? (
                          <div className="p-2">
                            {categories.map((category) => {
                              const categoryId = String(category.category_id ?? "");
                              const isActive = categoryId === activeCategoryId;

                              return (
                                <button
                                  key={`fixture-category-${categoryId}`}
                                  type="button"
                                  onClick={() => setPreferredCategoryId(categoryId)}
                                  className={cn(
                                    "mb-2 block w-full rounded-xl px-3 py-3 text-left transition-colors",
                                    isActive
                                      ? "bg-[#F0F1EF] text-[#0C7A4D]"
                                      : "text-white/72 hover:bg-white/[0.04]",
                                  )}
                                >
                                  <span className="block truncate text-md font-semibold">
                                    {String(category.country_name ?? "Country")}
                                  </span>
                                  <span className="mt-1 block text-sm text-text-muted-2">
                                    {asCount(category.games)} matches
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-3 py-6 text-base text-text-muted-2">
                            No countries available for this period.
                          </div>
                        )}
                      </div>

                      <div className="overflow-y-auto bg-[#F1F2F0]">
                        {activeCategoryId ? (
                          isTournamentsLoading ? (
                            <div className="space-y-2 p-3">
                              {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                  key={`fixture-tournaments-loading-${index}`}
                                  className="h-12 animate-pulse rounded-xl bg-white/5"
                                />
                              ))}
                            </div>
                          ) : tournaments.length ? (
                            <div className="space-y-2 p-3">
                              {tournaments.map((tournament) => {
                                const tournamentId = String(tournament.tournament_id ?? "");
                                const isSelected = draftSelectionIds.includes(tournamentId);
                                const isDisabled = reachedSelectionCap && !isSelected;

                                return (
                                  <button
                                    key={`fixture-tournament-${tournamentId}`}
                                    type="button"
                                    onClick={() => toggleDraftTournament(tournamentId)}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                                      isSelected
                                        ? "border-border-action/45 bg-[#EFEFED]"
                                        : "border-white/6 bg-[#F1F2F0]",
                                      isDisabled && "opacity-55",
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      <span
                                        className={cn(
                                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors",
                                          isSelected
                                            ? "border-border-action bg-active-tab text-text-on-green"
                                            : "border-white/15 bg-transparent text-transparent",
                                        )}
                                        aria-hidden="true"
                                      >
                                        ✓
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-lg font-semibold text-white">
                                          {String(tournament.name ?? "Tournament")}
                                        </span>
                                      </span>
                                    </span>
                                    <span className="rounded-full bg-white/6 px-2 py-0.5 text-sm font-semibold text-white/75">
                                      {asCount(tournament.games)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-4 py-6 text-base text-text-muted-2">
                              No tournaments available for this country right now.
                            </div>
                          )
                        ) : (
                          <div className="px-4 py-6 text-base text-text-muted-2">
                            Choose a country to load tournaments.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-white/6 p-4">
                      <button
                        type="button"
                        onClick={() => setDraftTournaments([])}
                        className="rounded-lg border border-[#0C7A4D]/60 px-4 py-3 text-xl font-semibold text-[#0C7A4D]"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={applyLeagueFilters}
                        className="rounded-lg bg-[linear-gradient(135deg,#ff8a00_0%,#ff6600_100%)] px-4 py-3 text-xl font-semibold text-text-on-green"
                      >
                        Apply ({draftSelectionIds.length})
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!sportMeta && !sports.length ? (
        <div className="py-6 text-sm text-muted-foreground">Loading fixtures…</div>
      ) : null}

      {!sportMeta && sports.length ? (
        <div className="py-6 text-sm text-muted-foreground">
          This sport is not available right now.
        </div>
      ) : null}

      {sportMeta ? (
        <div className="sticky top-14 z-40 bg-[#F6F6F5] py-2">
          <div className="fc-market-pills" style={{padding: '0px'}}>
            {baseMarkets.map((market, index) => {
              const marketId = String(market.marketID ?? market.id ?? "");
              return (
                <button
                  key={`${marketId}-${market.specifier ?? ""}-${market.sportID ?? ""}-${index}`}
                  type="button"
                  onClick={() => {
                    setPreferredMode("base");
                    setPreferredMarketId(marketId);
                    setPreferredSpecifier("");
                  }}
                  className={cn("fc-mp-pill capitalize", marketId === activeBaseMarketId && "active")}
                >
                  {formatHomeMarketName(String(market.marketName ?? market.name ?? ""))}
                </button>
              );
            })}
          </div>

          {derivedConfig ? (
            <div className="fc-sub-filters" style={{margin: '0px'}}>
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
                      disabled={activeMode !== "base" && derivedFixturesQuery.isLoading}
                      onClick={() => setPreferredMode(activeMode === option.key ? "base" : option.key)}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="home-market-header-shell mt-3" style={{padding: '0px'}}>
            <div className="lm-body home-market-header-body">
              <div className="lm-teams home-market-header-spacer">
                <div className="lm-team-row">
                  <span className="lm-team-name">Matches</span>
                </div>
              </div>

              <div className="lm-odds home-market-header-odds">
                {headerHasSpecifier ? (
                  <span className="lm-specifier-title fixture-specifier-width">
                    {headerSpecifierLabel}
                  </span>
                ) : null}
                {(headerOutcomes.length
                  ? headerOutcomes
                  : [{ outcomeName: "1" }, { outcomeName: "X" }, { outcomeName: "2" }]).map(
                  (outcome, index) => (
                    <span
                      key={`${outcome.outcomeID ?? outcome.outcomeName ?? index}`}
                      className="home-market-header-column"
                    >
                      {formatOutcomeName(outcome)}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {sportMeta ? (
        <div className="pb-6">

          {isFixturesLoading ? (
            <div className="live-matches-container rounded-2xl bg-surface-elevated">
              {Array.from({ length: 4 }).map((_, index) => <FixtureSkeleton key={index} />)}
            </div>
          ) : isFixturesError ? (
            <div className="section-empty-state">
              Fixtures could not be loaded right now.
            </div>
          ) : shouldGroupFixtures ? (
            <div className="space-y-3 pt-3">
              {groupedFixtures.map((group) => (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-white/6 bg-surface-elevated"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/6 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-md font-semibold text-white">
                        {group.label}
                      </p>
                      {group.subtitle ? (
                        <p className="mt-1 truncate text-sm text-text-muted-2">
                          {group.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/6 px-3 py-1 text-sm font-semibold text-white/75">
                        {group.fixtures.length}
                      </span>
                      <MdArrowDropDown
                        size={18}
                        className={cn(
                          "text-white/70 transition-transform",
                          collapsedGroups[group.key] && "-rotate-90",
                        )}
                      />
                    </div>
                  </button>

                  {!collapsedGroups[group.key] ? (
                    <div className="live-matches-container">
                      {group.fixtures.map((fixture) => (
                        <PrematchFixture
                          key={`${String(fixture.matchID ?? `${fixture.homeTeam}-${fixture.awayTeam}`)}-${activeSharedSpecifier}`}
                          fixture={fixture}
                          market={displayMarket}
                          selectedSpecifier={activeSharedSpecifier}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : displayFixtures.length ? (
            <div className="live-matches-container rounded-2xl bg-surface-elevated pt-1">
              {displayFixtures.map((fixture) => (
                <PrematchFixture
                  key={`${String(fixture.matchID ?? `${fixture.homeTeam}-${fixture.awayTeam}`)}-${activeSharedSpecifier}`}
                  fixture={fixture}
                  market={displayMarket}
                  selectedSpecifier={activeSharedSpecifier}
                />
              ))}
            </div>
          ) : (
            <div className="section-empty-state">
              No prematch fixtures are available right now.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
