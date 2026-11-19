// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  betsApi: {
    assignCustomCode: vi.fn(),
    createCustomCode: vi.fn(),
    getCustomCodes: vi.fn(async () => ({
      data: [{ code_string: "myhandle" }],
      status_code: 200,
    })),
    placeBet: vi.fn(),
  },
  useCodeHub: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}));

import { BetSlip } from "@/components/betting/BetSlip";
import { useAuthStore } from "@/store/authStore";
import { useCouponStore } from "@/store/couponStore";
import { useUserStore } from "@/store/userStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
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

vi.mock("@/lib/api/bets", () => ({ betsApi: apiMocks.betsApi }));

vi.mock("@/lib/query/hooks/useBets", () => ({
  useCodeHub: apiMocks.useCodeHub,
}));

vi.mock("@/components/auth/AuthModalProvider", () => ({
  useAuthModal: () => ({
    closeAuthModal: vi.fn(),
    openCreateAccount: vi.fn(),
    openForgotPassword: vi.fn(),
    openLogin: vi.fn(),
  }),
}));

type MockApiResponse = Awaited<ReturnType<typeof apiMocks.betsApi.getCustomCodes>>;

function buildSimulationSelection(
  selectionId: string,
  matchId: string,
  eventName: string,
  homeTeam: string,
  awayTeam: string,
) {
  return {
    currentSelectionId: selectionId,
    displayName: "1",
    eventId: matchId,
    eventName,
    fixture: {
      awayTeam,
      homeTeam,
      market: [],
      matchID: matchId,
      outcomes: [],
      sportID: 1,
    },
    homeTeam,
    id: selectionId,
    marketId: "1",
    marketName: "1X2",
    matchId,
    odds: 2.2,
    outcome: {
      displayName: "1",
      marketID: 1,
      outcomeID: "1",
      outcomeName: "Home",
    },
    outcomeId: "1",
    outcomeName: "Home",
    selectionId,
    selectionKeySpecifier: "",
    specifier: "",
    sportId: 1,
    sportName: "Football",
    type: "prematch" as const,
  };
}

function buildSimulationEvent(matchId: string, homeGoals: number, awayGoals: number) {
  const goalEvents = [];

  if (homeGoals > 0) {
    goalEvents.push({
      minute: 12,
      team: "home" as const,
      type: "goal",
    });
  }

  if (awayGoals > 0) {
    goalEvents.push({
      minute: 54,
      team: "away" as const,
      type: "goal",
    });
  }

  if (homeGoals > 1) {
    goalEvents.push({
      minute: 77,
      team: "home" as const,
      type: "goal",
    });
  }

  return {
    awayGoals,
    finalScoreText: `${homeGoals}-${awayGoals}`,
    goalEvents,
    homeGoals,
    matchId,
    rawTimeline: goalEvents.map((goal) => ({ ...goal })),
    status: "ended",
  };
}

function resetStores() {
  localStorage.clear();
  useCouponStore.setState(useCouponStore.getInitialState(), true);
  useCouponStore.getState().clearSlip();
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useUserStore.setState(useUserStore.getInitialState(), true);
}

function waitForAsyncWork() {
  return Promise.resolve();
}

function renderBetSlip() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<BetSlip />);
  });

  return { container, root };
}

