import { engineFetch } from "@/lib/engine/install";
import { NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/api";
import { CLIENT_ID, FIXTURES_API } from "@/lib/api/config";
import { normalizeFixtureResponse } from "@/lib/utils/normalize";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId") ?? "1";
  const limit = searchParams.get("limit") ?? "12";
  const url = `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/live/${sportId}?per_page=${limit}&source=mobile`;

  try {
    const res = await engineFetch(url, {
      headers: { ...getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Live highlights request failed with ${res.status}`);
    }

    const payload = await res.json();
    const events = normalizeFixtureResponse(payload).filter((event) => event.status === "live");

    return NextResponse.json(events, {
      headers: {
        "x-events-source": "fixtures-live-v1",
        "x-events-upstream-host": new URL(url).host,
        "x-events-upstream-path": new URL(url).pathname,
      },
    });
  } catch (error) {
    return NextResponse.json([], {
      headers: {
        "x-events-source": "unavailable",
        "x-events-error": error instanceof Error ? error.message : "Live feed unavailable",
        "x-events-upstream-host": new URL(url).host,
        "x-events-upstream-path": new URL(url).pathname,
      },
    });
  }
}
