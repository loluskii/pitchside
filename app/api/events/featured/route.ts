import { engineFetch } from "@/lib/engine/install";
import { NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/api";
import { CLIENT_FIXTURES_API } from "@/lib/api/config";
import {
  normalizeFixtureResponse,
  type RawFixture,
  type RawMarket,
  type RawFixtureResponse,
} from "@/lib/utils/normalize";
import type { FeaturedEvent, FeaturedTournamentGroup } from "@/types";
import { CLIENT_ID } from "@/lib/helpers";

const FEATURED_TOURNAMENT_LIMIT = 20;
const FEATURED_FIXTURE_LIMIT = 10;
const FEATURED_FIXTURE_REQUEST_TIMEOUT_MS = 3000;
const FEATURED_FIXTURE_MAX_ATTEMPTS = 2;
const FEATURED_RESPONSE_DEADLINE_MS = 5500;
const FEATURED_CACHE_TTL_MS = 60_000;
const FEATURED_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

type FeaturedCache = {
  body: string;
  expiresAt: number;
  headers: Record<string, string>;
};

let featuredCache: FeaturedCache | null = null;
const globalCache = globalThis as typeof globalThis & {
  __PITCHSIDE_FEATURED_CACHE__?: FeaturedCache | null;
};

type RawFeaturedTournament = {
  id?: number | string;
  name?: string;
  priority?: number | string;
  source?: string;
  sport_id?: number | string;
  title?: string;
  top_tournament_id?: number | string;
  topTournamentID?: number | string;
  tournament_id?: number | string;
  tournament_name?: string;
};

type FeaturedFixturesPayload = {
  status_code?: number;
  status_description?: string;
  data?: {
    fixtures?: RawFixture[];
    markets?: RawMarket[];
  };
};

function asDataArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function extractRawFixtures(payload: unknown): RawFixture[] {
  if (!payload || typeof payload !== "object") return [];
  if ("data" in payload && payload.data && typeof payload.data === "object") {
    const fixtures = (payload.data as { fixtures?: RawFixture[] }).fixtures;
    return Array.isArray(fixtures) ? fixtures : [];
  }
  if ("fixtures" in payload) {
    const fixtures = (payload as { fixtures?: RawFixture[] }).fixtures;
    return Array.isArray(fixtures) ? fixtures : [];
  }
  return [];
}

function buildTopTournamentFixturesUrl(tournamentId: string) {
  const params = new URLSearchParams({
    source: "mobile",
    structure: "outcomes",
  });

  return `${CLIENT_FIXTURES_API}/v1/${CLIENT_ID}/fixtures/top-tournament/${tournamentId}?${params.toString()}`;
}

function getFeaturedCache() {
  if (process.env.NODE_ENV === "test") return null;

  featuredCache = globalCache.__PITCHSIDE_FEATURED_CACHE__ ?? null;
  if (!featuredCache || featuredCache.expiresAt <= Date.now()) {
    featuredCache = null;
    globalCache.__PITCHSIDE_FEATURED_CACHE__ = null;
    return null;
  }

  return featuredCache;
}

function setFeaturedCache(body: string, headers: Record<string, string>) {
  if (process.env.NODE_ENV === "test") return;

  featuredCache = {
    body,
    expiresAt: Date.now() + FEATURED_CACHE_TTL_MS,
    headers,
  };
  globalCache.__PITCHSIDE_FEATURED_CACHE__ = featuredCache;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function combineAbortSignals(signals: AbortSignal[]) {
  if (signals.length === 1) return signals[0];
  if ("any" in AbortSignal) {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  signals.forEach((signal) => {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });

  return controller.signal;
}

async function fetchJsonWithTimeout(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEATURED_FIXTURE_REQUEST_TIMEOUT_MS);
  const fetchSignal = signal ? combineAbortSignals([controller.signal, signal]) : controller.signal;

  try {
    const response = await engineFetch(url, {
      headers: { ...getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
      signal: fetchSignal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapFeaturedFixtures(
  payload: FeaturedFixturesPayload,
  fallbackTournamentName: string
): FeaturedTournamentGroup | null {
  const rawFixtures = extractRawFixtures(payload);
  if (!rawFixtures.length) return null;

  const fallbackCategoryName = String(
    rawFixtures[0]?.categoryName ?? ""
  );

  const normalizedFixtures = normalizeFixtureResponse(payload as RawFixtureResponse)
    .filter((event) => event.markets.length > 0)
    .slice(0, FEATURED_FIXTURE_LIMIT)
    .map((event) => {
      const rawFixture = rawFixtures.find((fixture) => String(fixture.matchID ?? "") === event.id);
      return {
        ...event,
        featured: true,
        hot: true,
        categoryName: rawFixture?.categoryName ?? fallbackCategoryName ?? event.sport.name,
      } satisfies FeaturedEvent;
    });

  if (!normalizedFixtures.length) return null;

  const firstFixture = rawFixtures[0];
  const firstEvent = normalizedFixtures[0];

  return {
    tournamentId: String(firstFixture?.tournamentID ?? firstEvent.league.id),
    sportId: String(firstFixture?.sportID ?? firstEvent.sport.id),
    categoryId: String(firstFixture?.categoryID ?? ""),
    tournamentName: String(firstFixture?.tournament ?? fallbackTournamentName ?? firstEvent.league.name),
    categoryName: String(firstFixture?.categoryName ?? fallbackCategoryName ?? firstEvent.sport.name),
    logoUrl: firstEvent.league.logo,
    fixtures: normalizedFixtures,
  };
}

async function fetchFeaturedFixtures(
  tournamentId: string,
  signal?: AbortSignal,
): Promise<FeaturedFixturesPayload | null> {
  const url = buildTopTournamentFixturesUrl(tournamentId);

  for (let attempt = 1; attempt <= FEATURED_FIXTURE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const primaryResponse = await fetchJsonWithTimeout(url, signal);

      if (!primaryResponse.ok) {
        if (attempt < FEATURED_FIXTURE_MAX_ATTEMPTS) continue;
        return null;
      }

      const primaryPayload = (await primaryResponse.json()) as FeaturedFixturesPayload;
      if (extractRawFixtures(primaryPayload).length > 0) {
        return primaryPayload;
      }

      return null;
    } catch {
      if (attempt < FEATURED_FIXTURE_MAX_ATTEMPTS) continue;
    }
  }

  return null;
}

export async function GET() {
  const topTournamentsUrl = `${CLIENT_FIXTURES_API}/${CLIENT_ID}/top_tournament?source=mobile`;
  const cached = getFeaturedCache();

  if (cached) {
    return new NextResponse(cached.body, {
      headers: {
        ...cached.headers,
        "cache-control": FEATURED_CACHE_CONTROL,
        "content-type": "application/json; charset=utf-8",
        "x-featured-cache": "HIT",
        "x-featured-total-ms": "0",
      },
    });
  }

  const startedAt = Date.now();

  try {
    const topTournamentsStartedAt = Date.now();
    const topTournamentsResponse = await engineFetch(topTournamentsUrl, {
      headers: { ...getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    });
    const topTournamentsDurationMs = Date.now() - topTournamentsStartedAt;

    if (!topTournamentsResponse.ok) {
      throw new Error(`Top tournament request failed with ${topTournamentsResponse.status}`);
    }

    const topTournamentsPayload = await topTournamentsResponse.json();
    const topTournaments = asDataArray<RawFeaturedTournament>(topTournamentsPayload);

    const seen = new Set<string>();
    const tournaments = topTournaments
      .slice()
      .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0))
      .filter((entry) => {
        const tournamentId = String(entry.tournament_id ?? entry.id ?? "");
        const sportId = String(entry.sport_id ?? "");
        const key = sportId ? `${sportId}:${tournamentId}` : tournamentId;

        if (!tournamentId || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, FEATURED_TOURNAMENT_LIMIT);

    const fixturesController = new AbortController();
    const groups: Array<FeaturedTournamentGroup | null> = Array(tournaments.length).fill(null);
    const fixtureStartedAt = Date.now();
    let completedFixtureRequests = 0;

    const groupPromises = tournaments.map(async (tournament, index) => {
        try {
          const topTournamentId = String(
            tournament.id ??
              tournament.top_tournament_id ??
              tournament.topTournamentID ??
              tournament.tournament_id ??
              ""
          );

          if (!topTournamentId) return null;

          const fixturesPayload = await fetchFeaturedFixtures(
            topTournamentId,
            fixturesController.signal,
          );
          if (!fixturesPayload) return null;

          const group = mapFeaturedFixtures(
            fixturesPayload,
            String(tournament.tournament_name ?? tournament.name ?? tournament.title ?? "Featured League")
          );

          groups[index] = group;
          return group;
        } catch {
          return null;
        } finally {
          completedFixtureRequests += 1;
        }
      });

    const didHitDeadline = await Promise.race([
      Promise.allSettled(groupPromises).then(() => false),
      wait(FEATURED_RESPONSE_DEADLINE_MS).then(() => true),
    ]);

    if (didHitDeadline) {
      fixturesController.abort();
      await Promise.race([Promise.allSettled(groupPromises), wait(100)]);
    }

    const data = groups.filter((group): group is FeaturedTournamentGroup => group !== null);
    const skippedCount = Math.max(tournaments.length - data.length, 0);
    const fixtureDurationMs = Date.now() - fixtureStartedAt;
    const headers = {
      "cache-control": FEATURED_CACHE_CONTROL,
      "x-featured-cache": "MISS",
      "x-featured-deadline-hit": didHitDeadline ? "1" : "0",
      "x-featured-fixtures-ms": String(fixtureDurationMs),
      "x-featured-partial": skippedCount > 0 ? "1" : "0",
      "x-featured-requested-tournaments": String(tournaments.length),
      "x-featured-returned-groups": String(data.length),
      "x-featured-skipped-groups": String(skippedCount),
      "x-featured-completed-fixture-requests": String(completedFixtureRequests),
      "x-featured-source": "top_tournament+top-tournament-fixtures",
      "x-featured-top-tournaments-ms": String(topTournamentsDurationMs),
      "x-featured-total-ms": String(Date.now() - startedAt),
      "x-featured-upstream-host": new URL(topTournamentsUrl).host,
      "x-featured-upstream-path": new URL(topTournamentsUrl).pathname,
    };
    const body = JSON.stringify(data);
    setFeaturedCache(body, headers);

    return new NextResponse(body, {
      headers: {
        ...headers,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Featured feed unavailable",
      },
      {
        status: 503,
      headers: {
        "x-featured-cache": "MISS",
        "x-featured-source": "unavailable",
        "x-featured-error": error instanceof Error ? error.message : "Featured feed unavailable",
        "x-featured-total-ms": String(Date.now() - startedAt),
        "x-featured-upstream-host": new URL(topTournamentsUrl).host,
        "x-featured-upstream-path": new URL(topTournamentsUrl).pathname,
      },
      },
    );
  }
}
