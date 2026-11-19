import { engineFetch } from "@/lib/engine/install";
import {
  CLIENT_FIXTURES_API,
  CLIENT_ID,
  FIXTURES_API,
  TZ,
  type PeriodFilter,
} from "./config";
import type { Sport } from "@/types";
import { normalizeSportsMenu } from "@/lib/utils/home-fixtures";
import { primeSportsMenuCache } from "@/lib/utils/sports";

function withParams(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

type RequestOptions = {
  signal?: AbortSignal;
};

type CustomBetRequestOptions = RequestOptions & {
  body?: unknown;
  method?: "GET" | "POST";
};

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await engineFetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const body = await response.text();
  let payload: unknown = body;

  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    // Keep the upstream text when a failed response is not JSON.
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message ?? response.statusText)
        : response.statusText || `Sports request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

async function requestCustomBetJson<T>(
  url: string,
  { body, method = "GET", signal }: CustomBetRequestOptions = {},
): Promise<T> {
  const response = await engineFetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : null),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : null),
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  const bodyStatus = Number(payload?.status_code ?? payload?.statusCode);
  const bodyMessage = String(payload?.status_description ?? payload?.message ?? "").trim();

  if (!response.ok || (Number.isFinite(bodyStatus) && bodyStatus !== 200)) {
    throw new Error(bodyMessage || response.statusText || "CustomBet request failed.");
  }

  return payload as T;
}

function buildHighlightsUrl(
  sportId: number | string,
  params: URLSearchParams,
  mode: "today" | "upcoming",
) {
  const upstreamParams = new URLSearchParams({
    page: params.get("page") ?? "1",
    per_page: params.get("perPage") ?? "15",
    tournament_id: params.get("tournamentId") ?? "0",
    category_id: params.get("categoryId") ?? "0",
    hours: params.get("hours") ?? "0",
    today: mode === "today" ? "1" : "0",
    tomorrow: "0",
    upcoming: mode === "upcoming" ? "1" : "0",
    order_type: params.get("orderType") ?? "priority|asc",
    derived_only: params.get("derivedOnly") ?? "",
    source: "mobile",
  });

  const start = params.get("startDate") ?? params.get("start");
  const end = params.get("endDate") ?? params.get("end");
  const featureMarketId = params.get("featureMarketId");
  if (start) upstreamParams.set("start", start);
  if (end) upstreamParams.set("end", end);
  if (featureMarketId) upstreamParams.set("feature_market_id", featureMarketId);

  return `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}?${upstreamParams.toString()}`;
}

export const sportsApi = {
  getSportsMenu: async ({ signal }: RequestOptions = {}): Promise<Sport[]> => {
    const payload = await requestJson<unknown>(
      `${FIXTURES_API}/${CLIENT_ID}/sports`,
      signal,
    );
    const sports = normalizeSportsMenu(payload);
    primeSportsMenuCache(sports);
    return sports;
  },

  getTopTournaments: ({ signal }: RequestOptions = {}) =>
    requestJson(`${CLIENT_FIXTURES_API}/${CLIENT_ID}/top_tournament?source=mobile`, signal),

  getCategoriesBySport: (
    sportId: number | string,
    period?: PeriodFilter,
    { signal }: RequestOptions = {},
  ) => {
    const params = new URLSearchParams();
    if (period?.startDate) params.set("start", period.startDate);
    if (period?.endDate) params.set("end", period.endDate);

    params.set("source", "mobile");
    return requestJson(
      withParams(`${FIXTURES_API}/${CLIENT_ID}/categories/${sportId}`, params),
      signal,
    );
  },

  getTournamentsByCategory: (
    sportId: number | string,
    categoryId: number | string,
    period?: PeriodFilter | null,
    { signal }: RequestOptions = {},
  ) => {
    const params = new URLSearchParams({
      category_id: String(categoryId),
      source: "mobile",
    });
    if (period?.startDate) params.set("start", period.startDate);
    if (period?.endDate) params.set("end", period.endDate);

    return requestJson(
      withParams(`${FIXTURES_API}/${CLIENT_ID}/tournaments/${sportId}`, params),
      signal,
    );
  },

  getFixturesByCategory: (
    categoryId: number | string,
    sportId: number | string,
    { signal }: RequestOptions = {},
  ) => {
    const params = new URLSearchParams({
      page: "1",
      per_page: "50",
      tournament_id: "0",
      category_id: String(categoryId),
      hours: "0",
      today: "0",
      tomorrow: "0",
      upcoming: "1",
      order_type: "priority|asc",
      source: "mobile",
    });
    return requestJson(
      `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}?${params.toString()}`,
      signal,
    );
  },

  getFixturesByTournament: (
    tournamentId: number | string,
    sportId: number | string,
    period?: string | null,
    { signal }: RequestOptions = {},
  ) => {
    const params = new URLSearchParams({
      sportID: String(sportId),
      marketID: "1",
      source: "mobile",
      timeoffset: TZ,
      period: period ?? "all",
      limit: "50",
    });
    return requestJson(
      `${FIXTURES_API}/v1/fixtures/tournament/${tournamentId}?${params.toString()}`,
      signal,
    );
  },

  getFixtureMarkets: (fixtureId: number | string, { signal }: RequestOptions = {}) =>
    requestJson(`${FIXTURES_API}/${CLIENT_ID}/game/${fixtureId}`, signal),

  getCustomBetMarkets: (matchId: number | string, { signal }: RequestOptions = {}) =>
    requestCustomBetJson(`/api/sports/custombet/${matchId}/markets`, { signal }),

  checkCustomBetCompatibility: (body: unknown, { signal }: RequestOptions = {}) =>
    requestCustomBetJson("/api/sports/custombet/compatibility", {
      body,
      method: "POST",
      signal,
    }),

  priceCustomBet: (body: unknown, { signal }: RequestOptions = {}) =>
    requestCustomBetJson("/api/sports/custombet/price", {
      body,
      method: "POST",
      signal,
    }),

  getMarketsGrouping: (sportId: number | string, { signal }: RequestOptions = {}) =>
    requestJson(
      `${FIXTURES_API}/${CLIENT_ID}/markets/groups?sport_id=${encodeURIComponent(sportId)}`,
      signal,
    ),

  searchFixtures: (q: string, { signal }: RequestOptions = {}) =>
    requestJson(
      `${FIXTURES_API}/search?page=1&perPage=50&search=${encodeURIComponent(q)}&client_id=${CLIENT_ID}`,
      signal,
    ),

  getHighlights: (sportId: number | string, page = 1, { signal }: RequestOptions = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    return requestJson(buildHighlightsUrl(sportId, params, "upcoming"), signal);
  },

  getToday: (sportId: number | string, page = 1, { signal }: RequestOptions = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    return requestJson(buildHighlightsUrl(sportId, params, "today"), signal);
  },

  getUpcoming: (
    sportId: number | string,
    period?: string | PeriodFilter | null,
    { signal }: RequestOptions = {},
  ) => {
    const params = new URLSearchParams();
    if (typeof period === "string") params.set("period", period);
    else if (period) {
      if (period.startDate) params.set("startDate", period.startDate);
      if (period.endDate) params.set("endDate", period.endDate);
    }

    return requestJson(buildHighlightsUrl(sportId, params, "upcoming"), signal);
  },

  getHighlightsV2: (
    payload: {
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
    },
    { signal }: RequestOptions = {},
  ) => {
    const {
      sportId = 1,
      page = 1,
      perPage = 60,
      tournamentId = 0,
      categoryId = 0,
      hours = 0,
      today = 0,
      tomorrow = 0,
      upcoming = 0,
      start = "",
      end = "",
      orderType = "priority|asc",
      derivedOnly = "",
      featureMarketId = "",
    } = payload;

    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      tournamentId: String(tournamentId),
      categoryId: String(categoryId),
      hours: String(hours),
      today: String(today),
      tomorrow: String(tomorrow),
      upcoming: String(upcoming),
      orderType,
      start,
      end,
      derivedOnly,
    });

    if (
      featureMarketId !== "" &&
      featureMarketId !== undefined &&
      featureMarketId !== null
    ) {
      params.set("featureMarketId", String(featureMarketId));
    }

    return requestJson(buildHighlightsUrl(sportId, params, upcoming ? "upcoming" : "today"), signal);
  },

  getLiveHighlights: ({ signal }: RequestOptions = {}) =>
    requestJson(
      `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/live/0?per_page=50&source=mobile`,
      signal,
    ),

  getLiveCounter: ({ signal }: RequestOptions = {}) =>
    requestJson(`${FIXTURES_API}/live/counter`, signal),

  getLiveCountBySport: async (sportId: number | string, { signal }: RequestOptions = {}) => {
    const payload = await requestJson<{
      status_code?: number;
      status_description?: string;
      data?: { sports?: Array<{ sport_id?: number | string; games?: number | string }> };
    }>(`${FIXTURES_API}/live/counter`, signal);
    const count = Number(
      payload.data?.sports?.find((sport) => String(sport.sport_id ?? "") === String(sportId))?.games ?? 0,
    );
    return {
      status_code: 200,
      status_description: "Success",
      data: { count },
    };
  },
};
