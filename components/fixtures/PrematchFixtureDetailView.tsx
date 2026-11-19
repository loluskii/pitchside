"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FixtureDetailScreen } from "@/components/fixtures/FixtureDetailScreen";
import type {
  FixtureDetailMarket,
  FixtureDetailMarketGroup,
} from "@/lib/hooks/useFixtureDetailMarkets";
import { useFixtureDetailMarkets } from "@/lib/hooks/useFixtureDetailMarkets";
import {
  useMqtt,
  type MatchStatusPayload,
  type OddsChangePayload,
  type ScoreUpdatePayload,
} from "@/lib/hooks/useMqtt";
import { sportsApi } from "@/lib/api/sports";
import { useSportsMenu } from "@/lib/query/hooks/useSports";
import { queryKeys } from "@/lib/query/keys";
import { sortHomeOutcomesById } from "@/lib/utils/home-fixtures";
import type { RawFixture } from "@/lib/utils/normalize";

type FixtureDetailData = RawFixture & {
  producerStatus?: string;
  status?: number | string;
  statusCode?: number | string;
  country?: string;
  market?: FixtureDetailMarket[];
  derived_market_ids?: Array<number | string>;
  derived_market_id?: number | string | Array<number | string>;
  tournamentName?: string;
};

type FixtureDetailResponse = {
  data?: FixtureDetailData;
};

type MarketGroupingResponse = {
  data?: FixtureDetailMarketGroup[];
};

function findCachedFixture(queryClient: ReturnType<typeof useQueryClient>, fixtureId: string) {
  const queries = queryClient.getQueryCache().getAll();

  for (const query of queries) {
    const data = query.state.data as
      | { fixtures?: RawFixture[]; data?: { fixtures?: RawFixture[] } }
      | RawFixture[]
      | undefined;

    const fixtures = Array.isArray(data)
      ? data
      : data?.fixtures ?? data?.data?.fixtures ?? [];

    const match = fixtures.find((fixture) => String(fixture.matchID ?? "") === fixtureId);
    if (match) return match;
  }

  return null;
}

function normalizeFixtureDetail(
  response: FixtureDetailResponse | FixtureDetailData | undefined | null,
): FixtureDetailData | null {
  if (!response) return null;
  if (Object.prototype.hasOwnProperty.call(response, "data")) {
    return (response as FixtureDetailResponse).data ?? null;
  }
  return response as FixtureDetailData;
}

function normalizeMarketGroups(
  response: MarketGroupingResponse | FixtureDetailMarketGroup[] | undefined | null,
) {
  if (!response) return [];
  return Array.isArray(response) ? response : (response.data ?? []);
}

function visibleMarkets(markets: FixtureDetailMarket[] = []) {
  return markets
    .filter((market) => String(market.statusName ?? "").trim().toLowerCase() !== "suspended")
    .map((market) => ({
      ...market,
      outcomes: sortHomeOutcomesById(market.outcomes ?? []),
    }));
}

function mergeFixturePatch(
  current: FixtureDetailData | null,
  patch: Partial<FixtureDetailData>,
) {
  if (!current) return current;

  return {
    ...current,
    ...patch,
    eventInfo:
      patch.homeScore !== undefined || patch.awayScore !== undefined
        ? {
            ...current.eventInfo,
            score: {
              ...current.eventInfo?.score,
              ...(patch.homeScore !== undefined ? { home: Number(patch.homeScore) } : {}),
              ...(patch.awayScore !== undefined ? { away: Number(patch.awayScore) } : {}),
            },
            scores: {
              ...current.eventInfo?.scores,
              ...(patch.homeScore !== undefined ? { home: Number(patch.homeScore) } : {}),
              ...(patch.awayScore !== undefined ? { away: Number(patch.awayScore) } : {}),
            },
          }
        : current.eventInfo,
  };
}

function isPrematchStatus(detail: FixtureDetailData | null) {
  if (!detail) return false;
  const matchStatus = String(detail.matchStatus ?? "").trim().toLowerCase();
  const numericStatus = Number(detail.status ?? detail.statusCode ?? 0);
  return numericStatus === 0 && (!matchStatus || matchStatus === "not started");
}

function hasStartedStatus(detail: FixtureDetailData | null) {
  if (!detail) return false;
  const matchStatus = String(detail.matchStatus ?? "").trim().toLowerCase();
  const numericStatus = Number(detail.status ?? detail.statusCode ?? 0);
  return (
    numericStatus === 1 ||
    (Boolean(matchStatus) && !matchStatus.includes("not") && !matchStatus.includes("prematch"))
  );
}

