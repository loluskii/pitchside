import { formatHomeSportName } from "@/lib/utils/home-fixtures";
import type { RawFixture } from "@/lib/utils/normalize";

function slugifySportName(value = ""): string {
  return formatHomeSportName(String(value || "Football"))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function getPrematchFixtureHref(fixture: Pick<RawFixture, "sportName" | "matchID">): string {
  return `/sports/${slugifySportName(String(fixture.sportName ?? "Football"))}/${fixture.matchID}`;
}

export function getLiveFixtureHref(fixture: Pick<RawFixture, "sportName" | "matchID">): string {
  return `/live/${slugifySportName(String(fixture.sportName ?? "Football"))}/${fixture.matchID}`;
}

export function getFixtureSportSlug(value = ""): string {
  return slugifySportName(value);
}
