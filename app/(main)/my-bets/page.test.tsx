// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  openCreateAccount: vi.fn(),
  openLogin: vi.fn(),
  performCashout: vi.fn(),
  routerPush: vi.fn(),
  useBetHistory: vi.fn(),
  useInfiniteBetHistory: vi.fn(),
}));

vi.mock("@/lib/query/hooks/useBets", () => ({
  useBetHistory: hookMocks.useBetHistory,
  useInfiniteBetHistory: hookMocks.useInfiniteBetHistory,
}));

vi.mock("@/lib/api/bets", () => ({
  betsApi: {
    performCashout: hookMocks.performCashout,
  },
}));

vi.mock("@/components/auth/AuthModalProvider", () => ({
  useAuthModal: () => ({
    openCreateAccount: hookMocks.openCreateAccount,
    openLogin: hookMocks.openLogin,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: hookMocks.routerPush,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import MyBetsPage from "@/app/(main)/(sportsbook)/(realtime)/my-bets/page";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";
import { useUserStore } from "@/store/userStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function resetStores() {
  localStorage.clear();
  useCouponStore.setState(useCouponStore.getInitialState(), true);
  useCouponStore.getState().clearSlip();
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useUserStore.setState(useUserStore.getInitialState(), true);
}

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MyBetsPage />);
  });

  return { container, root };
}

function waitForAsyncWork() {
  return Promise.resolve().then(() => Promise.resolve());
}

function betHistoryPage(bets: unknown[]) {
  return {
    data: {
      count: bets.length,
      currentPage: 1,
      data: bets,
      lastPage: 1,
      nextPage: 0,
      prevPage: 0,
    },
    status_code: 200,
    status_description: "success",
  };
}

const openBet = {
  betType: "single",
  created: "2026-07-06T18:11:00.000Z",
  id: 101,
  possibleWin: 243,
  selections: [
    {
      eventDate: "2026-07-06T18:11:00.000Z",
      eventName: "Mexico vs. South Africa",
      eventId: "fixture-1",
      eventTime: "94:24",
      marketName: "1X2",
      sportName: "Football",
      odds: 2.43,
      outcomeName: "Home",
      score: "3:3",
      matchStatus: "Overtime",
      statusDescription: "Pending",
    },
  ],
  cashoutAmount: 120,
  estimatedCashout: 120,
  shareCode: "HEN8ZS",
  stake: 100,
  status: -1,
  statusDescription: "Pending",
  totalOdd: 2.43,
};

const unavailableCashoutBet = {
  ...openBet,
  cashoutAmount: 120,
  estimatedCashout: 0,
  id: "bet-4",
  shareCode: "NOCASH",
};

const estimatedOnlyCashoutBet = {
  ...openBet,
  cashoutAmount: 0,
  estimatedCashout: 95,
  id: "bet-5",
  shareCode: "ESTCASH",
};

const partialCashoutBet = {
  ...openBet,
  id: "bet-6",
  selections: [
    {
      ...openBet.selections[0],
      eventName: "Partial Cashout FC vs. Open Ticket FC",
    },
  ],
  status: 5,
  statusDescription: "Partial Cashout",
};

const settledBet = {
  betType: "single",
  created: "2026-07-05T18:11:00.000Z",
  id: "bet-2",
  possibleWin: 243,
  selections: [
    {
      eventDate: "2026-07-05T18:11:00.000Z",
      eventName: "Bayern Munich vs. Borussia Dortmund",
      marketName: "1X2",
      odds: 2.43,
      outcomeName: "Away",
      statusDescription: "Lost",
    },
  ],
  shareCode: "QBBD8R",
  stake: 100,
  statusDescription: "Lost",
  totalOdd: 2.43,
};

const wonBet = {
  ...settledBet,
  id: "bet-3",
  shareCode: "WON123",
  statusDescription: "Won",
};