export function PrematchFixtureDetailView({
  sportSlug,
  fixtureId,
}: {
  sportSlug: string;
  fixtureId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sports = [] } = useSportsMenu();
  const [detailState, setDetailState] = useState<FixtureDetailData | null>(null);
  const [marketState, setMarketState] = useState<FixtureDetailMarket[]>([]);

  const cachedFixture = useMemo(
    () => findCachedFixture(queryClient, fixtureId),
    [fixtureId, queryClient],
  );

  const sport = sports.find((item) => item.slug === sportSlug);
  const sportId = sport?.id ?? String(cachedFixture?.sportID ?? "1");

  const detailQuery = useQuery({
    queryKey: queryKeys.sports.fixtureMarkets(fixtureId),
    queryFn: () => sportsApi.getFixtureMarkets(fixtureId),
    enabled: Boolean(fixtureId),
    staleTime: 30_000,
  });

  const marketGroupsQuery = useQuery({
    queryKey: queryKeys.sports.marketsGrouping(sportId),
    queryFn: () => sportsApi.getMarketsGrouping(sportId),
    enabled: Boolean(sportId),
    staleTime: Infinity,
    retry: false,
    refetchOnMount: "always",
  });

  const detailData = normalizeFixtureDetail(
    detailQuery.data as FixtureDetailResponse | FixtureDetailData,
  );
  const marketGroups = normalizeMarketGroups(
    marketGroupsQuery.data as MarketGroupingResponse | FixtureDetailMarketGroup[],
  );

  useEffect(() => {
    if (!detailData) return;
    let isCancelled = false;

    const tournamentName = String(
      cachedFixture?.tournament ?? detailData.tournamentName ?? detailData.tournament ?? "",
    ).trim();
    const sportName = String(
      cachedFixture?.sportName ?? detailData.sportName ?? sport?.name ?? "Football",
    );
    const categoryName = String(cachedFixture?.categoryName ?? detailData.country ?? "").trim();

    queueMicrotask(() => {
      if (isCancelled) return;

      setDetailState({
        ...detailData,
        tournamentName,
        sportName,
        categoryName,
      });
      setMarketState(visibleMarkets(detailData.market ?? []));
    });

    return () => {
      isCancelled = true;
    };
  }, [
    cachedFixture?.categoryName,
    cachedFixture?.sportName,
    cachedFixture?.tournament,
    detailData,
    sport?.name,
  ]);

  const {
    selectedGroupId,
    setSelectedGroupId,
    displayGroupedMarkets,
    sortedMarketGroups,
    hasNoMarketsInSelectedGroup,
    getActiveSection,
    setActiveSection,
    hasSectionTabs,
  } = useFixtureDetailMarkets({
    eventMarkets: marketState,
    marketGroups,
    fixtureDetail: detailState,
  });

  const activeMatchId = String(detailState?.matchID ?? fixtureId);
  const activeSportId = String(detailState?.sportID ?? sportId ?? "1");

  const applyLiveState = (payload: MatchStatusPayload | ScoreUpdatePayload) => {
    setDetailState((current) =>
      mergeFixturePatch(current, {
        ...(payload.event_time !== undefined ? { eventTime: String(payload.event_time) } : {}),
        ...(payload.home_score !== undefined ? { homeScore: payload.home_score } : {}),
        ...(payload.away_score !== undefined ? { awayScore: payload.away_score } : {}),
        ...("match_status" in payload && payload.match_status !== undefined
          ? { matchStatus: payload.match_status }
          : {}),
        status: 1,
      }),
    );
  };

  const { subscribeToMatch, unsubscribeFromMatch } = useMqtt({
    onOddsChange: (payload: OddsChangePayload) => {
      const payloadMatchId = String(payload.match_id ?? payload.event_id ?? "");
      if (payloadMatchId && payloadMatchId !== activeMatchId) return;

      const applyMarketPayload = (marketPayload: {
        market_id?: string | number;
        marketID?: string | number;
        market_name?: string;
        marketName?: string;
        desc?: string;
        description?: string;
        status_name?: string;
        statusName?: string;
        specifier?: string;
        specifiers?: string;
        outcomes?: Array<{
          id?: string | number;
          outcome_id?: string | number;
          outcomeID?: string | number;
          outcome_name?: string;
          outcomeName?: string;
          desc?: string;
          alias?: string;
          displayName?: string;
          odds?: string | number;
          active?: number | boolean;
        }>;
      }) => {
        setMarketState((current) => {
          const nextMarkets = current.map((market) => {
            const marketMatches =
              String(market.marketID ?? "") ===
                String(marketPayload.market_id ?? marketPayload.marketID ?? "") &&
              String(market.specifier ?? "") ===
                String(marketPayload.specifier ?? marketPayload.specifiers ?? "");

            if (!marketMatches) {
              return market;
            }

            const nextStatus = String(
              marketPayload.status_name ?? marketPayload.statusName ?? market.statusName ?? "",
            );

            if (nextStatus.toLowerCase() === "deactivated") {
              return null;
            }

            const outcomes = marketPayload.outcomes ?? [];

            return {
              ...market,
                marketName:
                  marketPayload.market_name || marketPayload.marketName || market.marketName,
                desc: marketPayload.desc || market.desc,
                description: marketPayload.description || market.description,
              statusName: nextStatus || market.statusName,
              outcomes: sortHomeOutcomesById(market.outcomes.map((outcome) => {
                const updatedOutcome = outcomes.find(
                  (candidate) =>
                    String(candidate.outcome_id ?? candidate.outcomeID ?? candidate.id ?? "") ===
                    String(outcome.outcomeID ?? ""),
                );

                if (!updatedOutcome) {
                  return outcome;
                }

                return {
                  ...outcome,
                  odds: updatedOutcome.odds ?? outcome.odds,
                  active: updatedOutcome.active ?? outcome.active,
                };
              })),
            };
          });

          const normalized = nextMarkets.filter(
            (market): market is FixtureDetailMarket => Boolean(market),
          );
          const marketId = String(marketPayload.market_id ?? marketPayload.marketID ?? "");
          const specifier = String(marketPayload.specifier ?? marketPayload.specifiers ?? "");
          const exists = normalized.some(
            (market) =>
              String(market.marketID ?? "") === marketId &&
              String(market.specifier ?? "") === specifier,
          );

          if (
            !exists &&
            String(marketPayload.status_name ?? marketPayload.statusName ?? "").toLowerCase() !==
              "deactivated"
          ) {
            normalized.push({
              marketID: marketId,
              marketName: String(marketPayload.market_name || marketPayload.marketName || "Market"),
              desc: marketPayload.desc,
              description: marketPayload.description,
              specifier,
              statusName: String(marketPayload.status_name ?? marketPayload.statusName ?? "Active"),
              outcomes: sortHomeOutcomesById((marketPayload.outcomes ?? []).map((outcome) => ({
                outcomeID: outcome.outcome_id ?? outcome.outcomeID ?? outcome.id,
                outcomeName: outcome.outcome_name ?? outcome.outcomeName,
                displayName:
                  outcome.alias ||
                  outcome.displayName ||
                  undefined,
                desc: outcome.desc,
                odds: outcome.odds,
                active: outcome.active,
                specifier,
              }))),
            });
          }

          return normalized;
        });
      };

      if (Array.isArray(payload.markets)) {
        payload.markets.forEach((market) => applyMarketPayload(market));
      } else {
        applyMarketPayload(payload);
      }

      if (payload.sport_event_status) {
        applyLiveState({
          home_score: payload.sport_event_status.home_score,
          away_score: payload.sport_event_status.away_score,
        });
      }
    },
    onBetStop: (payload) => {
      const payloadMatchId = String(payload.match_id ?? payload.event_id ?? "");
      if (payloadMatchId && payloadMatchId !== activeMatchId) return;

      setMarketState((current) =>
        current.map((market) => ({
          ...market,
          statusName: "Suspended",
          outcomes: sortHomeOutcomesById(market.outcomes.map((outcome) => ({
            ...outcome,
            odds: 0,
            active: 0,
          }))),
        })),
      );
    },
    onMatchStatus: (payload) => {
      const payloadMatchId = String(payload.match_id ?? payload.event_id ?? "");
      if (payloadMatchId && payloadMatchId !== activeMatchId) return;

      applyLiveState(payload);
    },
    onScoreUpdate: (payload) => {
      const payloadMatchId = String(payload.match_id ?? payload.event_id ?? "");
      if (payloadMatchId && payloadMatchId !== activeMatchId) return;

      applyLiveState(payload);
    },
  });

  useEffect(() => {
    if (!activeMatchId || !activeSportId) return;
    subscribeToMatch(activeSportId, activeMatchId);
    return () => {
      unsubscribeFromMatch(activeSportId, activeMatchId);
    };
  }, [activeMatchId, activeSportId, subscribeToMatch, unsubscribeFromMatch]);

  const detail = detailState;
  const isLoading = detailQuery.isLoading;
  const isBettingClosed = !marketState.length && detail !== null && !isPrematchStatus(detail);

  useEffect(() => {
    if (!hasStartedStatus(detail)) return;
    router.replace(`/live/${sportSlug}/${fixtureId}`);
  }, [detail, fixtureId, router, sportSlug]);

  return (
    <FixtureDetailScreen
      detail={detail}
      displayGroupedMarkets={displayGroupedMarkets}
      emptyMessage="This event is no longer available for betting."
      getActiveSection={getActiveSection}
      hasNoMarketsInSelectedGroup={hasNoMarketsInSelectedGroup}
      hasSectionTabs={hasSectionTabs}
      homeHref="/"
      isBettingClosed={isBettingClosed}
      isLive={false}
      isLoading={isLoading}
      onBack={() => router.back()}
      selectedGroupId={selectedGroupId}
      selectionType="prematch"
      setActiveSection={setActiveSection}
      setSelectedGroupId={setSelectedGroupId}
      sortedMarketGroups={sortedMarketGroups}
      sportSlug={sportSlug}
    />
  );
}
