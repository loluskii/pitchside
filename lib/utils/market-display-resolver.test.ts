import { describe, expect, it } from "vitest";
import {
  cleanMarketName,
  getMarketGroupName,
  getMarketLineLabel,
  getMarketSpecifierValue,
  getOutcomeDisplayLabel,
  parseMarketSpecifiers,
} from "@/lib/utils/market-display-resolver";

describe("market display resolver", () => {
  it("keeps compound specifiers separate and readable", () => {
    const market = {
      marketID: 890,
      marketName: "2|player=sr:player:358222th goalscorer & correct score",
      specifier: "goalnr=2|player=sr:player:358222",
      outcomes: [{ outcomeName: "Morris, Carlton and 1:0" }],
    };

    expect(getMarketGroupName(market)).toBe("goalscorer & correct score");
    expect(getMarketLineLabel(market)).toBe("2nd / Morris, Carlton");
    expect(getMarketGroupName(market)).not.toContain("sr:");
  });

  it("does not expose a raw machine identifier when the player cannot be resolved", () => {
    const market = {
      marketName: "{!goalnr} goalscorer & 1x2",
      specifier: "goalnr=1|player=sr:player:1941088",
    };

    expect(cleanMarketName(market.marketName, market.specifier, market)).toBe(
      "1st goalscorer & 1x2",
    );
    expect(getMarketLineLabel(market)).toBe("1st");
    expect(getMarketLineLabel(market)).not.toContain("1941088");
  });

  it("supports the documented specifier syntax", () => {
    expect(parseMarketSpecifiers("total=2.5|hcp=-1.0")).toEqual([
      { key: "total", value: "2.5" },
      { key: "hcp", value: "-1.0" },
    ]);
    expect(getMarketSpecifierValue("total=2.5|hcp=-1.0")).toBe("2.5");
    expect(cleanMarketName("{!periodnr} period - total", "periodnr=2")).toBe(
      "2nd period - total",
    );
  });

  it("uses the Pitchside marketName as the market title", () => {
    expect(
      getMarketGroupName({
        marketName: "5 minutes - 1X2 from 26 to 30",
        specifier: "from=26|to=30",
      }),
    ).toBe("5 minutes - 1X2 from 26 to 30");
  });

  it("keeps provider outcome display labels unchanged", () => {
    const market = {
      marketID: 108,
      marketName: "05 Minutes - 1X2",
      outcomes: [
        { outcomeID: "1", displayName: "1" },
        { outcomeID: "2", displayName: "X" },
        { outcomeID: "3", displayName: "2" },
      ],
    };

    expect(market.outcomes.map((outcome) => getOutcomeDisplayLabel(market, outcome))).toEqual([
      "1",
      "X",
      "2",
    ]);
  });

  it("falls back to raw outcome ids when display labels are unavailable", () => {
    const market = { marketID: 108, marketName: "5 minutes - 1X2" };

    expect(getOutcomeDisplayLabel(market, { outcomeID: "1" })).toBe("1");
    expect(getOutcomeDisplayLabel(market, { outcomeID: "2" })).toBe("2");
    expect(getOutcomeDisplayLabel(market, { outcomeID: "3" })).toBe("3");
  });

  it("cleans malformed embedded specifiers and keeps the range as the line label", () => {
    const market = {
      marketName: "15 minutes - 1|from=61|to=75th goal from {from} to {to}",
      specifier: "goalnr=1|from=61|to=75",
    };

    expect(cleanMarketName(market.marketName, market.specifier, market)).toBe(
      "15 minutes - 1st goal from 61 to 75",
    );
    expect(getMarketGroupName(market)).toBe("15 minutes - goal from 61 to 75");
    expect(getMarketLineLabel(market)).toBe("1st / 61-75");
  });

  it("removes compact raw specifier prefixes from scorer market names", () => {
    const market = {
      marketName: "1|type=prematchth Goalscorer",
      specifier: "goalnr=1|type=prematch",
    };

    expect(getMarketGroupName(market)).toBe("Goalscorer");
  });
});
