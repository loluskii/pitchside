"use client";

import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { sportsApi } from "@/lib/api/sports";
import { queryKeys } from "@/lib/query/keys";
import type { PeriodFilter } from "@/lib/api/config";

function isClientError(error: unknown): error is AxiosError {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  );
}

export function useSportsMenu() {
  return useQuery({
    queryKey: queryKeys.sports.menu,
    queryFn: () => sportsApi.getSportsMenu(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useTopTournaments() {
  return useQuery({
    queryKey: queryKeys.sports.topTournaments,
    queryFn: ({ signal }) => sportsApi.getTopTournaments({ signal }),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useCategories(sportId: number | string, period?: PeriodFilter) {
  return useQuery({
    queryKey: queryKeys.sports.categories(sportId, period),
    queryFn: ({ signal }) => sportsApi.getCategoriesBySport(sportId, period, { signal }),
    staleTime: 5 * 60_000,
    enabled: !!sportId,
  });
}

export function useTournaments(
  sportId: number | string,
  categoryId: number | string,
  period?: PeriodFilter | null,
) {
  return useQuery({
    queryKey: queryKeys.sports.tournaments(sportId, categoryId, period),
    queryFn: ({ signal }) =>
      sportsApi.getTournamentsByCategory(sportId, categoryId, period, { signal }),
    staleTime: 5 * 60_000,
    enabled: !!sportId && !!categoryId,
  });
}

export function useFixtures(
  tournamentId: number | string,
  sportId: number | string,
  period?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.sports.fixtures(tournamentId, sportId, period ?? undefined),
    queryFn: ({ signal }) =>
      sportsApi.getFixturesByTournament(tournamentId, sportId, period, { signal }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    enabled: !!tournamentId && !!sportId,
  });
}

export function useHighlights(sportId: number | string, page = 1) {
  return useQuery({
    queryKey: queryKeys.sports.highlights(sportId, page),
    queryFn: ({ signal }) => sportsApi.getHighlights(sportId, page, { signal }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useHighlightsV2(payload: {
  sportId?: number | string;
  page?: number;
  perPage?: number;
  tournamentId?: number | string;
  categoryId?: number | string;
  hours?: number;
  today?: 0 | 1;
  tomorrow?: 0 | 1;
  upcoming?: 0 | 1;
  start?: string;
  end?: string;
  orderType?: string;
  derivedOnly?: string;
  featureMarketId?: number | string;
}) {
  return useQuery({
    queryKey: queryKeys.sports.highlightsV2(payload),
    queryFn: () => sportsApi.getHighlightsV2(payload),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: Boolean(payload.sportId),
  });
}

export function useLiveHighlights() {
  return useQuery({
    queryKey: queryKeys.sports.live,
    queryFn: () => sportsApi.getLiveHighlights(),
    // The live feed owns in-play updates; a slow refetch picks up new kick-offs.
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: 45_000,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (
        isClientError(error) &&
        error.response?.status !== undefined &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 1000,
  });
}

export function useLiveCounter() {
  return useQuery({
    queryKey: queryKeys.sports.liveCounter,
    queryFn: () => sportsApi.getLiveCounter(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (
        isClientError(error) &&
        error.response?.status !== undefined &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 1000,
  });
}

export function useUpcoming(sportId: number | string, period?: string | PeriodFilter | null) {
  return useQuery({
    queryKey: queryKeys.sports.upcoming(sportId, period),
    queryFn: ({ signal }) => sportsApi.getUpcoming(sportId, period, { signal }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}

export function useFixtureMarkets(fixtureId: number | string) {
  return useQuery({
    queryKey: queryKeys.sports.fixtureMarkets(fixtureId),
    queryFn: ({ signal }) => sportsApi.getFixtureMarkets(fixtureId, { signal }),
    staleTime: 0,
    gcTime: 10 * 60_000,
    enabled: !!fixtureId,
  });
}

export function useCustomBetMarkets(fixtureId: number | string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sports.customBetMarkets(fixtureId),
    queryFn: ({ signal }) => sportsApi.getCustomBetMarkets(fixtureId, { signal }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: Boolean(fixtureId) && enabled,
    retry: false,
  });
}

export function useMarketsGrouping(sportId: number | string) {
  return useQuery({
    queryKey: queryKeys.sports.marketsGrouping(sportId),
    queryFn: ({ signal }) => sportsApi.getMarketsGrouping(sportId, { signal }),
    staleTime: Infinity,
    enabled: !!sportId,
    retry: false,
    refetchOnMount: false,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.sports.search(q),
    queryFn: ({ signal }) => sportsApi.searchFixtures(q, { signal }),
    staleTime: 0,
    gcTime: 5 * 60_000,
    enabled: q.length >= 2,
  });
}