describe("BetSlip simulation UI", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    apiMocks.betsApi.getCustomCodes.mockClear();
    apiMocks.betsApi.createCustomCode.mockClear();
    apiMocks.betsApi.assignCustomCode.mockClear();
    apiMocks.betsApi.placeBet.mockClear();
    apiMocks.useCodeHub.mockClear();
    apiMocks.useCodeHub.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    useUserStore.setState((state) => ({
      ...state,
      currentUser: {
        availableBalance: 1250,
        casinoBonusBalance: 0,
        currency: "NGN",
        id: "1",
        sportBonusBalance: 0,
        trustBalance: 0,
        username: "tester",
        virtualBonusBalance: 0,
      },
    }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the running simulation state, schedules timer ticks, and shows the stage-driven media", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 2,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 2,
    }));
    const advanceSimulation = vi.fn();
    const skipSimulationToResults = vi.fn();
    const dismissSimulation = vi.fn();
    const selectionOne = buildSimulationSelection(
      "sel-430",
      "430",
      "Mexico vs. South Africa",
      "Mexico",
      "South Africa",
    );
    const selectionTwo = buildSimulationSelection(
      "sel-431",
      "431",
      "Bayern Munich vs. Borussia Dortmund",
      "Bayern Munich",
      "Borussia Dortmund",
    );

    useCouponStore.setState((state) => ({
      ...state,
      advanceSimulation: advanceSimulation as typeof state.advanceSimulation,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      dismissSimulation: dismissSimulation as typeof state.dismissSimulation,
      isOpen: true,
      mode: "sim",
      selections: [selectionOne, selectionTwo],
      simulation: {
        ...state.simulation,
        currentStage: "h1_home_clip",
        currentTimeSec: 4.2,
        eventsByMatchId: {
          "430": buildSimulationEvent("430", 2, 1),
          "431": buildSimulationEvent("431", 1, 0),
        },
        potentialWin: 440,
        primarySelectionId: "sel-430",
        scorePhase: 1,
        status: "running",
        timerEnded: false,
        timerStarted: true,
        totalStake: 100,
        updateIntervalMs: 100,
      },
      skipSimulationToResults: skipSimulationToResults as typeof state.skipSimulationToResults,
      totalOdds: 4.4,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("Skip to Results");
    expect(container.textContent).toContain("15'");
    expect(container.querySelector(".fixed.inset-0")).toBeTruthy();
    expect(container.querySelector(".shadow-sheet")).toBeTruthy();
    expect(container.querySelector("button[aria-label=\"Close betslip\"]")).toBeNull();
    expect(
      container.querySelector('img[alt="Simulation pitch"]')?.getAttribute("src"),
    ).toContain("/images/SIM/Home_Goal_H1.gif");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(bootstrapSlip).not.toHaveBeenCalled();
    expect(advanceSimulation).toHaveBeenCalledTimes(1);

    const skipButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Skip to Results"),
    );
    expect(skipButton).toBeTruthy();

    act(() => {
      skipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(skipSimulationToResults).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("freezes the simulation clock and progress bar at halftime", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 2,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 2,
    }));
    const selectionOne = buildSimulationSelection(
      "sel-430",
      "430",
      "Mexico vs. South Africa",
      "Mexico",
      "South Africa",
    );
    const selectionTwo = buildSimulationSelection(
      "sel-431",
      "431",
      "Bayern Munich vs. Borussia Dortmund",
      "Bayern Munich",
      "Borussia Dortmund",
    );

    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      mode: "sim",
      selections: [selectionOne, selectionTwo],
      simulation: {
        ...state.simulation,
        currentStage: "halftime_intro",
        currentTimeSec: 13.5,
        eventsByMatchId: {
          "430": buildSimulationEvent("430", 2, 1),
          "431": buildSimulationEvent("431", 1, 0),
        },
        potentialWin: 440,
        primarySelectionId: "sel-430",
        scorePhase: 2,
        status: "running",
        timerEnded: false,
        timerStarted: true,
        totalStake: 100,
      },
      totalOdds: 4.4,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();
    const progressBarIsFrozenAtHalf = Array.from(container.querySelectorAll("div")).some((node) =>
      node.getAttribute("style")?.includes("width: 50%"),
    );

    expect(container.textContent).toContain("Half time");
    expect(container.textContent).toContain("45'");
    expect(progressBarIsFrozenAtHalf).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("links selection fixture names to their fixture detail pages", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));
    const selection = buildSimulationSelection(
      "sel-430",
      "430",
      "Mexico vs. South Africa",
      "Mexico",
      "South Africa",
    );

    useCouponStore.setState((state) => ({
      ...state,
      betType: "Multiple",
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      mode: "real",
      selections: [selection],
      totalOdds: 2.2,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();

    expect(container.querySelector('a[href="/sports/football/430"]')?.textContent).toContain(
      "Mexico vs. South Africa",
    );

    act(() => {
      root.unmount();
    });
  });

  it("renders completed simulation state with the full-time pitch and OK dismissal", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 2,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 2,
    }));
    const dismissSimulation = vi.fn();
    const selectionOne = buildSimulationSelection(
      "sel-430",
      "430",
      "Mexico vs. South Africa",
      "Mexico",
      "South Africa",
    );
    const selectionTwo = buildSimulationSelection(
      "sel-431",
      "431",
      "Bayern Munich vs. Borussia Dortmund",
      "Bayern Munich",
      "Borussia Dortmund",
    );

    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      dismissSimulation: dismissSimulation as typeof state.dismissSimulation,
      isOpen: true,
      mode: "sim",
      selections: [selectionOne, selectionTwo],
      simulation: {
        ...state.simulation,
        currentStage: "fulltime",
        currentTimeSec: 25,
        eventsByMatchId: {
          "430": buildSimulationEvent("430", 2, 1),
          "431": buildSimulationEvent("431", 1, 0),
        },
        potentialWin: 440,
        primarySelectionId: "sel-430",
        resultAmountWon: 275,
        scorePhase: 4,
        selectionResultsBySelectionKey: {
          "430:1:1:": {
            marketId: "1",
            matchId: "430",
            outcomeId: "1",
            specifier: "",
            won: true,
          },
        },
        status: "complete",
        timerEnded: true,
        timerStarted: true,
        totalStake: 100,
        winModalShown: false,
      },
      totalOdds: 4.4,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("OK");
    expect(container.textContent).toContain("FULL TIME");
    expect(container.textContent).toContain("2 - 1");
    expect(container.textContent).toContain("Won");
    expect(container.textContent).not.toContain("Final Score");
    expect(container.textContent).not.toContain("Simulation Win");
    expect(
      container.querySelector('img[alt="Simulation pitch"]')?.getAttribute("src"),
    ).toContain("/images/SIM/Away_Goal_H2.gif");

    const okButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "OK",
    );

    act(() => {
      okButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(bootstrapSlip).not.toHaveBeenCalled();
    expect(dismissSimulation).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("keeps the full-time pitch visible when a simulation ticket is lost", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 2,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 2,
    }));
    const selectionOne = buildSimulationSelection(
      "sel-430",
      "430",
      "Mexico vs. South Africa",
      "Mexico",
      "South Africa",
    );
    const selectionTwo = buildSimulationSelection(
      "sel-431",
      "431",
      "Bayern Munich vs. Borussia Dortmund",
      "Bayern Munich",
      "Borussia Dortmund",
    );

    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      mode: "sim",
      selections: [selectionOne, selectionTwo],
      simulation: {
        ...state.simulation,
        currentStage: "fulltime",
        currentTimeSec: 25,
        eventsByMatchId: {
          "430": buildSimulationEvent("430", 0, 1),
          "431": buildSimulationEvent("431", 2, 0),
        },
        potentialWin: 440,
        primarySelectionId: "sel-430",
        resultAmountWon: 0,
        scorePhase: 4,
        selectionResultsBySelectionKey: {
          "430:1:1:": {
            marketId: "1",
            matchId: "430",
            outcomeId: "1",
            specifier: "",
            won: false,
          },
        },
        status: "complete",
        timerEnded: true,
        timerStarted: true,
        totalStake: 100,
        winModalShown: true,
      },
      totalOdds: 4.4,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("FULL TIME");
    expect(container.textContent).toContain("0 - 1");
    expect(container.textContent).toContain("Lost");
    expect(container.textContent).not.toContain("Simulation Win");

    act(() => {
      root.unmount();
    });
  });

  it("shows the full-time pitch for a won simulation even if the timer flag lags", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));
    const selection = buildSimulationSelection(
      "sel-430",
      "430",
      "Arsenal FC vs Chelsea FC",
      "Arsenal FC",
      "Chelsea FC",
    );

    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      mode: "sim",
      selections: [selection],
      simulation: {
        ...state.simulation,
        currentStage: "h2_away_banner",
        currentTimeSec: 25,
        eventsByMatchId: {
          "430": buildSimulationEvent("430", 2, 1),
        },
        potentialWin: 214.02,
        primarySelectionId: "sel-430",
        resultAmountWon: 214.02,
        scorePhase: 4,
        selectionResultsBySelectionKey: {
          "430:1:1:": {
            marketId: "1",
            matchId: "430",
            outcomeId: "1",
            specifier: "",
            won: true,
          },
        },
        status: "complete",
        timerEnded: false,
        timerStarted: true,
        totalStake: 100,
        winModalShown: false,
      },
      totalOdds: 2.2,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("FULL TIME");
    expect(container.textContent).toContain("2 - 1");
    expect(container.textContent).toContain("Won");
    expect(container.textContent).not.toContain("Simulation Win");

    act(() => {
      root.unmount();
    });
  });

  it("allows book bet while logged out and does not use the place-bet auth gate", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));
    const bookBet = vi.fn(async () => ({}));

    useAuthStore.setState((state) => ({ ...state, isAuthenticated: false }));
    useCouponStore.setState((state) => ({
      ...state,
      bookBet: bookBet as typeof state.bookBet,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-book-1", "9001", "A vs B", "A", "B")],
      stake: 100,
      totalStake: 100,
    }));

    const { container, root } = renderBetSlip();
    const bookButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Book Bet"),
    );

    expect(bookButton).toBeTruthy();
    expect(bookButton?.disabled).toBe(false);

    await act(async () => {
      bookButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(bookBet).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("shows booking-code success copy for book bet success", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    useAuthStore.setState((state) => ({ ...state, isAuthenticated: false }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "BOOK12",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "book",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-book-2", "9002", "C vs D", "C", "D")],
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("Bet booked");
    expect(container.textContent).toContain("Booking Code Created");
    expect(container.textContent).not.toContain("Bet Successful");

    act(() => {
      root.unmount();
    });
  });

  it("shows the custom-code CTA only for authenticated success state and opens the existing-code flow", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "LURYL4",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "place",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-500", "500", "A vs B", "A", "B")],
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("Custom Code");
    const createButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create"),
    );
    expect(createButton).toBeTruthy();

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(apiMocks.betsApi.getCustomCodes).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Select a custom code");
    expect(container.textContent).toContain("myhandle");
    expect(container.textContent).not.toContain("Open Bets");

    act(() => {
      root.unmount();
    });
  });

  it("keeps place bet enabled when single selections have per-selection stakes but base stake is zero", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 2,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 2,
    }));
    const firstSelection = buildSimulationSelection("sel-510", "510", "A vs B", "A", "B");
    const secondSelection = buildSimulationSelection("sel-511", "511", "C vs D", "C", "D");

    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      globalVars: { ...state.globalVars, singleMinStake: 100 },
      isOpen: true,
    }));

    const store = useCouponStore.getState();
    await act(async () => {
      store.addSelection(firstSelection);
      store.addSelection(secondSelection);
      store.setBetType("Single");
      store.updateStake(0);
      const [normalizedFirstSelection, normalizedSecondSelection] = useCouponStore.getState().selections;
      store.updateStake(120, normalizedFirstSelection.selectionId);
      store.updateStake(80, normalizedSecondSelection.selectionId);
      await waitForAsyncWork();
    });

    const { container, root } = renderBetSlip();
    const placeBetButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Place Bet"),
    );

    expect(useCouponStore.getState().stake).toBe(0);
    expect(useCouponStore.getState().totalStake).toBe(200);
    expect(placeBetButton).toBeTruthy();
    expect(placeBetButton?.disabled).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  it("shows every available system stake row for a nine-selection slip", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 9,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 9,
    }));

    useCouponStore.setState((state) => ({
      ...state,
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
    }));

    const store = useCouponStore.getState();
    await act(async () => {
      for (let index = 0; index < 9; index += 1) {
        store.addSelection(
          buildSimulationSelection(
            `sel-${520 + index}`,
            String(520 + index),
            `Team ${index} vs Opponent ${index}`,
            `Team ${index}`,
            `Opponent ${index}`,
          ),
        );
      }
      store.setBetType("System");
      await waitForAsyncWork();
    });

    const { container, root } = renderBetSlip();

    expect(container.textContent).toContain("Play All");
    expect(container.textContent).toContain("Double");
    expect(container.textContent).toContain("Treble");
    expect(container.textContent).toContain("4 folds");
    expect(container.textContent).toContain("5 folds");
    expect(container.textContent).toContain("6 folds");
    expect(container.textContent).toContain("7 folds");
    expect(container.textContent).toContain("8 folds");
    expect(container.textContent).toContain("9 folds");

    act(() => {
      root.unmount();
    });
  });

  it("assigns an existing custom code from the success flow", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    apiMocks.betsApi.assignCustomCode.mockResolvedValueOnce({ status_code: 200 });
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "LURYL4",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "place",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-502", "502", "E vs F", "E", "F")],
    }));

    const { container, root } = renderBetSlip();
    const createButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create"),
    );

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const useButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Use"),
    );
    expect(useButton).toBeTruthy();

    await act(async () => {
      useButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(apiMocks.betsApi.assignCustomCode).toHaveBeenCalledWith("myhandle", {
      system_code: "LURYL4",
    });
    expect(container.textContent).toContain("Custom code assigned");
    expect(container.textContent).toContain("myhandle");

    act(() => {
      root.unmount();
    });
  });

  it("supports custom-code list responses in the custom-code success flow", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    apiMocks.betsApi.getCustomCodes.mockResolvedValueOnce({
      data: [{ code_string: "NestedCode" }],
      status_code: 200,
    } as MockApiResponse);
    apiMocks.betsApi.assignCustomCode.mockResolvedValueOnce({
      data: {
        active_system_code: "LURYL4",
        code_string: "NestedCode",
        status: "assigned",
      },
      status_code: 200,
      status_description: "Custom code assigned",
    } as MockApiResponse);
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "LURYL4",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "place",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-5021", "5021", "Nested vs Wrapper", "Nested", "Wrapper")],
    }));

    const { container, root } = renderBetSlip();
    const createButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create"),
    );

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("NestedCode");
    const useButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Use"),
    );

    await act(async () => {
      useButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(apiMocks.betsApi.assignCustomCode).toHaveBeenCalledWith("NestedCode", {
      system_code: "LURYL4",
    });
    expect(container.textContent).toContain("Custom code assigned");
    expect(container.textContent).toContain("NestedCode");

    act(() => {
      root.unmount();
    });
  });

  it("creates and assigns a new custom code when no existing codes are returned", async () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    apiMocks.betsApi.getCustomCodes.mockResolvedValueOnce({
      data: [],
      status_code: 200,
    });
    apiMocks.betsApi.createCustomCode.mockResolvedValueOnce({
      data: { code_string: "FreshCode", status: "unassigned" },
      status_code: 201,
      status_description: "Custom code created",
    });
    apiMocks.betsApi.assignCustomCode.mockResolvedValueOnce({
      data: {
        active_system_code: "LURYL4",
        code_string: "FreshCode",
        status: "assigned",
      },
      status_code: 200,
      status_description: "Custom code assigned",
    });
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "LURYL4",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "place",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-503", "503", "G vs H", "G", "H")],
    }));

    const { container, root } = renderBetSlip();
    const createButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create"),
    );

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    const input = container.querySelector('input[placeholder="CustomCode"]') as HTMLInputElement | null;
    const attachButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Attach"),
    );
    expect(input).toBeTruthy();
    expect(attachButton).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(input, "FreshCode");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await waitForAsyncWork();
    });

    await act(async () => {
      attachButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await waitForAsyncWork();
    });

    expect(apiMocks.betsApi.createCustomCode).toHaveBeenCalledWith({ suffix: "FreshCode" });
    expect(apiMocks.betsApi.assignCustomCode).toHaveBeenCalledWith("FreshCode", {
      system_code: "LURYL4",
    });
    expect(container.textContent).toContain("Custom code assigned");
    expect(container.textContent).toContain("FreshCode");

    act(() => {
      root.unmount();
    });
  });

  it("hides the custom-code CTA for unauthenticated success state", () => {
    const bootstrapSlip = vi.fn(async () => ({
      activeSelectionCount: 1,
      canProceed: true,
      hasChanges: false,
      reason: "ok" as const,
      validatedSelectionCount: 1,
    }));

    useAuthStore.setState((state) => ({ ...state, isAuthenticated: false }));
    useCouponStore.setState((state) => ({
      ...state,
      betPlaced: {
        bookingCode: "LURYL4",
        potentialWin: 900,
        response: {},
        totalStake: 100,
        type: "place",
      },
      bootstrapSlip: bootstrapSlip as typeof state.bootstrapSlip,
      isOpen: true,
      selections: [buildSimulationSelection("sel-501", "501", "C vs D", "C", "D")],
    }));

    const { container, root } = renderBetSlip();

    expect(container.textContent).not.toContain("Custom Code");
    expect(container.textContent).not.toContain("Attach a reusable handle");

    act(() => {
      root.unmount();
    });
  });
});
