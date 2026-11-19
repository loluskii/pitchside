"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLiveTimer } from "@/lib/hooks/useLiveTimer";
import { sportsApi } from "@/lib/api/sports";
import {
  normalizeRawPeriodScores,
  normalizeRawScorePair,
} from "@/lib/utils/live-scores";
import { useSportsMenu } from "@/lib/query/hooks/useSports";
import { queryKeys } from "@/lib/query/keys";
import { sortHomeOutcomesById } from "@/lib/utils/home-fixtures";
import type { RawFixture, RawPeriodScore, RawScorePair } from "@/lib/utils/normalize";

type FixtureDetailData = RawFixture & {
  producerStatus?: string;
  status?: number | string;
  statusCode?: number | string;
  country?: string;
  market?: FixtureDetailMarket[];
  markets?: FixtureDetailMarket[];
  tournamentName?: string;
};

type FixtureDetailResponse = {
  data?: FixtureDetailData;
};

type MarketGroupingResponse = {
  data?: FixtureDetailMarketGroup[];
};

type FixtureDetailRealtimePatch = Partial<
  Pick<FixtureDetailData, "eventTime" | "homeScore" | "awayScore" | "matchStatus" | "status">
> & {
  gameScore?: RawScorePair;
  periodScores?: RawPeriodScore[];
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
    .filter((market) => {
      const status = String(market.statusName ?? "").trim().toLowerCase();
      return !["deactivated", "settled", "handedover"].includes(status);
    })
    .map((market) => ({
      ...market,
      outcomes: sortHomeOutcomesById(market.outcomes ?? []).map((outcome) =>
        String(market.statusName ?? "").trim().toLowerCase() === "suspended"
          ? { ...outcome, odds: 0, active: 0 }
          : outcome,
      ),
    }));
}

function marketStateKey(marketID: string | number | undefined, specifier: unknown) {
  return `${String(marketID ?? "")}|${String(specifier ?? "")}`;
}

function lockMarketOutcomes(market: FixtureDetailMarket, statusName = market.statusName) {
  return {
    ...market,
    ...(statusName ? { statusName } : {}),
    outcomes: sortHomeOutcomesById(market.outcomes ?? []).map((outcome) => ({
      ...outcome,
      odds: 0,
      active: 0,
    })),
  };
}

function mergeFixturePatch(
  current: FixtureDetailData | null,
  patch: FixtureDetailRealtimePatch,
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
            ...(patch.gameScore !== undefined
              ? { game_score: normalizeRawScorePair(patch.gameScore) }
              : {}),
            ...(patch.periodScores !== undefined
              ? { period_scores: normalizeRawPeriodScores(patch.periodScores) }
              : {}),
          }
        : {
            ...current.eventInfo,
            ...(patch.gameScore !== undefined
              ? { game_score: normalizeRawScorePair(patch.gameScore) }
              : {}),
            ...(patch.periodScores !== undefined
              ? { period_scores: normalizeRawPeriodScores(patch.periodScores) }
              : {}),
          },
  };
}

function isMatchEnded(detail: FixtureDetailData | null) {
  return String(detail?.matchStatus ?? "").trim().toLowerCase() === "ended";
}

