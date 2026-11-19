import { describe, expect, it } from "vitest";

import {
  buildCouponSelectionElementId,
  buildCouponSelectionPayload,
  getCouponSelectionKeySpecifier,
} from "@/lib/utils/coupon";

describe("coupon utilities", () => {
  it("falls back to the market specifier when the outcome specifier is blank", () => {
    const market = { marketID: 1601, marketName: "1X2 - 1UP", specifier: "xup=1" };
    const outcome = { outcomeID: "1", outcomeName: "Home", odds: 1.33, specifier: "" };

    expect(getCouponSelectionKeySpecifier(market, outcome)).toBe("xup=1");
    expect(
      buildCouponSelectionElementId({
        fixture: { matchID: "68687812" },
        market,
        outcome,
      }),
    ).toBe("68687812_1601_1_xup=1");
    expect(
      buildCouponSelectionPayload({
        fixture: { matchID: "68687812" },
        market,
        outcome,
      }).selection_key_specifier,
    ).toBe("xup=1");
  });
});
