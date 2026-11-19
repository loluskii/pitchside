// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  addSelection: vi.fn(),
  removeSelection: vi.fn(),
  showErrorDialog: vi.fn(),
  state: {
    mode: "real" as const,
    selections: [] as Array<{
      currentSelectionId: string;
      matchId?: string;
      marketId?: string;
      outcomeId?: string;
      selectionId: string;
      selectionKeySpecifier?: string;
      specifier?: string;
    }>,
  },
}));

vi.mock("@/store/couponStore", () => ({
  useCouponStore: () => ({
    addSelection: storeMocks.addSelection,
    mode: storeMocks.state.mode,
    removeSelection: storeMocks.removeSelection,
    selections: storeMocks.state.selections,
    showErrorDialog: storeMocks.showErrorDialog,
  }),
}));

vi.mock("@/lib/hooks/useOddsChangePulse", () => ({
  useOddsChangePulse: () => null,
}));

import { OddsButton } from "@/components/betting/OddsButton";

function renderOddsButton({
  label,
  marketID = 1601,
  marketName = "1X2 - 1UP",
  outcomeDisplayName = "Home",
  outcomeName = "Home",
  specifier = "",
}: {
  label?: string;
  marketID?: number;
  marketName?: string;
  outcomeDisplayName?: string;
  outcomeName?: string;
  specifier?: string;
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <OddsButton
        mode="fixture"
        selectionType="prematch"
        fixture={{
          awayTeam: "Brazil",
          date: "2026-07-12T12:00:00Z",
          homeTeam: "Argentina",
          matchID: "100",
          sportID: 1,
          sportName: "Football",
          tournamentName: "South America",
        } as never}
        market={{
          marketID,
          marketName,
          specifier,
        } as never}
        outcome={{
          active: 1,
          displayName: outcomeDisplayName,
          odds: 2.1,
          outcomeID: "1",
          outcomeName,
          specifier: "",
        } as never}
        label={label}
      />,
    );
  });

  return { container, root };
}

describe("OddsButton", () => {
  beforeEach(() => {
    storeMocks.addSelection.mockReset();
    storeMocks.removeSelection.mockReset();
    storeMocks.showErrorDialog.mockReset();
    storeMocks.state.mode = "real";
    storeMocks.state.selections = [];
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("treats a currentSelectionId match as selected and removes the stable selection id", () => {
    storeMocks.state.selections = [
      {
        currentSelectionId: "100_1601_1",
        selectionId: "100_1_1",
      },
    ];

    const { container, root } = renderOddsButton();
    const button = container.querySelector("button");
    expect(button?.className).toContain("selected");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storeMocks.removeSelection).toHaveBeenCalledWith("100_1_1");

    act(() => {
      root.unmount();
    });
  });

  it("does not mark the base odd selected when a derived odd is active", () => {
    storeMocks.state.selections = [
      {
        currentSelectionId: "100_1601_1_xup=1",
        selectionId: "100_1_1",
      },
    ];

    const { container, root } = renderOddsButton({
      marketID: 1,
      marketName: "1X2",
    });
    const button = container.querySelector("button");

    expect(button?.className).not.toContain("selected");

    act(() => {
      root.unmount();
    });
  });

  it("uses the market specifier when the derived outcome specifier is blank", () => {
    storeMocks.state.selections = [
      {
        currentSelectionId: "100_1601_1_xup=1",
        selectionId: "100_1_1",
      },
    ];

    const { container, root } = renderOddsButton({
      marketID: 1601,
      marketName: "1X2 - 1UP",
      specifier: "xup=1",
    });
    const button = container.querySelector("button");

    expect(button?.className).toContain("selected");

    act(() => {
      root.unmount();
    });
  });

  it("matches selected derived odds by normalized fields when id formats differ", () => {
    storeMocks.state.selections = [
      {
        currentSelectionId: "100_1601_1_xup_1",
        matchId: "100",
        marketId: "1601",
        outcomeId: "1",
        selectionId: "100_1_1",
        selectionKeySpecifier: "xup=1",
        specifier: "xup=1",
      },
    ];

    const { container, root } = renderOddsButton({
      marketID: 1601,
      marketName: "1X2 - 1UP",
      specifier: "xup=1",
    });
    const button = container.querySelector("button");

    expect(button?.className).toContain("selected");

    act(() => {
      root.unmount();
    });
  });

  it("stores semantic fixture outcome names while displaying a short odds label", () => {
    const { container, root } = renderOddsButton({
      label: "1",
      marketID: 1,
      marketName: "1X2",
      outcomeDisplayName: "1",
      outcomeName: "Home",
    });
    const button = container.querySelector("button");

    expect(button?.textContent).toContain("1");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storeMocks.addSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "1",
        outcomeName: "Home",
      }),
    );

    act(() => {
      root.unmount();
    });
  });
});