describe("MyBetsPage", () => {
  beforeEach(() => {
    resetStores();
    hookMocks.openCreateAccount.mockReset();
    hookMocks.openLogin.mockReset();
    hookMocks.performCashout.mockReset();
    hookMocks.routerPush.mockReset();
    hookMocks.useBetHistory.mockReset();
    hookMocks.useInfiniteBetHistory.mockReset();
    hookMocks.useBetHistory.mockReturnValue({
      data: betHistoryPage([]),
    });
    useAuthStore.setState((state) => ({ ...state, hasHydrated: true, isAuthenticated: true }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("requests pending-only data for Open Bets and shows history filters on the Bet History tab", async () => {
    hookMocks.useBetHistory.mockReturnValue({
      data: betHistoryPage([openBet, partialCashoutBet]),
    });
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet, partialCashoutBet, settledBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenCalledWith(
      expect.objectContaining({ status: [-1, 5] }),
      true,
    );
    expect(container.textContent).toContain("Open Bets (2)");
    expect(container.textContent).not.toContain("All Bets");
    expect(container.textContent).toContain("Mexico vs. South Africa");
    expect(container.textContent).toContain("Partial Cashout FC vs. Open Ticket FC");
    expect(container.textContent).toContain("Cashout");
    expect(container.textContent).not.toContain("QBBD8R");

    const historyTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Bet History"),
    );
    expect(historyTabButton).toBeTruthy();

    await act(async () => {
      historyTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("AllPendingSettled");
    expect(container.textContent).not.toContain("Event Type: All Events");
    expect(container.querySelector('button[aria-label="Open bet history filters"]')).toBeTruthy();
    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: undefined }),
      true,
    );
    expect(container.textContent).toContain("Bayern Munich vs. Borussia Dortmund");
    expect(container.textContent).toContain("Booking code: HEN8ZS");
    expect(container.textContent).not.toContain("QBBD8R");

    const pendingTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Pending",
    );
    expect(pendingTab).toBeTruthy();

    await act(async () => {
      pendingTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: -1 }),
      true,
    );
    expect(container.textContent).toContain("AllPendingSettled");

    const settledTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Settled",
    );
    expect(settledTab).toBeTruthy();

    await act(async () => {
      settledTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: [0, 1, 4, 5, 6, 7] }),
      true,
    );

    act(() => {
      root.unmount();
    });
  });

  it("filters open bets by event type through the bet endpoint", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();

    expect(container.textContent).toContain("Event Type: All Events");

    const eventTypeTrigger = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Event Type: All Events"),
    );
    expect(eventTypeTrigger).toBeTruthy();

    await act(async () => {
      eventTypeTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const liveOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Live",
    );
    expect(liveOption).toBeTruthy();

    await act(async () => {
      liveOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event_type: "live",
        status: [-1, 5],
      }),
      true,
    );

    act(() => {
      root.unmount();
    });
  });

  it("filters bet history by bet type and result status through the bet endpoint", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([settledBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();
    const historyTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Bet History"),
    );

    await act(async () => {
      historyTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const filterTrigger = container.querySelector('button[aria-label="Open bet history filters"]');
    expect(filterTrigger).toBeTruthy();

    await act(async () => {
      filterTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Bet result");
    expect(container.textContent).toContain("Bet type");

    const flexOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Flex",
    );
    expect(flexOption).toBeTruthy();

    await act(async () => {
      flexOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bet_type: "flex",
        status: undefined,
      }),
      true,
    );

    const voidedOption = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Voided",
    );
    expect(voidedOption).toBeTruthy();

    await act(async () => {
      voidedOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.useInfiniteBetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bet_type: "flex",
        event_type: undefined,
        status: 7,
      }),
      true,
    );
    expect(container.textContent).toContain("AllPendingSettled");
    expect(container.textContent).toContain("Voided");

    act(() => {
      root.unmount();
    });
  });

  it("renders bet history correctly from the bet-service page envelope", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet, settledBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();
    const historyTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Bet History"),
    );

    await act(async () => {
      historyTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Mexico vs. South Africa");
    expect(container.textContent).toContain("Bayern Munich vs. Borussia Dortmund");

    act(() => {
      root.unmount();
    });
  });

  it("routes bet history cards to the dedicated ticket detail page", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet, settledBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();
    const historyTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Bet History"),
    );

    await act(async () => {
      historyTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const detailButton = Array.from(container.querySelectorAll("article[role='button']")).find((button) =>
      button.textContent?.includes("Bayern Munich vs. Borussia Dortmund"),
    );
    expect(detailButton).toBeTruthy();

    await act(async () => {
      detailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.routerPush).toHaveBeenCalledWith("/my-bets/bet-2");

    act(() => {
      root.unmount();
    });
  });

  it("expands an open bet inline so pending selections are visible", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();
    const openBetButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("View match details"),
    );
    expect(openBetButton).toBeTruthy();

    act(() => {
      openBetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Hide match details");
    expect(container.textContent).toContain("Mexico vs. South Africa");
    expect(container.textContent).toContain("94' Overtime");
    expect(container.textContent).toContain("3 - 3");
    expect(container.textContent).toContain("Cashout");
    const liveSelectionLink = container.querySelector('a[href="/live/football/fixture-1"]');
    expect(liveSelectionLink).toBeTruthy();
    const drawer = container.querySelector(".fixed .absolute.inset-y-0.right-0");
    expect(drawer).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("submits cashout from an open bet and hides the ticket after success", async () => {
    const refetch = vi.fn(async () => {});
    hookMocks.performCashout.mockResolvedValue({
      status_code: 200,
      status_description: "Cashout successful",
    });
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([openBet])],
      },
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch,
    }));

    const { container, root } = renderPage();
    const cashoutButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Cashout NGN 120.00"),
    );
    expect(cashoutButton).toBeTruthy();

    await act(async () => {
      cashoutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Confirm NGN 120.00");

    const cashoutSlider = container.querySelector('input[aria-label="Cashout amount"]') as HTMLInputElement | null;
    expect(cashoutSlider).toBeTruthy();

    await act(async () => {
      if (cashoutSlider) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(cashoutSlider, "60");
        cashoutSlider.dispatchEvent(new Event("input", { bubbles: true }));
        cashoutSlider.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Partial Cashout");
    expect(container.textContent).toContain("Confirm NGN 60.00");

    const confirmButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Confirm NGN 60.00"),
    );
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    await act(async () => {
      await waitForAsyncWork();
    });

    expect(hookMocks.performCashout).toHaveBeenCalledWith({
      betId: 101,
      percent: 0.5,
      source: "mobile",
    });
    expect(refetch).toHaveBeenCalled();
    expect(container.textContent).not.toContain("Confirm NGN 60.00");

    await act(async () => {
      await waitForAsyncWork();
    });

    act(() => {
      root.unmount();
    });
  });

  it("routes won tickets to their detail page from bet history", async () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([wonBet])],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();
    const historyTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Bet History"),
    );

    await act(async () => {
      historyTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const detailButton = Array.from(container.querySelectorAll("article[role='button']")).find((button) =>
      button.textContent?.includes("Bayern Munich vs. Borussia Dortmund"),
    );
    expect(detailButton).toBeTruthy();
    expect(container.textContent).not.toContain("WON123");
    expect(container.innerHTML).toContain("text-accent-green");

    await act(async () => {
      detailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(hookMocks.routerPush).toHaveBeenCalledWith("/my-bets/bet-3");

    act(() => {
      root.unmount();
    });
  });

  it("uses estimated cashout, not cashout amount, to determine cashout availability", () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([unavailableCashoutBet])],
      },
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    }));

    const { container, root } = renderPage();

    const unavailableButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Cashout unavailable"),
    );
    expect(unavailableButton).toBeTruthy();
    expect(unavailableButton?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).not.toContain("Cashout NGN 120.00");

    act(() => {
      root.unmount();
    });
  });

  it("shows estimated cashout amount when cashout is available but cashout amount is zero", () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [betHistoryPage([estimatedOnlyCashoutBet])],
      },
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    }));

    const { container, root } = renderPage();

    const cashoutButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Cashout NGN 95.00"),
    );
    expect(cashoutButton).toBeTruthy();
    expect(cashoutButton?.hasAttribute("disabled")).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  it("renders an explicit error state instead of an empty state when bet history fails", () => {
    hookMocks.useInfiniteBetHistory.mockImplementation(() => ({
      data: {
        pages: [],
      },
      error: new Error("Invalid request body"),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: true,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
    }));

    const { container, root } = renderPage();

    expect(container.textContent).toContain("Unable to load bets");
    expect(container.textContent).toContain("Invalid request body");
    expect(container.textContent).not.toContain("No open bets");

    act(() => {
      root.unmount();
    });
  });
});
