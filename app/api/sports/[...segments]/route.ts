import { engineFetch } from "@/lib/engine/install";
import { NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/api";
import {
  CLIENT_FIXTURES_API,
  CLIENT_ID,
  FIXTURES_API,
  TZ,
} from "@/lib/api/config";

function upstreamHeaders(withAuth = true) {
  return withAuth ? { ...getAuthHeaders(), Accept: "application/json" } : { Accept: "application/json" };
}

type CachedProxyPayload = {
  body: string;
  contentType: string;
  expiresAt: number;
  status: number;
};

const globalCache = globalThis as typeof globalThis & {
  __PITCHSIDE_PROXY_CACHE__?: Map<string, CachedProxyPayload>;
};
const proxyCache = globalCache.__PITCHSIDE_PROXY_CACHE__ ?? new Map<string, CachedProxyPayload>();
globalCache.__PITCHSIDE_PROXY_CACHE__ = proxyCache;

const CACHE_CONTROL = {
  liveCounter: "public, s-maxage=30, stale-while-revalidate=90",
  liveHighlights: "public, s-maxage=15, stale-while-revalidate=45",
  highlights: "public, s-maxage=60, stale-while-revalidate=180",
  topTournaments: "public, s-maxage=60, stale-while-revalidate=300",
};
const CUSTOMBET_FIXTURES_API = process.env.CUSTOMBET_FIXTURES_API ?? FIXTURES_API;

function readProxyCache(url: string) {
  if (process.env.NODE_ENV === "test") return null;

  const cached = proxyCache.get(url);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    proxyCache.delete(url);
    return null;
  }

  return cached;
}

function writeProxyCache(url: string, payload: Omit<CachedProxyPayload, "expiresAt">, ttlMs: number) {
  if (process.env.NODE_ENV === "test") return;
  if (payload.status < 200 || payload.status >= 300 || ttlMs <= 0) return;

  proxyCache.set(url, {
    ...payload,
    expiresAt: Date.now() + ttlMs,
  });
}

function errorResponse(message: string, status = 503) {
  return NextResponse.json({ message }, { status });
}

function debugHeaders(
  url: string,
  source: string,
  status: number,
  ok: boolean,
  durationMs?: number,
  cacheState?: "HIT" | "MISS",
  cacheControl?: string,
) {
  const upstream = new URL(url);
  return {
    [`x-${source}-source`]: ok ? "upstream" : "upstream-error",
    [`x-${source}-status`]: String(status),
    [`x-${source}-upstream-host`]: upstream.host,
    [`x-${source}-upstream-path`]: upstream.pathname,
    ...(durationMs != null ? { [`x-${source}-duration-ms`]: String(durationMs) } : {}),
    ...(cacheState ? { [`x-${source}-cache`]: cacheState } : {}),
    ...(cacheControl ? { "cache-control": cacheControl } : {}),
  };
}

async function proxyJson(
  url: string,
  source: string,
  options: {
    body?: unknown;
    cacheControl?: string;
    enforceBodyStatus?: boolean;
    method?: "GET" | "POST";
    ttlMs?: number;
    withAuth?: boolean;
  } = {},
) {
  const cached = readProxyCache(url);
  if (cached) {
    return new NextResponse(cached.body, {
      status: cached.status,
      headers: {
        ...debugHeaders(url, source, cached.status, cached.status >= 200 && cached.status < 300, 0, "HIT", options.cacheControl),
        "content-type": cached.contentType,
      },
    });
  }

  const startedAt = Date.now();
  const response = await engineFetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...upstreamHeaders(options.withAuth ?? true),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : null),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : null),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const durationMs = Date.now() - startedAt;
  let responseStatus = response.status;
  let isOk = response.ok;

  if (options.enforceBodyStatus && contentType.includes("application/json") && body) {
    try {
      const payload = JSON.parse(body) as { status_code?: unknown; statusCode?: unknown };
      const bodyStatus = Number(payload.status_code ?? payload.statusCode);
      if (Number.isFinite(bodyStatus) && bodyStatus !== 200) {
        responseStatus = bodyStatus >= 400 && bodyStatus <= 599 ? bodyStatus : 502;
        isOk = false;
      }
    } catch {
      // Keep the upstream HTTP status when the body is not parseable JSON.
    }
  }

  const responseHeaders = debugHeaders(
    url,
    source,
    responseStatus,
    isOk,
    durationMs,
    options.ttlMs ? "MISS" : undefined,
    options.cacheControl,
  );

  writeProxyCache(
    url,
    {
      body,
      contentType: contentType || "application/json; charset=utf-8",
      status: responseStatus,
    },
    options.ttlMs ?? 0,
  );

  return new NextResponse(body, {
    status: responseStatus,
    headers: {
      ...responseHeaders,
      "content-type": contentType || "application/json; charset=utf-8",
    },
  });
}

