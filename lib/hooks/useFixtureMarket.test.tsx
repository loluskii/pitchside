// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useFixtureMarket } from "@/lib/hooks/useFixtureMarket";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const market: RawMarket = {
  marketID: 18,
  marketName: "Over/Under",
  specifier: "total",
  outcomes: [
    { outcomeID: "12", outcomeName: "over" },
    { outcomeID: "13", outcomeName: "under" },
  ],
};

const fixture: RawFixture = {
  matchID: "100",
  homeTeam: "Everton FC",
  awayTeam: "Manchester United",
  outcomes: [
    { marketID: 18, outcomeID: "12", outcomeName: "over", odds: 1.21, specifier: "total=1.5" },
    { marketID: 18, outcomeID: "13", outcomeName: "under", odds: 4.33, specifier: "total=1.5" },
    { marketID: 18, outcomeID: "12", outcomeName: "over", odds: 1.67, specifier: "total=2.5" },
    { marketID: 18, outcomeID: "13", outcomeName: "under", odds: 2.17, specifier: "total=2.5" },
  ],
};

function render(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });

  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
});

function FixtureMarketProbe({ selectedSpecifier }: { selectedSpecifier: string }) {
  const fixtureMarket = useFixtureMarket({ fixture, market, selectedSpecifier });

  return (
    <div>
      <span data-testid="specifier">{fixtureMarket.activeSpecifier}</span>
      <span data-testid="first-odd">{fixtureMarket.outcomes[0]?.odds}</span>
      <button type="button" onClick={() => fixtureMarket.setActiveSpecifier("total=2.5")}>
        Pick 2.5
      </button>
    </div>
  );
}

describe("useFixtureMarket", () => {
  it("lets a row-level specifier override the shared selected specifier", () => {
    const host = render(<FixtureMarketProbe selectedSpecifier="total=1.5" />);

    expect(host.querySelector('[data-testid="specifier"]')?.textContent).toBe("total=1.5");
    expect(host.querySelector('[data-testid="first-odd"]')?.textContent).toBe("1.21");

    act(() => {
      host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="specifier"]')?.textContent).toBe("total=2.5");
    expect(host.querySelector('[data-testid="first-odd"]')?.textContent).toBe("1.67");
  });
});
