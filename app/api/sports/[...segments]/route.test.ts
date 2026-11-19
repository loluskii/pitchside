import { describe, expect, it } from "vitest";
import { buildFixtureHighlightsUrl } from "./route";

describe("buildFixtureHighlightsUrl", () => {
  it("forwards derived highlights parameters to the upstream fixtures endpoint", () => {
    const params = new URLSearchParams({
      categoryId: "0",
      derivedOnly: "",
      end: "",
      featureMarketId: "1601",
      hours: "0",
      orderType: "priority|desc",
      page: "1",
      perPage: "30",
      start: "",
      today: "0",
      tomorrow: "0",
      tournamentId: "0",
      upcoming: "1",
    });

    const url = new URL(buildFixtureHighlightsUrl("1", params, "upcoming"));

    expect(url.searchParams.get("feature_market_id")).toBe("1601");
    expect(url.searchParams.get("order_type")).toBe("priority|desc");
    expect(url.searchParams.get("upcoming")).toBe("1");
    expect(url.searchParams.get("source")).toBe("mobile");
  });
});
