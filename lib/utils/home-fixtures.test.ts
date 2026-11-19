import { describe, expect, it } from "vitest";
import {
  filterHomeMarketsBySport,
  getAvailableHomeDerivedModes,
  getCanonicalHomeMarkets,
  deriveLiveSports,
  formatOutcomeName,
  resolveHomeDisplayMarket,
  resolveMarketOutcomes,
} from "@/lib/utils/home-fixtures";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";

describe("home-fixtures market helpers", () => {
  it("uses the outcome display name when no market context is available", () => {
    expect(
      formatOutcomeName({ displayName: "1", outcomeName: "Arsenal FC", outcomeID: "1" }),
    ).toBe("1");
  });

  it("keeps the provider draw label in a known competitor market", () => {
    expect(
      formatOutcomeName(
        { displayName: "X", outcomeName: "draw", outcomeID: "2" },
        { marketID: 1, marketName: "1X2" },
      ),
    ).toBe("X");
  });

  it("renders draw as X when the provider only sends the draw outcome name", () => {
    expect(
      formatOutcomeName(
        { outcomeName: "draw", outcomeID: "2" },
        { marketID: 1, marketName: "1X2" },
      ),
    ).toBe("X");
  });

  it("sorts live sports by sport id", () => {
    const fixtures: RawFixture[] = [
      { sportID: 5, sportName: "Tennis" },
      { sportID: 1, sportName: "Soccer" },
      { sportID: 2, sportName: "Basketball" },
    ];

    expect(deriveLiveSports(fixtures).map((sport) => sport.id)).toEqual(["1", "2", "5"]);
  });

  it("collapses duplicate base markets and prefers selectable specifier variants", () => {
    const markets: RawMarket[] = [
      {
        marketID: 225,
        marketName: "Over/Under (incl. overtime)",
        specifier: "",
        sportID: 2,
      },
      {
        marketID: 225,
        marketName: "Over/Under (incl. overtime)",
        specifier: "total",
        sportID: 2,
      },
      {
        marketID: 227,
        marketName: "Home Team Over/Under (incl. overtime)",
        specifier: "total",
        sportID: 2,
      },
    ];

    const result = getCanonicalHomeMarkets(markets);

    expect(result).toHaveLength(2);
    expect(result[0]?.marketID).toBe(225);
    expect(result[0]?.specifier).toBe("total");
    expect(result[1]?.marketID).toBe(227);
  });

  it("keeps distinct market ids separate even when names are similar", () => {
    const markets: RawMarket[] = [
      { marketID: 18, marketName: "Over/Under", specifier: "total", sportID: 1 },
      { marketID: 19, marketName: "Home Over/Under", specifier: "total", sportID: 1 },
      { marketID: 227, marketName: "Home Team Over/Under", specifier: "total", sportID: 2 },
    ];

    const result = getCanonicalHomeMarkets(markets);

    expect(result.map((market) => market.marketID)).toEqual([18, 19, 227]);
  });

  it("filters visible home markets to the active sport while keeping generic templates", () => {
    const markets: RawMarket[] = [
      { marketID: 1, marketName: "1x2", sportID: 1 },
      { marketID: 18, marketName: "Over/Under", sportID: 2 },
      { marketID: 10, marketName: "DC", sportID: 0 },
      { marketID: 11, marketName: "DNB" },
    ];

    const result = filterHomeMarketsBySport(markets, 1);

    expect(result.map((market) => market.marketID)).toEqual([1, 10, 11]);
  });

  it("only exposes derived modes present in the derived response when derived markets exist", () => {
    const derivedMarkets: RawMarket[] = [
      { marketID: 1601, marketName: "1x2 - XUP", specifier: "xup=1", sportID: 1 },
    ];

    const result = getAvailableHomeDerivedModes(1, derivedMarkets);

    expect(result.map((mode) => mode.key)).toEqual(["1up"]);
  });

  it("keeps Early Goals visible when the derived response omits the 60180 market", () => {
    const derivedMarkets: RawMarket[] = [
      { marketID: 1, marketName: "1x2", specifier: "", sportID: 1 },
      { marketID: 18, marketName: "Over/Under", specifier: "", sportID: 1 },
    ];

    const result = getAvailableHomeDerivedModes(18, derivedMarkets);

    expect(result.map((mode) => mode.key)).toEqual(["earlygoal"]);
  });

  it("resolves the exact derived market variant by specifier", () => {
    const baseMarket: RawMarket = {
      marketID: 1,
      marketName: "1x2",
      sportID: 1,
    };
    const derivedMarkets: RawMarket[] = [
      { marketID: 1601, marketName: "1x2 - XUP", specifier: "xup=1", sportID: 1 },
      { marketID: 1601, marketName: "1x2 - XUP", specifier: "xup=2", sportID: 1 },
    ];

    const result = resolveHomeDisplayMarket(baseMarket, "2up", derivedMarkets);

    expect(result?.marketID).toBe(1601);
    expect(result?.specifier).toBe("xup=2");
  });

  it("sorts resolved outcomes by ascending outcome id", () => {
    const fixture: RawFixture = {
      outcomes: [
        { marketID: 10, outcomeID: "11", outcomeName: "X2", odds: 1.8, active: 1 },
        { marketID: 10, outcomeID: "9", outcomeName: "1X", odds: 1.3, active: 1 },
        { marketID: 10, outcomeID: "10", outcomeName: "12", odds: 1.4, active: 1 },
      ],
    };
    const market: RawMarket = {
      marketID: 10,
      marketName: "DC",
      outcomes: [
        { outcomeID: "11", outcomeName: "X2" },
        { outcomeID: "9", outcomeName: "1X" },
        { outcomeID: "10", outcomeName: "12" },
      ],
    };

    const result = resolveMarketOutcomes(fixture, market);

    expect(result.map((outcome) => String(outcome.outcomeID))).toEqual(["9", "10", "11"]);
  });

  it("scopes shared derived market ids to the active xup specifier", () => {
    const fixture: RawFixture = {
      outcomes: [
        { marketID: 1601, outcomeID: "1", outcomeName: "Home", odds: 1.8, active: 1, specifier: "xup=1" },
        { marketID: 1601, outcomeID: "2", outcomeName: "Away", odds: 2.1, active: 1, specifier: "xup=1" },
        { marketID: 1601, outcomeID: "1", outcomeName: "Home", odds: 1.55, active: 1, specifier: "xup=2" },
        { marketID: 1601, outcomeID: "2", outcomeName: "Away", odds: 1.92, active: 1, specifier: "xup=2" },
      ],
    };
    const market: RawMarket = {
      marketID: 1601,
      marketName: "1x2 - XUP",
      specifier: "xup=2",
      outcomes: [
        { outcomeID: "1", outcomeName: "Home" },
        { outcomeID: "2", outcomeName: "Away" },
      ],
    };

    const result = resolveMarketOutcomes(fixture, market);

    expect(result.map((outcome) => Number(outcome.odds))).toEqual([1.55, 1.92]);
    expect(result.every((outcome) => String(outcome.specifier) === "xup=2")).toBe(true);
  });
});
