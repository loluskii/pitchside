import { engineFetch } from "@/lib/engine/install";
import { NextResponse } from "next/server";
import { getAuthHeaders } from "@/lib/api";
import { FIXTURES_API } from "@/lib/api/config";
import { normalizeFixtureResponse } from "@/lib/utils/normalize";
import { CLIENT_ID } from "@/lib/helpers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId") ?? "1";
  const tournamentId = searchParams.get("tournamentId");
  const categoryId = searchParams.get("categoryId");
  const period = searchParams.get("period") ?? "today";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = searchParams.get("limit") ?? "12";
  let url = `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}`;

  try {
    const params = new URLSearchParams({
      page: "1",
      per_page: limit,
      tournament_id: tournamentId ?? "0",
      category_id: categoryId ?? "0",
      hours: "0",
      today: "0",
      tomorrow: "0",
      upcoming: "0",
      order_type: "priority|asc",
      start: "",
      end: "",
      derived_only: "",
    });

    if (startDate && endDate) {
      params.set("start", startDate);
      params.set("end", endDate);
      params.set("upcoming", "1");
    } else if (period === "today") {
      params.set("today", "1");
    } else if (period === "tomorrow") {
      params.set("tomorrow", "1");
    } else {
      params.set("upcoming", "1");
    }

    url = `${FIXTURES_API}/v1/${CLIENT_ID}/fixtures/highlights/${sportId}?${params.toString()}`;

    const res = await engineFetch(url, {
      headers: { ...getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Upcoming fixtures request failed with ${res.status}`);
    }

    const payload = await res.json();
    const events = normalizeFixtureResponse(payload).filter((event) => event.status === "upcoming");

    return NextResponse.json(events, {
      headers: {
        "x-events-source": "fixtures-highlights-v1",
        "x-events-upstream-host": new URL(url).host,
        "x-events-upstream-path": new URL(url).pathname,
      },
    });
  } catch (error) {
    return NextResponse.json([], {
      headers: {
        "x-events-source": "unavailable",
        "x-events-error": error instanceof Error ? error.message : "Upcoming feed unavailable",
        "x-events-upstream-host": new URL(url).host,
        "x-events-upstream-path": new URL(url).pathname,
      },
    });
  }
}