export function LiveFixtureDetailView({
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
  const betStoppedRef = useRef(false);
  const suspendedMarketsRef = useRef(new Set<string>());

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
    staleTime: 0,
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

  const { displayTime, stopTimer, syncDisplayTime } = useLiveTimer(
    String(detailState?.eventTime ?? detailData?.eventTime ?? "00:00"),
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
      const nextMarkets = visibleMarkets(detailData.market ?? detailData.markets ?? []);
      setMarketState(
        nextMarkets.map((market) => {
          const key = marketStateKey(market.marketID, market.specifier);
          if (suspendedMarketsRef.current.has(key)) {
            return lockMarketOutcomes(market, "Suspended");
          }
          return betStoppedRef.current ? lockMarketOutcomes(market) : market;
        }),
      );
      syncDisplayTime(String(detailData.eventTime ?? "00:00"));
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
    syncDisplayTime,
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
    if (payload.event_time !== undefined) {
      syncDisplayTime(String(payload.event_time));
    }

    setDetailState((current) =>
      mergeFixturePatch(current, {
        ...(payload.event_time !== undefined ? { eventTime: String(payload.event_time) } : {}),
        ...(payload.home_score !== undefined ? { homeScore: payload.home_score } : {}),
        ...(payload.away_score !== undefined ? { awayScore: payload.away_score } : {}),
        ...(payload.game_score !== undefined ? { gameScore: payload.game_score } : {}),
        ...(payload.period_scores !== undefined ? { periodScores: payload.period_scores } : {}),
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
        const marketId = String(marketPayload.market_id ?? marketPayload.marketID ?? "");
        const specifier = String(marketPayload.specifier ?? marketPayload.specifiers ?? "");
        setMarketState((current) => {
          const statusName = String(
            marketPayload.status_name ?? marketPayload.statusName ?? "",
          ).toLowerCase();
          const updateKey = marketStateKey(marketId, specifier);
          const isTerminal = ["deactivated", "settled", "handedover"].includes(statusName);

          if (isTerminal) {
            suspendedMarketsRef.current.delete(updateKey);
          } else if (statusName === "suspended") {
            suspendedMarketsRef.current.add(updateKey);
          } else if (statusName) {
            suspendedMarketsRef.current.delete(updateKey);
          }

          if (betStoppedRef.current && statusName && statusName !== "suspended") {
            betStoppedRef.current = false;
          }

          const nextMarkets = current
            .map((market) => {
              const marketMatches =
                String(market.marketID ?? "") ===
                  String(marketPayload.market_id ?? marketPayload.marketID ?? "") &&
                String(market.specifier ?? "") ===
                  String(marketPayload.specifier ?? marketPayload.specifiers ?? "");

              if (!marketMatches) {
                return betStoppedRef.current
                  ? {
                      ...market,
                      outcomes: sortHomeOutcomesById(market.outcomes.map((outcome) => ({
                        ...outcome,
                        active: 1,
                      }))),
                    }
                  : market;
              }

              if (isTerminal) {
                return null;
              }

              if (statusName === "suspended") {
                return lockMarketOutcomes(market, "Suspended");
              }

              if (suspendedMarketsRef.current.has(updateKey)) {
                return lockMarketOutcomes(market, "Suspended");
              }

              const outcomes = marketPayload.outcomes ?? [];

              return {
                ...market,
                marketName:
                  marketPayload.market_name || marketPayload.marketName || market.marketName,
                desc: marketPayload.desc || market.desc,
                description: marketPayload.description || market.description,
                statusName: String(
                  marketPayload.status_name ?? marketPayload.statusName ?? "Active",
                ),
                outcomes: sortHomeOutcomesById(market.outcomes.map((outcome) => {
                  const updatedOutcome = outcomes.find(
                    (candidate) =>
                      String(candidate.outcome_id ?? candidate.outcomeID ?? candidate.id ?? "") ===
                      String(outcome.outcomeID ?? ""),
                  );

                  if (!updatedOutcome) {
                    return {
                      ...outcome,
                      active: betStoppedRef.current ? 1 : outcome.active,
                    };
                  }

                  return {
                    ...outcome,
                    odds: updatedOutcome.odds ?? outcome.odds,
                    active: updatedOutcome.active ?? outcome.active,
                  };
                })),
              };
            })
            .filter((market): market is FixtureDetailMarket => Boolean(market));

          const exists = nextMarkets.some(
            (market) =>
              String(market.marketID ?? "") === marketId &&
              String(market.specifier ?? "") === specifier,
          );

          if (!exists && !isTerminal) {
            nextMarkets.push({
              marketID: marketId,
              marketName: String(marketPayload.market_name || marketPayload.marketName || "Market"),
              desc: marketPayload.desc,
              description: marketPayload.description,
              specifier,
              statusName:
                statusName === "suspended"
                  ? "Suspended"
                  : String(marketPayload.status_name ?? marketPayload.statusName ?? "Active"),
              outcomes: sortHomeOutcomesById((marketPayload.outcomes ?? []).map((outcome) => ({
                outcomeID: outcome.outcome_id ?? outcome.outcomeID ?? outcome.id,
                outcomeName: outcome.outcome_name ?? outcome.outcomeName,
                displayName:
                  outcome.alias ||
                  outcome.displayName ||
                  undefined,
                desc: outcome.desc,
                odds: statusName === "suspended" ? 0 : outcome.odds,
                active: statusName === "suspended" ? 0 : outcome.active,
                specifier,
              }))),
            });
          }

          return nextMarkets;
        });

        if (
          payload.sport_event_status ||
          payload.home_score !== undefined ||
          payload.away_score !== undefined ||
          payload.event_time !== undefined ||
          payload.game_score !== undefined ||
          payload.period_scores !== undefined ||
          payload.match_status !== undefined
        ) {
          applyLiveState({
            home_score: payload.sport_event_status?.home_score ?? payload.home_score,
            away_score: payload.sport_event_status?.away_score ?? payload.away_score,
            event_time: payload.sport_event_status?.event_time ?? payload.event_time,
            game_score: payload.sport_event_status?.game_score ?? payload.game_score,
            period_scores: payload.sport_event_status?.period_scores ?? payload.period_scores,
            match_status: payload.sport_event_status?.match_status ?? payload.match_status,
          });
        }
      };

      if (Array.isArray(payload.markets)) {
        payload.markets.forEach((market) => applyMarketPayload(market));
      } else {
        applyMarketPayload(payload);
      }
    },
    onBetStop: (payload) => {
      const payloadMatchId = String(payload.match_id ?? payload.event_id ?? "");
      if (payloadMatchId && payloadMatchId !== activeMatchId) return;

      betStoppedRef.current = true;
      setMarketState((current) =>
        current.map((market) => ({
          ...market,
          outcomes: sortHomeOutcomesById(market.outcomes.map((outcome) => ({
            ...outcome,
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

  useEffect(() => {
    if (isMatchEnded(detailState)) {
      stopTimer();
    }
  }, [detailState, stopTimer]);

  const detail = detailState;
  const isLoading = detailQuery.isLoading;

  return (
    <FixtureDetailScreen
      detail={detail}
      displayGroupedMarkets={displayGroupedMarkets}
      displayTime={displayTime}
      emptyMessage="This live event is no longer available."
      getActiveSection={getActiveSection}
      hasNoMarketsInSelectedGroup={hasNoMarketsInSelectedGroup}
      hasSectionTabs={hasSectionTabs}
      homeHref="/live"
      isBettingClosed={isMatchEnded(detail)}
      isLive
      isLoading={isLoading}
      onBack={() => router.back()}
      selectedGroupId={selectedGroupId}
      selectionType="live"
      setActiveSection={setActiveSection}
      setSelectedGroupId={setSelectedGroupId}
      sortedMarketGroups={sortedMarketGroups}
      sportSlug={sportSlug}
    />
  );
}