export function buildFixtureHighlightsUrl(
  sportId: string,
  searchParams: URLSearchParams,
  mode: "today" | "upcoming",
) {
  const params = new URLSearchParams({
    page: searchParams.get("page") ?? "1",
    per_page: searchParams.get("perPage") ?? "15",
    tournament_id: searchParams.get("tournamentId") ?? "0",
    category_id: searchParams.get("categoryId") ?? "0",
    hours: searchParams.get("hours") ?? "0",
    today: mode === "today" ? "1" : "0",
    tomorrow: "0",
    upcoming: mode === "upcoming" ? "1" : "0",
    order_type: searchParams.get("orderType") ?? "priority|asc",
    derived_only: searchParams.get("derivedOnly") ?? "",
    source: "mobile",
  });

  const startDate = searchParams.get("startDate") ?? searchParams.get("start");
  const endDate = searchParams.get("endDate") ?? searchParams.get("end");
  const featureMarketId = searchParams.get("featureMarketId");
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  if (featureMarketId) params.set("feature_market_id", featureMarketId);

  return `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}?${params.toString()}`;
}

async function proxyLiveCount(sportId: string) {
  const url = `${FIXTURES_API}/live/counter`;
  const startedAt = Date.now();
  const response = await engineFetch(url, {
    headers: upstreamHeaders(),
    cache: "no-store",
  });

  const payload = await response.json();
  if (!response.ok) {
    return NextResponse.json(payload, {
      status: response.status,
      headers: debugHeaders(url, "sports", response.status, false, Date.now() - startedAt),
    });
  }

  const sports = Array.isArray(payload?.data?.sports) ? payload.data.sports : [];
  const count = Number(
    sports.find(
      (sport: { sport_id?: number | string }) => String(sport.sport_id ?? "") === sportId,
    )?.games ?? 0,
  );

  return NextResponse.json(
    { status_code: 200, status_description: "Success", data: { count } },
    {
      headers: debugHeaders(
        url,
        "sports",
        response.status,
        true,
        Date.now() - startedAt,
        undefined,
        CACHE_CONTROL.liveCounter,
      ),
    },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ segments: string[] }> },
) {
  const { searchParams } = new URL(request.url);
  const { segments } = await context.params;

  try {
    if (!segments.length) {
      return errorResponse("Unknown sports endpoint", 404);
    }

    if (segments[0] === "top-tournaments" || segments[0] === "top-bets") {
      return await proxyJson(
        `${CLIENT_FIXTURES_API}/${CLIENT_ID}/top_tournament?source=mobile`,
        "sports",
        { cacheControl: CACHE_CONTROL.topTournaments, ttlMs: 60_000 },
      );
    }

    if (segments[0] === "categories" && segments[1]) {
      const params = new URLSearchParams(searchParams);
      params.set("source", "mobile");
      return await proxyJson(
        `${FIXTURES_API}/${CLIENT_ID}/categories/${segments[1]}?${params.toString()}`,
        "sports",
      );
    }

    if (segments[0] === "tournaments" && segments[1]) {
      const params = new URLSearchParams({
        category_id: searchParams.get("categoryId") ?? "0",
        source: "mobile",
      });

      const start = searchParams.get("start");
      const end = searchParams.get("end");
      if (start) params.set("start", start);
      if (end) params.set("end", end);

      return await proxyJson(
        `${FIXTURES_API}/${CLIENT_ID}/tournaments/${segments[1]}?${params.toString()}`,
        "sports",
      );
    }

    if (segments[0] === "fixtures-by-category" && segments[1]) {
      const sportId = searchParams.get("sportId") ?? "";
      const params = new URLSearchParams({
        page: searchParams.get("page") ?? "1",
        per_page: searchParams.get("perPage") ?? "50",
        tournament_id: "0",
        category_id: segments[1],
        hours: "0",
        today: "0",
        tomorrow: "0",
        upcoming: "1",
        order_type: searchParams.get("orderType") ?? "priority|asc",
        source: "mobile",
      });

      return await proxyJson(
        `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}?${params.toString()}`,
        "sports",
      );
    }

    if (segments[0] === "fixtures" && segments[1]) {
      const params = new URLSearchParams({
        sportID: searchParams.get("sportId") ?? "",
        marketID: "1",
        source: "mobile",
        timeoffset: TZ,
        period: searchParams.get("period") ?? "all",
        limit: "50",
      });

      return await proxyJson(
        `${FIXTURES_API}/v1/fixtures/tournament/${segments[1]}?${params.toString()}`,
        "sports",
      );
    }

    if (segments[0] === "fixture-markets" && segments[1]) {
      return await proxyJson(`${FIXTURES_API}/${CLIENT_ID}/game/${segments[1]}`, "sports");
    }

    if (segments[0] === "custombet" && segments[1] && segments[2] === "markets") {
      return await proxyJson(
        `${CUSTOMBET_FIXTURES_API}/${CLIENT_ID}/custombet/${segments[1]}/markets?structure=outcomes`,
        "sports",
        { enforceBodyStatus: true },
      );
    }

    if (segments[0] === "markets" && segments[1] === "grouping") {
      const sportId = searchParams.get("sportId") ?? "";
      return await proxyJson(
        `${FIXTURES_API}/${CLIENT_ID}/markets/groups?sport_id=${encodeURIComponent(sportId)}`,
        "sports",
      );
    }

    if (segments[0] === "search") {
      const query = searchParams.get("q") ?? "";
      return await proxyJson(
        `${FIXTURES_API}/search?page=1&perPage=50&search=${encodeURIComponent(query)}&client_id=${CLIENT_ID}`,
        "sports",
      );
    }

    if (segments[0] === "highlights") {
      const sportId = segments[1] ?? searchParams.get("sportId") ?? "";
      if (!sportId) {
        return errorResponse("Missing sportId for highlights request", 400);
      }
      return await proxyJson(
        buildFixtureHighlightsUrl(sportId, searchParams, "upcoming"),
        "sports",
        { cacheControl: CACHE_CONTROL.highlights, ttlMs: 60_000 },
      );
    }

    if (segments[0] === "today" && segments[1]) {
      const sportId = segments[1] ?? searchParams.get("sportId") ?? "";
      if (!sportId) {
        return errorResponse("Missing sportId for today request", 400);
      }
      return await proxyJson(
        buildFixtureHighlightsUrl(sportId, searchParams, "today"),
        "sports",
        { cacheControl: CACHE_CONTROL.highlights, ttlMs: 60_000 },
      );
    }

    if (segments[0] === "upcoming" && segments[1]) {
      const sportId = segments[1] ?? searchParams.get("sportId") ?? "";
      if (!sportId) {
        return errorResponse("Missing sportId for upcoming request", 400);
      }
      return await proxyJson(
        buildFixtureHighlightsUrl(sportId, searchParams, "upcoming"),
        "sports",
        { cacheControl: CACHE_CONTROL.highlights, ttlMs: 60_000 },
      );
    }

    if (segments[0] === "live-highlights") {
      return await proxyJson(
        `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/live/0?per_page=50&source=mobile`,
        "sports",
        { cacheControl: CACHE_CONTROL.liveHighlights, ttlMs: 15_000 },
      );
    }

    if (segments[0] === "live-counter") {
      return await proxyJson(`${FIXTURES_API}/live/counter`, "sports", {
        cacheControl: CACHE_CONTROL.liveCounter,
        ttlMs: 30_000,
      });
    }

    if (segments[0] === "live-count" && segments[1]) {
      return await proxyLiveCount(segments[1]);
    }

    return errorResponse("Unknown sports endpoint", 404);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Sports request failed",
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await context.params;

  try {
    if (segments[0] !== "custombet") {
      return errorResponse("Unknown sports endpoint", 404);
    }

    const body = await request.json();

    if (segments[1] === "compatibility") {
      return await proxyJson(
        `${CUSTOMBET_FIXTURES_API}/${CLIENT_ID}/custombet/compatibility`,
        "sports",
        { body, enforceBodyStatus: true, method: "POST" },
      );
    }

    if (segments[1] === "price") {
      return await proxyJson(
        `${CUSTOMBET_FIXTURES_API}/${CLIENT_ID}/custombet/price`,
        "sports",
        { body, enforceBodyStatus: true, method: "POST" },
      );
    }

    return errorResponse("Unknown sports endpoint", 404);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Sports request failed",
    );
  }
}
