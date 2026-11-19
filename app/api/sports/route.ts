import { engineFetch } from "@/lib/engine/install";
import { NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/api";
import { FIXTURES_API, CLIENT_ID } from "@/lib/api/config";
import { normalizeSportsMenu } from "@/lib/utils/home-fixtures";

const SPORTS_MENU_TTL_MS = 5 * 60_000;
const SPORTS_MENU_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=900";

type SportsMenuCache = {
  body: string;
  expiresAt: number;
};

let sportsMenuCache: SportsMenuCache | null = null;
const globalCache = globalThis as typeof globalThis & {
  __PITCHSIDE_SPORTS_MENU_CACHE__?: SportsMenuCache | null;
};

function getSportsMenuCache() {
  if (process.env.NODE_ENV === "test") return null;

  sportsMenuCache = globalCache.__PITCHSIDE_SPORTS_MENU_CACHE__ ?? null;
  if (!sportsMenuCache || sportsMenuCache.expiresAt <= Date.now()) {
    globalCache.__PITCHSIDE_SPORTS_MENU_CACHE__ = null;
    sportsMenuCache = null;
    return null;
  }

  return sportsMenuCache;
}

function setSportsMenuCache(body: string) {
  if (process.env.NODE_ENV === "test") return;

  sportsMenuCache = {
    body,
    expiresAt: Date.now() + SPORTS_MENU_TTL_MS,
  };
  globalCache.__PITCHSIDE_SPORTS_MENU_CACHE__ = sportsMenuCache;
}

function debugHeaders(url: string, source: string, status?: number) {
  const upstream = new URL(url);
  return {
    "x-sports-source": source,
    "x-sports-upstream-host": upstream.host,
    "x-sports-upstream-path": upstream.pathname,
    ...(status ? { "x-sports-status": String(status) } : {}),
  };
}

export async function GET() {
  const url = `${FIXTURES_API}/${CLIENT_ID}/sports`;
  const cached = getSportsMenuCache();

  if (cached) {
    return new NextResponse(cached.body, {
      headers: {
        ...debugHeaders(url, "fixtures-sports-cache", 200),
        "cache-control": SPORTS_MENU_CACHE_CONTROL,
        "content-type": "application/json; charset=utf-8",
        "x-sports-cache": "HIT",
        "x-sports-duration-ms": "0",
      },
    });
  }

  const startedAt = Date.now();

  try {
    const response = await engineFetch(url, {
      headers: { ...getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      return NextResponse.json(body, {
        status: response.status,
        headers: debugHeaders(url, "upstream-error", response.status),
      });
    }

    const payload = await response.json();
    const body = JSON.stringify(normalizeSportsMenu(payload));
    setSportsMenuCache(body);

    return new NextResponse(body, {
      headers: {
        ...debugHeaders(url, "fixtures-sports", response.status),
        "cache-control": SPORTS_MENU_CACHE_CONTROL,
        "content-type": "application/json; charset=utf-8",
        "x-sports-cache": "MISS",
        "x-sports-duration-ms": String(Date.now() - startedAt),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Sports menu unavailable" },
      {
        status: 503,
        headers: {
          ...debugHeaders(url, "unavailable"),
          "x-sports-duration-ms": String(Date.now() - startedAt),
        },
      },
    );
  }
}
