"use client";

import { useEffect, useRef } from "react";
import {
  useQueryClient,
  type QueryCacheNotifyEvent,
  type QueryClient,
} from "@tanstack/react-query";
import {
  useMqtt,
  type MatchStatusPayload,
  type OddsChangePayload,
  type ScoreUpdatePayload,
} from "@/lib/hooks/useMqtt";
import {
  normalizeRawPeriodScores,
  normalizeRawScorePair,
} from "@/lib/utils/live-scores";
import { sortHomeOutcomesById } from "@/lib/utils/home-fixtures";
import type { FeaturedTournamentGroup, SportEvent } from "@/types";
import type {
  RawFixture,
  RawOutcome,
  RawPeriodScore,
  RawScorePair,
} from "@/lib/utils/normalize";

type MatchSubscription = {
  sportId: string;
  matchId: string;
};

type NormalizedMarketUpdate = {
  id: string;
  marketName?: string;
  specifier: string;
  statusName: string;
  outcomes: Array<{
    id: string;
    outcomeName?: string;
    displayName?: string;
    odds: number;
    active: number | boolean;
  }>;
};

type ScorePatch = {
  event_time?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  match_status?: string;
  game_score?: RawScorePair;
  period_scores?: RawPeriodScore[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRawFixtureLike(value: unknown): value is RawFixture {
  return isRecord(value) && ("matchID" in value || "sportID" in value);
}

function isSportEventLike(value: unknown): value is SportEvent {
  return isRecord(value) && "id" in value && "sport" in value && "league" in value;
}

function isFeaturedGroupLike(value: unknown): value is FeaturedTournamentGroup {
  return isRecord(value) && "tournamentId" in value && Array.isArray(value.fixtures);
}

function addSubscription(
  map: Map<string, MatchSubscription>,
  sportId: string | number | undefined,
  matchId: string | number | undefined,
) {
  const normalizedSportId = String(sportId ?? "");
  const normalizedMatchId = String(matchId ?? "");
  if (!normalizedSportId || !normalizedMatchId) return;

  map.set(`${normalizedSportId}:${normalizedMatchId}`, {
    sportId: normalizedSportId,
    matchId: normalizedMatchId,
  });
}

function collectSubscriptionsFromRawFixtures(
  fixtures: RawFixture[],
  map: Map<string, MatchSubscription>,
) {
  fixtures.forEach((fixture) => {
    addSubscription(map, fixture.sportID, fixture.matchID);
  });
}

function collectSubscriptionsFromEvents(
  events: SportEvent[],
  map: Map<string, MatchSubscription>,
) {
  events.forEach((event) => {
    addSubscription(map, event.sport.id, event.id);
  });
}

function collectSubscriptionsFromFeaturedGroups(
  groups: FeaturedTournamentGroup[],
  map: Map<string, MatchSubscription>,
) {
  groups.forEach((group) => {
    collectSubscriptionsFromEvents(group.fixtures, map);
  });
}

function collectSubscriptionsFromData(
  data: unknown,
  map: Map<string, MatchSubscription>,
) {
  if (Array.isArray(data)) {
    const first = data[0];
    if (isRawFixtureLike(first)) {
      collectSubscriptionsFromRawFixtures(data as RawFixture[], map);
      return;
    }
    if (isSportEventLike(first)) {
      collectSubscriptionsFromEvents(data as SportEvent[], map);
      return;
    }
    if (isFeaturedGroupLike(first)) {
      collectSubscriptionsFromFeaturedGroups(data as FeaturedTournamentGroup[], map);
    }
    return;
  }

  if (!isRecord(data)) return;

  if (Array.isArray(data.fixtures)) {
    collectSubscriptionsFromRawFixtures(data.fixtures as RawFixture[], map);
    return;
  }

  if (isRecord(data.data) && Array.isArray(data.data.fixtures)) {
    collectSubscriptionsFromRawFixtures(data.data.fixtures as RawFixture[], map);
  }
}

function isSportsbookQueryKey(queryKey: readonly unknown[] | undefined) {
  const rootKey = String(queryKey?.[0] ?? "");
  return rootKey === "sports" || rootKey === "events";
}

function shouldNotifySportsbookQueryCache(
  event: QueryCacheNotifyEvent | undefined,
) {
  if (!isSportsbookQueryKey(event?.query?.queryKey)) {
    return false;
  }

  return (
    event?.type === "observerAdded" ||
    event?.type === "observerRemoved" ||
    event?.type === "updated"
  );
}

function buildSportsbookSubscriptions(queryClient: QueryClient) {
  const nextSubscriptions = new Map<string, MatchSubscription>();

  queryClient
    .getQueryCache()
    .findAll()
    .forEach((query) => {
      if (!query.isActive()) return;
      if (!isSportsbookQueryKey(query.queryKey)) return;
      collectSubscriptionsFromData(query.state.data, nextSubscriptions);
    });

  return nextSubscriptions;
}

function normalizeMqttMarkets(payload: OddsChangePayload): NormalizedMarketUpdate[] {
  const asMarkets = Array.isArray(payload.markets)
    ? payload.markets
    : payload.market_id !== undefined || payload.marketID !== undefined
      ? [
          {
            id: payload.market_id ?? payload.marketID,
            market_name: payload.market_name ?? payload.marketName,
            status_name: payload.status_name ?? payload.statusName,
            specifier: payload.specifier ?? payload.specifiers ?? "",
            outcomes: payload.outcomes ?? [],
          },
        ]
      : [];

  return asMarkets.reduce<NormalizedMarketUpdate[]>((markets, market) => {
    const marketId = String(market.id ?? market.market_id ?? market.marketID ?? "");
    if (!marketId) return markets;

    markets.push({
      id: marketId,
      marketName: market.market_name || market.marketName || undefined,
      specifier: String(market.specifier ?? market.specifiers ?? ""),
      statusName: String(market.status_name ?? market.statusName ?? ""),
      outcomes: sortHomeOutcomesById((market.outcomes ?? []).map((outcome) => ({
        id: String(outcome.id ?? outcome.outcome_id ?? outcome.outcomeID ?? ""),
        outcomeName: outcome.outcome_name ?? outcome.outcomeName,
        displayName: outcome.alias || outcome.displayName || undefined,
        odds: Number(outcome.odds ?? 0),
        active: outcome.active ?? 0,
      }))),
    });

    return markets;
  }, []);
}

function selectionKeyFromOutcome(
  displayName = "",
  outcomeName = "",
): "home" | "draw" | "away" | null {
  const display = displayName.trim();
  const normalizedOutcome = outcomeName.trim().toLowerCase();

  if (
    /^1(\s|\(|$)/.test(display) ||
    ["1", "home", "home win", "team 1"].includes(normalizedOutcome)
  ) {
    return "home";
  }
  if (
    /^x(\s|\(|$)/i.test(display) ||
    ["x", "draw", "tie"].includes(normalizedOutcome)
  ) {
    return "draw";
  }
  if (
    /^2(\s|\(|$)/.test(display) ||
    ["2", "away", "away win", "team 2"].includes(normalizedOutcome)
  ) {
    return "away";
  }

  return null;
}

function normalizePeriod(matchStatus = ""): string {
  const value = matchStatus.toLowerCase();
  if (value.includes("1st") || value === "h1") return "H1";
  if (value.includes("2nd") || value === "h2") return "H2";
  if (value.includes("half") && value.includes("time")) return "HT";
  if (value.includes("90+")) return "90+";
  if (value.includes("extra") || value.includes("et")) return "ET";
  return matchStatus || "H2";
}

function parseMinute(eventTime = ""): number | undefined {
  const [rawMinute] = String(eventTime).split(":");
  const minute = Number(rawMinute);
  return Number.isFinite(minute) ? minute : undefined;
}

function parseTimeToSeconds(eventTime = ""): number | null {
  const [rawMinutes, rawSeconds] = String(eventTime).split(":");
  const minutes = Number(rawMinutes);
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function isPrematchStatusText(matchStatus: string): boolean {
  const value = matchStatus.trim().toLowerCase();
  return !value || value.includes("not") || value.includes("prematch") || value === "scheduled";
}

function isStartedStatusText(matchStatus: string): boolean {
  const value = matchStatus.trim().toLowerCase();
  return Boolean(value) && !isPrematchStatusText(value);
}

function isEndedStatusText(matchStatus: string): boolean {
  const value = matchStatus.trim().toLowerCase();
  return ["ended", "finished", "closed", "completed", "ft", "full time", "full-time"].includes(value);
}

function isPrematchRawFixture(fixture: RawFixture): boolean {
  const matchStatus = String(fixture.matchStatus ?? "");
  return (
    isPrematchStatusText(matchStatus) &&
    fixture.eventTime === undefined &&
    fixture.homeScore === undefined &&
    fixture.awayScore === undefined
  );
}

function hasRawFixtureStarted(fixture: RawFixture): boolean {
  if (!isPrematchRawFixture(fixture)) return false;
  const timestamp = Date.parse(String(fixture.date ?? ""));
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function isFullTimeRawFixture(fixture: RawFixture): boolean {
  const matchStatus = String(fixture.matchStatus ?? "").trim().toLowerCase();
  if (isEndedStatusText(matchStatus)) return true;
  const totalSeconds = parseTimeToSeconds(String(fixture.eventTime ?? ""));
  return totalSeconds !== null && totalSeconds >= 90 * 60;
}

function shouldRemoveRawFixtureForMatchStatus(fixture: RawFixture, patch: ScorePatch | null): boolean {
  if (!patch?.match_status) return false;
  const nextStatus = String(patch.match_status);
  if (isEndedStatusText(nextStatus)) return true;
  return isPrematchRawFixture(fixture) && isStartedStatusText(nextStatus);
}

function isFullTimeEvent(event: SportEvent): boolean {
  if (event.status === "finished") return true;
  if ((event.minute ?? 0) >= 90) return true;
  const period = String(event.period ?? "").trim();
  return period.toUpperCase() === "90+" || isEndedStatusText(period);
}

function hasUpcomingEventStarted(event: SportEvent): boolean {
  if (event.status !== "upcoming") return false;
  const timestamp = Date.parse(event.startTime);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function shouldRemoveEventForMatchStatus(event: SportEvent, patch: ScorePatch | null): boolean {
  if (!patch?.match_status) return false;
  const nextStatus = String(patch.match_status);
  if (isEndedStatusText(nextStatus)) return true;
  return event.status === "upcoming" && isStartedStatusText(nextStatus);
}

function scorePatchFromPayload(
  payload: ScoreUpdatePayload | MatchStatusPayload,
): ScorePatch | null {
  const hasScore =
    payload.home_score !== undefined ||
    payload.away_score !== undefined ||
    payload.event_time !== undefined ||
    payload.game_score !== undefined ||
    payload.period_scores !== undefined;
  const hasStatus = "match_status" in payload && payload.match_status !== undefined;

  if (!hasScore && !hasStatus) return null;

  return {
    ...(payload.event_time !== undefined ? { event_time: payload.event_time } : {}),
    ...(payload.home_score !== undefined ? { home_score: payload.home_score } : {}),
    ...(payload.away_score !== undefined ? { away_score: payload.away_score } : {}),
    ...(payload.game_score !== undefined ? { game_score: payload.game_score } : {}),
    ...(payload.period_scores !== undefined ? { period_scores: payload.period_scores } : {}),
    ...(hasStatus ? { match_status: payload.match_status } : {}),
  };
}

function scorePatchFromOddsPayload(payload: OddsChangePayload): ScorePatch | null {
  const score = payload.sport_event_status ?? payload;
  if (
    score.home_score === undefined &&
    score.away_score === undefined &&
    score.event_time === undefined &&
    score.match_status === undefined &&
    score.game_score === undefined &&
    score.period_scores === undefined
  ) {
    return null;
  }

  return {
    ...(score.home_score !== undefined ? { home_score: score.home_score } : {}),
    ...(score.away_score !== undefined ? { away_score: score.away_score } : {}),
    ...(score.event_time !== undefined ? { event_time: score.event_time } : {}),
    ...(score.match_status !== undefined ? { match_status: score.match_status } : {}),
    ...(score.game_score !== undefined ? { game_score: score.game_score } : {}),
    ...(score.period_scores !== undefined ? { period_scores: score.period_scores } : {}),
  };
}

function scorePairSignature(scorePair: RawScorePair | null | undefined) {
  const normalized = normalizeRawScorePair(scorePair);
  if (!normalized) return "";
  return `${String(normalized.home ?? "")}:${String(normalized.away ?? "")}`;
}

function periodScoresSignature(periodScores: RawPeriodScore[] | null | undefined) {
  return normalizeRawPeriodScores(periodScores)
    .map(
      (periodScore) =>
        `${String(periodScore.number ?? "")}:${String(periodScore.home_score ?? "")}:${String(periodScore.away_score ?? "")}:${String(periodScore.description ?? "")}`,
    )
    .join("|");
}

function matchesOutcome(
  outcome: RawOutcome,
  marketId: string,
  outcomeId: string,
  specifier: string,
): boolean {
  return (
    String(outcome.marketID ?? "") === marketId &&
    String(outcome.outcomeID ?? "") === outcomeId &&
    String(outcome.specifier ?? "") === specifier
  );
}

function applyScorePatchToRawFixture(
  fixture: RawFixture,
  patch: ScorePatch | null,
): RawFixture | null {
  if (!patch) return fixture;
  if (shouldRemoveRawFixtureForMatchStatus(fixture, patch)) return null;

  const hasScorePairUpdate =
    patch.home_score !== undefined || patch.away_score !== undefined;
  const nextGameScore =
    patch.game_score !== undefined
      ? normalizeRawScorePair(patch.game_score)
      : fixture.eventInfo?.game_score;
  const nextPeriodScores =
    patch.period_scores !== undefined
      ? normalizeRawPeriodScores(patch.period_scores)
      : fixture.eventInfo?.period_scores;
  const nextEventInfo =
    hasScorePairUpdate || patch.game_score !== undefined || patch.period_scores !== undefined
      ? {
          ...fixture.eventInfo,
          ...(hasScorePairUpdate
            ? {
                score: {
                  ...fixture.eventInfo?.score,
                  ...(patch.home_score !== undefined ? { home: patch.home_score } : {}),
                  ...(patch.away_score !== undefined ? { away: patch.away_score } : {}),
                },
                scores: {
                  ...fixture.eventInfo?.scores,
                  ...(patch.home_score !== undefined ? { home: patch.home_score } : {}),
                  ...(patch.away_score !== undefined ? { away: patch.away_score } : {}),
                },
              }
            : {}),
          ...(patch.game_score !== undefined ? { game_score: nextGameScore } : {}),
          ...(patch.period_scores !== undefined ? { period_scores: nextPeriodScores } : {}),
        }
      : fixture.eventInfo;

  const changed =
    (patch.home_score !== undefined &&
      Number(fixture.homeScore ?? -1) !== Number(patch.home_score)) ||
    (patch.away_score !== undefined &&
      Number(fixture.awayScore ?? -1) !== Number(patch.away_score)) ||
    (patch.event_time !== undefined &&
      String(fixture.eventTime ?? "") !== String(patch.event_time)) ||
    (patch.match_status !== undefined &&
      String(fixture.matchStatus ?? "") !== String(patch.match_status)) ||
    (patch.game_score !== undefined &&
      scorePairSignature(fixture.eventInfo?.game_score) !== scorePairSignature(nextGameScore)) ||
    (patch.period_scores !== undefined &&
      periodScoresSignature(fixture.eventInfo?.period_scores) !==
        periodScoresSignature(nextPeriodScores));

  if (!changed) return fixture;

  return {
    ...fixture,
    ...(patch.home_score !== undefined ? { homeScore: patch.home_score } : {}),
    ...(patch.away_score !== undefined ? { awayScore: patch.away_score } : {}),
    ...(patch.event_time !== undefined ? { eventTime: patch.event_time } : {}),
    ...(patch.match_status !== undefined ? { matchStatus: patch.match_status } : {}),
    eventInfo: nextEventInfo,
  };
}

function applyScorePatchToEvent(
  event: SportEvent,
  patch: ScorePatch | null,
): SportEvent | null {
  if (!patch) return event;
  if (shouldRemoveEventForMatchStatus(event, patch)) return null;

  const nextMinute =
    patch.event_time !== undefined ? parseMinute(patch.event_time) ?? event.minute : event.minute;
  const nextPeriod =
    patch.match_status !== undefined ? normalizePeriod(patch.match_status) : event.period;

  const changed =
    (patch.home_score !== undefined &&
      Number(event.score?.home ?? -1) !== Number(patch.home_score)) ||
    (patch.away_score !== undefined &&
      Number(event.score?.away ?? -1) !== Number(patch.away_score)) ||
    (nextMinute !== undefined && nextMinute !== event.minute) ||
    (nextPeriod !== undefined && nextPeriod !== event.period);

  if (!changed) return event;

  const nextHomeScore =
    patch.home_score !== undefined && patch.home_score !== null
      ? Number(patch.home_score)
      : (event.score?.home ?? 0);
  const nextAwayScore =
    patch.away_score !== undefined && patch.away_score !== null
      ? Number(patch.away_score)
      : (event.score?.away ?? 0);

  return {
    ...event,
    score: {
      home: nextHomeScore,
      away: nextAwayScore,
      ...(nextPeriod ? { period: nextPeriod } : {}),
    },
    ...(nextMinute !== undefined ? { minute: nextMinute } : {}),
    ...(nextPeriod !== undefined ? { period: nextPeriod } : {}),
  };
}

function applyBetStopToRawFixture(fixture: RawFixture): RawFixture | null {
  if (hasRawFixtureStarted(fixture) || isFullTimeRawFixture(fixture)) {
    return null;
  }

  const currentOutcomes = fixture.outcomes ?? [];
  let changed = false;
  const nextOutcomes = currentOutcomes.map((outcome) => {
    if (outcome.active === 0 || outcome.active === false) return outcome;
    changed = true;
    return { ...outcome, active: 0 };
  });

  return changed ? { ...fixture, outcomes: nextOutcomes } : fixture;
}

function applyMarketUpdatesToRawFixture(
  fixture: RawFixture,
  markets: NormalizedMarketUpdate[],
  reviveAllMarkets: boolean,
  scorePatch: ScorePatch | null,
): RawFixture | null {
  const scoredFixture = applyScorePatchToRawFixture(fixture, scorePatch);
  if (scoredFixture === null) return null;

  const currentOutcomes = scoredFixture.outcomes ?? [];
  let nextOutcomes = reviveAllMarkets
    ? currentOutcomes.map((outcome) => ({ ...outcome, active: 1 }))
    : currentOutcomes;
  const usesMarketField = Boolean(scoredFixture.market?.length);
  const existingMarketMetadata = usesMarketField
    ? scoredFixture.market ?? []
    : scoredFixture.markets ?? [];
  let nextMarketMetadata = existingMarketMetadata;
  let changed = reviveAllMarkets || scoredFixture !== fixture;

  for (const market of markets) {
    if (market.marketName) {
      const marketIndex = nextMarketMetadata.findIndex(
        (metadata) =>
          String(metadata.marketID ?? metadata.id ?? "") === market.id &&
          (!metadata.specifier || metadata.specifier === market.specifier),
      );

      if (marketIndex === -1) {
        nextMarketMetadata = [
          ...nextMarketMetadata,
          {
            marketID: market.id,
            marketName: market.marketName,
            specifier: market.specifier,
          },
        ];
        changed = true;
      } else if (nextMarketMetadata[marketIndex].marketName !== market.marketName) {
        nextMarketMetadata = nextMarketMetadata.slice();
        nextMarketMetadata[marketIndex] = {
          ...nextMarketMetadata[marketIndex],
          marketName: market.marketName,
        };
        changed = true;
      }
    }

    const status = market.statusName.toLowerCase();
    const locksMarket =
      status === "deactivated" ||
      status === "settled" ||
      status === "handedover" ||
      status === "suspended";

    if (locksMarket) {
      nextOutcomes = nextOutcomes.map((outcome) => {
        if (
          String(outcome.marketID ?? "") !== market.id ||
          String(outcome.specifier ?? "") !== market.specifier
        ) {
          return outcome;
        }

        const nextOdds = status === "suspended" ? outcome.odds : 0;
        if (outcome.active === 0 && Number(outcome.odds ?? 0) === Number(nextOdds)) {
          return outcome;
        }

        changed = true;
        return { ...outcome, active: 0, odds: nextOdds };
      });
      continue;
    }

    for (const update of market.outcomes) {
      if (!update.id) continue;

      const outcomeIndex = nextOutcomes.findIndex((outcome) =>
        matchesOutcome(outcome, market.id, update.id, market.specifier),
      );

      if (outcomeIndex === -1) {
        nextOutcomes = [
          ...nextOutcomes,
          {
            marketID: market.id,
            outcomeID: update.id,
            outcomeName: update.outcomeName,
            displayName: update.displayName,
            odds: update.odds,
            active: update.active,
            specifier: market.specifier,
          },
        ];
        changed = true;
        continue;
      }

      const currentOutcome = nextOutcomes[outcomeIndex];
      const nextOutcome: RawOutcome = {
        ...currentOutcome,
        odds: update.odds,
        active: update.active,
      };

      if (
        Number(currentOutcome.odds ?? 0) === Number(nextOutcome.odds ?? 0) &&
        Number(currentOutcome.active ?? 0) === Number(nextOutcome.active ?? 0) &&
        String(currentOutcome.outcomeName ?? "") ===
          String(nextOutcome.outcomeName ?? "") &&
        String(currentOutcome.displayName ?? "") ===
          String(nextOutcome.displayName ?? "")
      ) {
        continue;
      }

      changed = true;
      nextOutcomes = [
        ...nextOutcomes.slice(0, outcomeIndex),
        nextOutcome,
        ...nextOutcomes.slice(outcomeIndex + 1),
      ];
    }
  }

  if (!changed) return scoredFixture;

  return {
    ...scoredFixture,
    outcomes: nextOutcomes,
    ...(nextMarketMetadata.length
      ? usesMarketField
        ? { market: nextMarketMetadata }
        : { markets: nextMarketMetadata }
      : {}),
  };
}

function applyBetStopToEvent(event: SportEvent): SportEvent | null {
  if (hasUpcomingEventStarted(event) || isFullTimeEvent(event)) {
    return null;
  }

  let changed = false;
  const nextMarkets = event.markets.map((market) => {
    if (market.suspended) return market;
    changed = true;
    return { ...market, suspended: true };
  });

  return changed ? { ...event, markets: nextMarkets } : event;
}

function applyMarketUpdatesToEvent(
  event: SportEvent,
  markets: NormalizedMarketUpdate[],
  reviveAllMarkets: boolean,
  scorePatch: ScorePatch | null,
): SportEvent | null {
  const scoredEvent = applyScorePatchToEvent(event, scorePatch);
  if (scoredEvent === null) return null;

  let nextMarkets = reviveAllMarkets
    ? scoredEvent.markets.map((market) =>
        market.suspended ? { ...market, suspended: false } : market,
      )
    : scoredEvent.markets;
  let changed = reviveAllMarkets || scoredEvent !== event;

  for (const market of markets) {
    const status = market.statusName.toLowerCase();
    const locksMarket =
      status === "deactivated" ||
      status === "settled" ||
      status === "handedover" ||
      status === "suspended";

    nextMarkets = nextMarkets.map((existingMarket) => {
      if (String(existingMarket.id) !== market.id) return existingMarket;

      if (locksMarket) {
        if (existingMarket.suspended) return existingMarket;
        changed = true;
        return { ...existingMarket, suspended: true };
      }

      const nextOdds = { ...existingMarket.odds };
      let oddsChanged = false;

      market.outcomes.forEach((outcome) => {
        const selectionKey = selectionKeyFromOutcome(
          outcome.displayName ?? "",
          outcome.outcomeName ?? "",
        );
        if (!selectionKey) return;

        const isActive =
          outcome.active !== 0 &&
          outcome.active !== false &&
          Number.isFinite(outcome.odds) &&
          outcome.odds > 1;

        if (!isActive) {
          if (selectionKey in nextOdds) {
            delete nextOdds[selectionKey];
            oddsChanged = true;
          }
          return;
        }

        if (Number(nextOdds[selectionKey] ?? 0) !== Number(outcome.odds)) {
          nextOdds[selectionKey] = outcome.odds;
          oddsChanged = true;
        }
      });

      if (!oddsChanged && !existingMarket.suspended) return existingMarket;

      changed = true;
      return {
        ...existingMarket,
        ...(market.marketName && !existingMarket.name ? { name: market.marketName } : {}),
        suspended: false,
        odds: nextOdds,
      };
    });
  }

  return changed ? { ...scoredEvent, markets: nextMarkets } : scoredEvent;
}

function patchRawFixtureArray(
  fixtures: RawFixture[],
  matchId: string,
  updater: (fixture: RawFixture) => RawFixture | null,
): RawFixture[] {
  let changed = false;
  const nextFixtures = fixtures.flatMap((fixture) => {
    if (String(fixture.matchID ?? "") !== matchId) return [fixture];

    const nextFixture = updater(fixture);
    if (nextFixture === null) {
      changed = true;
      return [];
    }
    if (nextFixture !== fixture) {
      changed = true;
    }
    return [nextFixture];
  });

  return changed ? nextFixtures : fixtures;
}

function patchSportEventArray(
  events: SportEvent[],
  matchId: string,
  updater: (event: SportEvent) => SportEvent | null,
): SportEvent[] {
  let changed = false;
  const nextEvents = events.flatMap((event) => {
    if (String(event.id) !== matchId) return [event];

    const nextEvent = updater(event);
    if (nextEvent === null) {
      changed = true;
      return [];
    }
    if (nextEvent !== event) {
      changed = true;
    }
    return [nextEvent];
  });

  return changed ? nextEvents : events;
}

function patchFeaturedGroups(
  groups: FeaturedTournamentGroup[],
  matchId: string,
  updater: (event: SportEvent) => SportEvent | null,
): FeaturedTournamentGroup[] {
  let changed = false;

  const nextGroups = groups
    .map((group) => {
      const nextFixtures = patchSportEventArray(group.fixtures, matchId, updater);
      if (nextFixtures !== group.fixtures) {
        changed = true;
        return { ...group, fixtures: nextFixtures };
      }
      return group;
    })
    .filter((group) => group.fixtures.length > 0);

  return changed || nextGroups.length !== groups.length ? nextGroups : groups;
}

function patchSportsbookData(
  data: unknown,
  matchId: string,
  rawUpdater: (fixture: RawFixture) => RawFixture | null,
  eventUpdater: (event: SportEvent) => SportEvent | null,
): unknown {
  if (Array.isArray(data)) {
    const first = data[0];
    if (isRawFixtureLike(first)) {
      return patchRawFixtureArray(data as RawFixture[], matchId, rawUpdater);
    }
    if (isSportEventLike(first)) {
      return patchSportEventArray(data as SportEvent[], matchId, eventUpdater);
    }
    if (isFeaturedGroupLike(first)) {
      return patchFeaturedGroups(data as FeaturedTournamentGroup[], matchId, eventUpdater);
    }
    return data;
  }

  if (!isRecord(data)) return data;

  if (Array.isArray(data.fixtures)) {
    const nextFixtures = patchRawFixtureArray(data.fixtures as RawFixture[], matchId, rawUpdater);
    return nextFixtures === data.fixtures ? data : { ...data, fixtures: nextFixtures };
  }

  if (isRecord(data.data) && Array.isArray(data.data.fixtures)) {
    const nextFixtures = patchRawFixtureArray(
      data.data.fixtures as RawFixture[],
      matchId,
      rawUpdater,
    );
    return nextFixtures === data.data.fixtures
      ? data
      : {
          ...data,
          data: {
            ...data.data,
            fixtures: nextFixtures,
          },
        };
  }

  return data;
}

export function useSportsbookRealtimeBridge() {
  const queryClient = useQueryClient();
  const activeSubscriptionsRef = useRef(new Map<string, MatchSubscription>());
  const betStoppedMatchesRef = useRef(new Set<string>());
  const subscribeToMatchRef = useRef<(sportId: string, matchId: string) => void>(() => {});
  const unsubscribeFromMatchRef = useRef<(sportId: string, matchId: string) => void>(() => {});
  const reconcileSubscriptionsRef = useRef<() => void>(() => {});
  const reconcileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchAllSportsbookQueries = (
    matchId: string,
    rawUpdater: (fixture: RawFixture) => RawFixture | null,
    eventUpdater: (event: SportEvent) => SportEvent | null,
  ) => {
    queryClient
      .getQueryCache()
      .findAll()
      .forEach((query) => {
        const rootKey = String(query.queryKey[0] ?? "");
        if (rootKey !== "sports" && rootKey !== "events") return;

        const currentData = query.state.data;
        if (currentData === undefined) return;

        const nextData = patchSportsbookData(currentData, matchId, rawUpdater, eventUpdater);
        if (nextData !== currentData) {
          queryClient.setQueryData(query.queryKey, nextData);
        }
      });
  };

  const { subscribeToMatch, unsubscribeFromMatch } = useMqtt({
    onOddsChange: (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? "");
      if (!matchId) return;

      const markets = normalizeMqttMarkets(payload);
      if (!markets.length) return;

      const scorePatch = scorePatchFromOddsPayload(payload);
      const reviveAllMarkets = betStoppedMatchesRef.current.delete(matchId);

      patchAllSportsbookQueries(
        matchId,
        (fixture) =>
          applyMarketUpdatesToRawFixture(fixture, markets, reviveAllMarkets, scorePatch),
        (event) => applyMarketUpdatesToEvent(event, markets, reviveAllMarkets, scorePatch),
      );

    },
    onBetStop: (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? "");
      if (!matchId) return;

      betStoppedMatchesRef.current.add(matchId);
      patchAllSportsbookQueries(matchId, applyBetStopToRawFixture, applyBetStopToEvent);
    },
    onMatchStatus: (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? "");
      if (!matchId) return;

      if (String(payload.match_status ?? "").toLowerCase() === "ended") {
        betStoppedMatchesRef.current.delete(matchId);
      }

      const scorePatch = scorePatchFromPayload(payload);
      patchAllSportsbookQueries(
        matchId,
        (fixture) => applyScorePatchToRawFixture(fixture, scorePatch),
        (event) => applyScorePatchToEvent(event, scorePatch),
      );
    },
    onScoreUpdate: (payload) => {
      const matchId = String(payload.match_id ?? payload.event_id ?? "");
      if (!matchId) return;

      const scorePatch = scorePatchFromPayload(payload);
      patchAllSportsbookQueries(
        matchId,
        (fixture) => applyScorePatchToRawFixture(fixture, scorePatch),
        (event) => applyScorePatchToEvent(event, scorePatch),
      );
    },
  });

  useEffect(() => {
    subscribeToMatchRef.current = subscribeToMatch;
    unsubscribeFromMatchRef.current = unsubscribeFromMatch;

    reconcileSubscriptionsRef.current = () => {
      const nextSubscriptions = buildSportsbookSubscriptions(queryClient);
      const currentSubscriptions = activeSubscriptionsRef.current;

      nextSubscriptions.forEach((subscription, key) => {
        if (currentSubscriptions.has(key)) return;
        subscribeToMatchRef.current(subscription.sportId, subscription.matchId);
      });

      currentSubscriptions.forEach((subscription, key) => {
        if (nextSubscriptions.has(key)) return;
        unsubscribeFromMatchRef.current(subscription.sportId, subscription.matchId);
        betStoppedMatchesRef.current.delete(subscription.matchId);
      });

      activeSubscriptionsRef.current = nextSubscriptions;
    };
  }, [queryClient, subscribeToMatch, unsubscribeFromMatch]);

  useEffect(() => {
    reconcileSubscriptionsRef.current();
  }, []);

  useEffect(() => {
    const clearScheduledReconcile = () => {
      if (reconcileTimeoutRef.current === null) return;
      clearTimeout(reconcileTimeoutRef.current);
      reconcileTimeoutRef.current = null;
    };

    const scheduleReconcile = () => {
      if (reconcileTimeoutRef.current !== null) return;
      reconcileTimeoutRef.current = setTimeout(() => {
        reconcileTimeoutRef.current = null;
        reconcileSubscriptionsRef.current();
      }, 0);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!shouldNotifySportsbookQueryCache(event)) return;
      scheduleReconcile();
    });

    return () => {
      unsubscribe();
      clearScheduledReconcile();
    };
  }, [queryClient]);

  useEffect(() => {
    const betStoppedMatches = betStoppedMatchesRef;

    return () => {
      if (reconcileTimeoutRef.current !== null) {
        clearTimeout(reconcileTimeoutRef.current);
        reconcileTimeoutRef.current = null;
      }
      activeSubscriptionsRef.current.forEach((subscription) => {
        unsubscribeFromMatchRef.current(subscription.sportId, subscription.matchId);
      });
      activeSubscriptionsRef.current.clear();
      betStoppedMatches.current.clear();
    };
  }, []);
}
