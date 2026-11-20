import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => {
  const resolveOdds = (marketId: number, specifier = "") => {
    if (marketId === 1601 && specifier.includes("xup=1")) return 1.84;
    if (marketId === 1601 && specifier.includes("xup=2")) return 1.72;
    if (marketId === 60180) return 1.18;
    if (marketId === 18) return specifier.includes("total=3.5") ? 1.98 : 1.66;
    if (marketId === 1) return 2.2;
    return 1.5;
  };

  return {
    authApi: {
      getDetails: vi.fn(async () => ({
        data: {
          availableBalance: 1200,
          currency: "NGN",
          username: "8037768166",
        },
      })),
      getGlobalVars: vi.fn(async () => ({ data: { Currency: "NGN", MinBonusOdd: 1 } })),
    },
    betsApi: {
      getFeatureConfig: vi.fn(async () => ({
        data: {
          accaBonus: { is_active: true, status: "active" },
          cutOne: {
            is_active: true,
            min_odds_per_leg: 1.3,
            min_selections: 2,
            status: "active",
          },
          flex: {
            is_active: true,
            max_selections: 10,
            min_selections: 2,
            status: "active",
          },
          stakeLimits: null,
        },
      })),
      loadByCode: vi.fn(),
      placeBet: vi.fn(async (payload: unknown) => ({
        data: {
          bets: [
            {
              possibleWin: 900,
              potential_payout: 900,
              share_code: "LURYL4",
            },
          ],
          payload,
          share_code: "LURYL4",
        },
        status_code: 200,
      })),
      previewAccaBonus: vi.fn(async () => ({
        data: {
          bonus_amount: 35,
          enabled: true,
          potential_returns: 285,
        },
        status_code: 200,
      })),
      previewCutOne: vi.fn(async () => ({
        data: {
          cut_one_odds: 2.4,
          enabled: true,
          potential_payout: 240,
          qualifies: true,
        },
        status_code: 200,
      })),
      previewFlex: vi.fn(async () => ({
        data: {
          enabled: true,
          flex_odds: 3.1,
          potential_payout: 310,
          qualifies: true,
        },
        status_code: 200,
      })),
      reportBetslipActivity: vi.fn(async () => ({
        data: { ok: true },
        status_code: 200,
      })),
      reportBetslipAbandoned: vi.fn(async () => ({
        data: { ok: true },
        status_code: 200,
      })),
      closeBetslipSession: vi.fn(async () => ({
        data: { ok: true },
        status_code: 200,
      })),
      validateSelections: vi.fn(async (payload: unknown) => {
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { selections?: unknown[] } | undefined)?.selections)
            ? (payload as { selections: unknown[] }).selections
            : [];

        return {
          data: items.map((item) => {
            const source = item as Record<string, unknown>;
            const marketId = Number(source.market_id ?? source.marketId ?? 0);
            const specifier = String(source.specifier ?? "");
            return {
              market_id: marketId,
              odds: resolveOdds(marketId, specifier),
              outcome_id: String(source.outcome_id ?? source.outcomeId ?? ""),
              specifier,
              status_name: "Active",
            };
          }),
          status_code: 200,
        };
      }),
    },
    contentApi: {
      getBonusList: vi.fn(async () => ({ data: [] })),
    },
    sportsApi: {
      getFixtureMarkets: vi.fn(async () => ({ market: [], outcomes: [] })),
    },
    mqttService: {
      subscribeMqttTopic: vi.fn(() => vi.fn()),
    },
  };
});

vi.mock("@/lib/api/auth", () => ({ authApi: apiMocks.authApi }));
vi.mock("@/lib/api/bets", () => ({ betsApi: apiMocks.betsApi }));
vi.mock("@/lib/api/content", () => ({ contentApi: apiMocks.contentApi }));
vi.mock("@/lib/api/sports", () => ({ sportsApi: apiMocks.sportsApi }));
vi.mock("@/lib/services/mqttService", () => apiMocks.mqttService);

type PlaceBetResponse = Awaited<ReturnType<typeof apiMocks.betsApi.placeBet>>;
type ValidateSelectionsResponse = Awaited<ReturnType<typeof apiMocks.betsApi.validateSelections>>;

import { useCouponStore } from "@/store/couponStore";
import { ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

function waitForAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function resetStore() {
  localStorage.clear();
  useCouponStore.getState().stopAbandonedBetslipTracker();
  useCouponStore.getState().stopBetslipRealtimeSync();
  useCouponStore.setState(useCouponStore.getInitialState(), true);
  useCouponStore.getState().clearSlip();
  useUserStore.getState().reset();
  useAuthStore.setState((state) => ({ ...state, isAuthenticated: false, token: null }));
}

function configureFeatures() {
  useCouponStore.setState((state) => ({
    ...state,
    bonusList: [],
    globalVars: { Currency: "NGN", MinBonusOdd: 1 },
    isConfigLoaded: true,
    sportsbookFeatureConfig: {
      accaBonus: { is_active: true, status: "active" },
      cutOne: {
        is_active: true,
        min_odds_per_leg: 1.3,
        min_selections: 2,
        status: "active",
      },
      flex: {
        is_active: true,
        max_selections: 10,
        min_selections: 2,
        status: "active",
      },
      stakeLimits: null,
    },
  }));
}

function restoreApiMockImplementations() {
  apiMocks.authApi.getDetails.mockImplementation(async () => ({
    data: {
      availableBalance: 1200,
      currency: "NGN",
      username: "8037768166",
    },
  }));
  apiMocks.authApi.getGlobalVars.mockImplementation(async () => ({
    data: { Currency: "NGN", MinBonusOdd: 1 },
  }));
  apiMocks.betsApi.getFeatureConfig.mockImplementation(async () => ({
    data: {
      accaBonus: { is_active: true, status: "active" },
      cutOne: {
        is_active: true,
        min_odds_per_leg: 1.3,
        min_selections: 2,
        status: "active",
      },
      flex: {
        is_active: true,
        max_selections: 10,
        min_selections: 2,
        status: "active",
      },
      stakeLimits: null,
    },
  }));
  apiMocks.betsApi.placeBet.mockImplementation(async (payload: unknown) => ({
    data: {
      bets: [
        {
          possibleWin: 900,
          potential_payout: 900,
          share_code: "LURYL4",
        },
      ],
      payload,
      share_code: "LURYL4",
    },
    status_code: 200,
  }));
  apiMocks.betsApi.previewAccaBonus.mockImplementation(async () => ({
    data: {
      bonus_amount: 35,
      enabled: true,
      potential_returns: 285,
    },
    status_code: 200,
  }));
  apiMocks.betsApi.previewCutOne.mockImplementation(async () => ({
    data: {
      cut_one_odds: 2.4,
      enabled: true,
      potential_payout: 240,
      qualifies: true,
    },
    status_code: 200,
  }));
  apiMocks.betsApi.previewFlex.mockImplementation(async () => ({
    data: {
      enabled: true,
      flex_odds: 3.1,
      potential_payout: 310,
      qualifies: true,
    },
    status_code: 200,
  }));
  apiMocks.betsApi.reportBetslipActivity.mockImplementation(async () => ({
    data: { ok: true },
    status_code: 200,
  }));
  apiMocks.betsApi.reportBetslipAbandoned.mockImplementation(async () => ({
    data: { ok: true },
    status_code: 200,
  }));
  apiMocks.betsApi.closeBetslipSession.mockImplementation(async () => ({
    data: { ok: true },
    status_code: 200,
  }));
  apiMocks.betsApi.validateSelections.mockImplementation(async (payload: unknown) => {
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { selections?: unknown[] } | undefined)?.selections)
        ? (payload as { selections: unknown[] }).selections
        : [];

    return {
      data: items.map((item) => {
        const source = item as Record<string, unknown>;
        const marketId = Number(source.market_id ?? source.marketId ?? 0);
        const specifier = String(source.specifier ?? "");
        return {
          market_id: marketId,
          odds:
            marketId === 1601 && specifier.includes("xup=1") ? 1.84
            : marketId === 1601 && specifier.includes("xup=2") ? 1.72
            : marketId === 60180 ? 1.18
            : marketId === 18
              ? specifier.includes("total=3.5") ? 1.98 : 1.66
              : marketId === 1
                ? 2.2
                : 1.5,
          outcome_id: String(source.outcome_id ?? source.outcomeId ?? ""),
          specifier,
          status_name: "Active",
        };
      }),
      status_code: 200,
    };
  });
  apiMocks.contentApi.getBonusList.mockImplementation(async () => ({ data: [] }));
  apiMocks.sportsApi.getFixtureMarkets.mockImplementation(async () => ({ market: [], outcomes: [] }));
  apiMocks.mqttService.subscribeMqttTopic.mockImplementation(() => vi.fn());
}

function buildOneUpSelection(matchId = "100") {
  const markets = [
    {
      marketID: 1,
      marketName: "1X2",
      outcomes: [
        { active: 1, displayName: "1", odds: 2.2, outcomeID: "1", outcomeName: "Home" },
        { active: 1, displayName: "X", odds: 3.1, outcomeID: "2", outcomeName: "Draw" },
        { active: 1, displayName: "2", odds: 2.9, outcomeID: "3", outcomeName: "Away" },
      ],
    },
    {
      marketID: 1601,
      marketName: "1X2 - XUP",
      specifier: "xup=1",
      outcomes: [
        { active: 1, displayName: "1", odds: 1.84, outcomeID: "1", outcomeName: "Home", specifier: "xup=1" },
        { active: 1, displayName: "2", odds: 2.4, outcomeID: "3", outcomeName: "Away", specifier: "xup=1" },
      ],
    },
    {
      marketID: 1601,
      marketName: "1X2 - XUP",
      specifier: "xup=2",
      outcomes: [
        { active: 1, displayName: "1", odds: 1.72, outcomeID: "1", outcomeName: "Home", specifier: "xup=2" },
        { active: 1, displayName: "2", odds: 2.18, outcomeID: "3", outcomeName: "Away", specifier: "xup=2" },
      ],
    },
  ];

  return {
    currentSelectionId: "",
    displayName: "1",
    eventId: matchId,
    eventName: "Mexico vs. South Africa",
    fixture: {
      awayTeam: "South Africa",
      derived_market_ids: [1601],
      homeTeam: "Mexico",
      market: markets,
      matchID: matchId,
      outcomes: markets.flatMap((market) =>
        market.outcomes.map((outcome) => ({ ...outcome, marketID: market.marketID })),
      ),
      sportID: 1,
      sportName: "Football",
      tournament: "International Friendly",
    },
    homeTeam: "Mexico",
    id: "",
    market: markets[0],
    marketId: "1",
    marketName: "1X2",
    matchId,
    odds: 2.2,
    outcome: { ...markets[0].outcomes[0], marketID: 1 },
    outcomeId: "1",
    outcomeName: "Home",
    producerId: 0,
    selectionId: "",
    selectionKeySpecifier: "",
    specifier: "",
    sportId: 1,
    sportName: "Football",
    startTime: "2026-06-11T19:00:00Z",
    tournament: "International Friendly",
    tournamentName: "International Friendly",
    type: "prematch" as const,
  };
}

function buildEarlyGoalSelection(matchId = "200") {
  const markets = [
    {
      marketID: 18,
      marketName: "Over/Under",
      specifier: "total=2.5",
      outcomes: [
        {
          active: 1,
          displayName: "Over 2.5",
          odds: 1.66,
          outcomeID: "12",
          outcomeName: "over 2.5",
          specifier: "total=2.5",
        },
        {
          active: 1,
          displayName: "Under 2.5",
          odds: 2.12,
          outcomeID: "13",
          outcomeName: "under 2.5",
          specifier: "total=2.5",
        },
      ],
    },
    {
      marketID: 60180,
      marketName: "Over/Under - Early Goals",
      specifier: "minsnr=50|total=2.5",
      outcomes: [
        {
          active: 1,
          displayName: "Over 2.5",
          odds: 1.18,
          outcomeID: "12",
          outcomeName: "over 2.5",
          specifier: "minsnr=50|total=2.5",
        },
      ],
    },
  ];

  return {
    currentSelectionId: "",
    displayName: "Over 2.5",
    eventId: matchId,
    eventName: "Argentina vs. Brazil",
    fixture: {
      awayTeam: "Brazil",
      derived_market_ids: [60180],
      homeTeam: "Argentina",
      market: markets,
      matchID: matchId,
      outcomes: markets.flatMap((market) =>
        market.outcomes.map((outcome) => ({ ...outcome, marketID: market.marketID })),
      ),
      sportID: 1,
      sportName: "Football",
      tournament: "South America",
    },
    homeTeam: "Argentina",
    id: "",
    market: markets[0],
    marketId: "18",
    marketName: "Over/Under",
    matchId,
    odds: 1.66,
    outcome: { ...markets[0].outcomes[0], marketID: 18 },
    outcomeId: "12",
    outcomeName: "over 2.5",
    producerId: 0,
    selectionId: "",
    selectionKeySpecifier: "total=2.5",
    specifier: "total=2.5",
    sportId: 1,
    sportName: "Football",
    startTime: "2026-06-12T19:00:00Z",
    tournament: "South America",
    tournamentName: "South America",
    type: "prematch" as const,
  };
}

function buildPlainSelection(matchId: string, odds: number, outcomeId: string) {
  const selection = buildOneUpSelection(matchId);
  const outcomeLabel = outcomeId === "1" ? "1" : "2";
  const outcomeName = outcomeId === "1" ? "Home" : "Away";

  return {
    ...selection,
    eventId: matchId,
    fixture: {
      ...(selection.fixture as Record<string, unknown>),
      market: [
        {
          marketID: 1,
          marketName: "1X2",
          outcomes: [
            { active: 1, displayName: outcomeLabel, odds, outcomeID: outcomeId, outcomeName },
          ],
        },
      ],
      outcomes: [{ active: 1, displayName: outcomeLabel, marketID: 1, odds, outcomeID: outcomeId, outcomeName }],
    },
    market: {
      marketID: 1,
      marketName: "1X2",
      outcomes: [{ active: 1, displayName: outcomeLabel, odds, outcomeID: outcomeId, outcomeName }],
    },
    marketId: "1",
    matchId,
    odds,
    outcomeId,
    outcomeName,
    outcome: {
      active: 1,
      displayName: outcomeLabel,
      marketID: 1,
      odds,
      outcomeID: outcomeId,
      outcomeName,
    },
    selectionId: "",
    selectionKeySpecifier: "",
    specifier: "",
  };
}

function buildDirectXupSelection(matchId: string, specifier: "xup=1" | "xup=2") {
  const selection = buildOneUpSelection(matchId);
  const market = ((selection.fixture as { market: Array<Record<string, unknown>> }).market).find(
    (item) => item.marketID === 1601 && item.specifier === specifier,
  ) as Record<string, unknown> & { outcomes: Array<Record<string, unknown>> };
  const outcome = { ...market.outcomes[0], specifier: "" };

  return {
    ...selection,
    currentSelectionId: "",
    market,
    marketId: "1601",
    marketName: "1X2 - XUP",
    odds: Number(outcome.odds),
    outcome,
    outcomeId: "1",
    outcomeName: "Home",
    selectionId: "",
    selectionKeySpecifier: specifier,
    specifier,
  };
}

function buildMarketOnlySpecifierXupSelection(matchId: string, specifier: "xup=1" | "xup=2") {
  const selection = buildDirectXupSelection(matchId, specifier);
  const strippedMarket = {
    ...selection.market,
    outcomes: selection.market.outcomes.map((outcome) => ({ ...outcome, specifier: "" })),
  };
  const strippedMarkets = ((selection.fixture as { market: Array<Record<string, unknown>> }).market).map(
    (market) =>
      market.marketID === 1601 && market.specifier === specifier
        ? strippedMarket
        : market,
  );

  return {
    ...selection,
    fixture: {
      ...(selection.fixture as Record<string, unknown>),
      market: strippedMarkets,
    },
    market: strippedMarket,
    outcome: { ...selection.outcome, specifier: "" },
    selectionKeySpecifier: "",
    specifier: "",
  };
}

function buildSimulationResponse(overrides?: Record<string, unknown>) {
  return {
    data: {
      bets: [
        {
          amountWon: 500,
          possibleWin: 900,
          potential_payout: 900,
          share_code: "LURYL4",
        },
      ],
      events: [
        {
          final_score: "2-1",
          home_goals: 2,
          away_goals: 1,
          match_id: 430,
          timeline: [
            { minute: 12, team: "home", type: "goal" },
            { minute: 54, team: "away", type: "goal" },
            { minute: 77, team: "home", type: "goal" },
          ],
        },
      ],
      selections: [
        {
          marketId: "1",
          matchId: "430",
          outcomeId: "1",
          won: 1,
        },
      ],
      share_code: "LURYL4",
      ...overrides,
    },
    status_code: 200,
  };
}

describe("couponStore", () => {
  beforeEach(() => {
    resetStore();
    configureFeatures();
    vi.clearAllMocks();
    restoreApiMockImplementations();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  it("keeps a stable selectionId and replaces conflicting selections on the same match/market", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("100", 2.2, "1"));
    await waitForAsyncWork();

    const firstSelection = useCouponStore.getState().selections[0];
    expect(firstSelection.selectionId).toBe("100_1_1");

    store.addSelection(buildPlainSelection("100", 2.9, "3"));
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.selections).toHaveLength(1);
    expect(state.selections[0].selectionId).toBe("100_1_3");
    expect(state.selections[0].currentSelectionId).toBe("100_1_3");
  });

  it("replaces direct fixture-detail 1UP and 2UP selections as the same base 1X2 selection", async () => {
    useCouponStore.setState((state) => ({
      ...state,
      globalVars: { ...(state.globalVars ?? {}), EnableSplitBet: 0 },
    }));
    const store = useCouponStore.getState();

    store.addSelection(buildDirectXupSelection("68687812", "xup=1"));
    await waitForAsyncWork();

    const firstSelection = useCouponStore.getState().selections[0];
    expect(firstSelection.selectionId).toBe("68687812_1_1");
    expect(firstSelection.currentSelectionId).toBe("68687812_1601_1_xup=1");
    expect(firstSelection.marketId).toBe("1601");
    expect(firstSelection.specifier).toBe("xup=1");

    store.addSelection(buildDirectXupSelection("68687812", "xup=2"));
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.dialog).toBeNull();
    expect(state.selections).toHaveLength(1);
    expect(state.selections[0].selectionId).toBe("68687812_1_1");
    expect(state.selections[0].currentSelectionId).toBe("68687812_1601_1_xup=2");
    expect(state.selections[0].marketId).toBe("1601");
    expect(state.selections[0].specifier).toBe("xup=2");
  });

  it("normalizes direct XUP selections when only the market carries the specifier", async () => {
    const store = useCouponStore.getState();

    store.addSelection(buildMarketOnlySpecifierXupSelection("68687813", "xup=1"));
    await waitForAsyncWork();

    const selection = useCouponStore.getState().selections[0];
    expect(selection.selectionId).toBe("68687813_1_1");
    expect(selection.currentSelectionId).toBe("68687813_1601_1_xup=1");
    expect(selection.selectionKeySpecifier).toBe("xup=1");
    expect(selection.specifier).toBe("xup=1");
  });

  it("updates selected XUP odds from betslip MQTT subscriptions by matching the specifier", async () => {
    const callbacks = new Map<string, (payload: Record<string, unknown>, topic: string) => void>();
    apiMocks.mqttService.subscribeMqttTopic.mockImplementation((topic, callback) => {
      callbacks.set(topic, callback);
      return vi.fn();
    });
    const store = useCouponStore.getState();

    store.addSelection(buildDirectXupSelection("68687812", "xup=1"));
    await waitForAsyncWork();
    useCouponStore.getState().startBetslipRealtimeSync();

    expect(apiMocks.mqttService.subscribeMqttTopic).toHaveBeenCalledWith(
      "sports/1/match/68687812/markets",
      expect.any(Function),
    );
    expect(apiMocks.mqttService.subscribeMqttTopic).toHaveBeenCalledWith(
      "sports/1/match/68687812/bet_stop",
      expect.any(Function),
    );

    callbacks.get("sports/1/match/68687812/markets")?.(
      {
        match_id: "68687812",
        markets: [
          {
            id: 1,
            specifier: "",
            status_name: "Active",
            outcomes: [{ active: 1, id: "1", odds: 9.99 }],
          },
          {
            id: 1601,
            specifier: "xup=2",
            status_name: "Active",
            outcomes: [{ active: 1, id: "1", odds: 7.77 }],
          },
          {
            id: 1601,
            specifier: "xup=1",
            status_name: "Active",
            outcomes: [{ active: 1, id: "1", odds: 1.05 }],
          },
        ],
      },
      "sports/1/match/68687812/markets",
    );

    const selection = useCouponStore.getState().selections[0];
    expect(selection.odds).toBe(1.05);
    expect(selection.changed).toBe(true);
    expect(selection.specifier).toBe("xup=1");
  });

  it("normalizes unavailable selections to zero odds", async () => {
    const store = useCouponStore.getState();
    store.addSelection({
      ...buildPlainSelection("101", 2.2, "1"),
      unavailable: true,
    });
    await waitForAsyncWork();

    const selection = useCouponStore.getState().selections[0];
    expect(selection.unavailable).toBe(true);
    expect(selection.odds).toBe(0);
  });

  it("does not auto-open the betslip when a selection is added", async () => {
    const store = useCouponStore.getState();
    expect(useCouponStore.getState().isOpen).toBe(false);

    store.addSelection(buildPlainSelection("105", 2.2, "1"));
    await waitForAsyncWork();

    expect(useCouponStore.getState().isOpen).toBe(false);
  });

  it("bootstraps a populated slip by validating selections without calling previews", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("701", 2.2, "1"));
    store.addSelection(buildPlainSelection("702", 2.2, "1"));
    await waitForAsyncWork();

    apiMocks.betsApi.validateSelections.mockClear();
    apiMocks.betsApi.previewAccaBonus.mockClear();

    const result = await store.bootstrapSlip();
    await waitForAsyncWork();

    expect(result.reason).toBe("ok");
    expect(apiMocks.betsApi.validateSelections).toHaveBeenCalledTimes(1);
    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
  });

  it("skips odd status validation before placing a real bet", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("706", 1.8, "1"));
    await waitForAsyncWork();
    apiMocks.betsApi.validateSelections.mockClear();
    apiMocks.betsApi.placeBet.mockClear();

    const response = await store.placeBet();

    expect(response).not.toBeNull();
    expect(apiMocks.betsApi.validateSelections).not.toHaveBeenCalled();
    expect(apiMocks.authApi.getDetails).toHaveBeenCalled();
    expect(apiMocks.betsApi.placeBet).toHaveBeenCalledTimes(1);
  });

  it("does not fetch the current user when booking a bet", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("7060", 1.8, "1"));
    await waitForAsyncWork();
    apiMocks.authApi.getDetails.mockClear();
    apiMocks.betsApi.placeBet.mockClear();

    const response = await store.bookBet();

    expect(response).not.toBeNull();
    expect(apiMocks.authApi.getDetails).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.placeBet).toHaveBeenCalledTimes(1);
    expect(apiMocks.betsApi.placeBet.mock.calls[0][0]).toMatchObject({ isBooking: 1 });
    expect(useCouponStore.getState().betPlaced).toMatchObject({
      bookingCode: "LURYL4",
      type: "book",
    });
  });

  it("does not submit a payload while a locally unavailable selection remains in the slip", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("7061", 1.8, "1"));
    store.addSelection(buildPlainSelection("7062", 2.1, "1"));
    await waitForAsyncWork();

    store.handleOddsChange("7061", [
      {
        marketId: "1",
        odds: 0,
        outcomeId: "1",
        specifier: "",
        statusName: "Deactivated",
      },
    ]);
    apiMocks.betsApi.placeBet.mockClear();

    const firstResponse = await store.placeBet();

    expect(firstResponse).toBeNull();
    expect(apiMocks.betsApi.placeBet).not.toHaveBeenCalled();
    expect(useCouponStore.getState().selections[0].odds).toBe(0);
    expect(useCouponStore.getState().selections[0].unavailable).toBe(true);

    store.acceptOddsChanges();
    apiMocks.betsApi.placeBet.mockClear();

    const secondResponse = await store.placeBet();

    expect(secondResponse).toBeNull();
    expect(apiMocks.betsApi.placeBet).not.toHaveBeenCalled();
    expect(useCouponStore.getState().dialog).toMatchObject({
      kind: "error",
      title: "Selections unavailable",
    });
  });

  it("logs out and clears the current user when the profile refresh returns 401 before placement", async () => {
    const store = useCouponStore.getState();
    useAuthStore.setState((state) => ({
      ...state,
      isAuthenticated: true,
      mobileNumber: "8037768166",
      token: "expired-token",
    }));
    useUserStore.getState().setCurrentUser({
      availableBalance: 1200,
      casinoBonusBalance: 0,
      id: "8037768166",
      sportBonusBalance: 0,
      trustBalance: 0,
      username: "8037768166",
      virtualBonusBalance: 0,
    });
    store.addSelection(buildPlainSelection("7063", 2.1, "1"));
    await waitForAsyncWork();

    apiMocks.authApi.getDetails.mockRejectedValueOnce(
      new ApiClientError("Unauthorized", { status: 401 }),
    );
    apiMocks.betsApi.placeBet.mockClear();

    const response = await store.placeBet();

    expect(response).toBeNull();
    expect(apiMocks.betsApi.placeBet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useUserStore.getState().currentUser).toBeNull();
  });

  it("prompts before replacing a populated real slip with a loaded booking code", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("707", 2.2, "1"));
    await waitForAsyncWork();

    await store.requestLoadByCode("LURYL4");

    expect(useCouponStore.getState().dialog).toMatchObject({
      action: "loadCode",
      confirmLabel: "Replace slip",
      title: "Replace betslip",
    });
  });

  it("prompts to switch back to real mode before loading a booking code in sim mode", async () => {
    const store = useCouponStore.getState();
    store.setMode("sim");

    await store.requestLoadByCode("LURYL4");

    expect(useCouponStore.getState().dialog).toMatchObject({
      action: "switchModeAndLoadCode",
      confirmLabel: "Switch to Real",
      title: "Switch mode",
    });
  });

  it("keeps the current slip intact when a loaded booking code rebuilds zero active selections", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("708", 2.2, "1"));
    await waitForAsyncWork();

    apiMocks.betsApi.loadByCode.mockResolvedValueOnce({
      data: {
        input_code: "LURYL4",
        selections: [
          {
            active: 0,
            eventName: "Expired Fixture",
            marketId: 1,
            matchId: 88991,
            odds: 1.8,
            outcomeId: "1",
            outcomeName: "Home",
            specifier: "",
            statusName: "Suspended",
          },
        ],
      },
      status_code: 200,
    });

    await store.loadByCodeIntoSlip("LURYL4", "real");

    expect(useCouponStore.getState().selections).toHaveLength(1);
    expect(useCouponStore.getState().selections[0].matchId).toBe("708");
    expect(useCouponStore.getState().dialog).toMatchObject({
      kind: "error",
      title: "Load code failed",
    });
  });

  it("switches derived 1UP mode without changing the stable selectionId", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildOneUpSelection());
    await waitForAsyncWork();

    const initial = useCouponStore.getState().selections[0];
    await store.setSelectionEarlyWinMode(initial.selectionId, "1up");

    const next = useCouponStore.getState().selections[0];
    expect(next.selectionId).toBe(initial.selectionId);
    expect(next.currentSelectionId).not.toBe(initial.selectionId);
    expect(String(next.marketId)).toBe("1601");
    expect(next.specifier).toBe("xup=1");
    expect(next.earlyWinMode).toBe("1up");
  });

  it("marks eligible base selections as supporting derived row controls even without local derived markets", async () => {
    const store = useCouponStore.getState();
    const earlyGoalSelection = buildEarlyGoalSelection("210");

    store.addSelection(buildPlainSelection("110", 2.2, "1"));
    store.addSelection({
      ...earlyGoalSelection,
      fixture: {
        ...(earlyGoalSelection.fixture as Record<string, unknown>),
        derived_market_ids: [],
        market: [((earlyGoalSelection.fixture as { market: unknown[] }).market[0])],
        outcomes: [((earlyGoalSelection.fixture as { outcomes: unknown[] }).outcomes[0])],
      },
    });
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    const oneUpSelection = state.selections.find((selection) => String(selection.matchId) === "110");
    const earlyGoalBaseSelection = state.selections.find((selection) => String(selection.matchId) === "210");

    expect(oneUpSelection?.supportsEarlyWin).toBe(true);
    expect(oneUpSelection?.supportedEarlyWinModes).toEqual(["1up", "2up"]);
    expect(earlyGoalBaseSelection?.supportsEarlyGoal).toBe(true);
  });

  it("matches Early Goals specifiers by total value and switches to market 60180", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildEarlyGoalSelection());
    await waitForAsyncWork();

    const initial = useCouponStore.getState().selections[0];
    await store.setSelectionEarlyGoalMode(initial.selectionId, true);

    const next = useCouponStore.getState().selections[0];
    expect(String(next.marketId)).toBe("60180");
    expect(next.earlyGoalMode).toBe("earlygoal");
    expect(next.supportsEarlyGoal).toBe(true);
    expect(String(next.specifier)).toContain("total=2.5");
    expect(String(next.specifier)).toContain("minsnr=50");
  });

  it("does not mark the bulk 1UP helper active when the selection is draw-only and unsupported", async () => {
    const store = useCouponStore.getState();
    const drawSelection = buildOneUpSelection("260");

    store.addSelection({
      ...drawSelection,
      displayName: "X",
      fixture: {
        ...(drawSelection.fixture as Record<string, unknown>),
        market: [
          {
            marketID: 1,
            marketName: "1X2",
            outcomes: [
              { active: 1, displayName: "X", odds: 3.1, outcomeID: "2", outcomeName: "Draw" },
            ],
          },
        ],
        outcomes: [{ active: 1, displayName: "X", marketID: 1, odds: 3.1, outcomeID: "2", outcomeName: "Draw" }],
      },
      market: {
        marketID: 1,
        marketName: "1X2",
        outcomes: [{ active: 1, displayName: "X", odds: 3.1, outcomeID: "2", outcomeName: "Draw" }],
      },
      odds: 3.1,
      outcome: { active: 1, displayName: "X", marketID: 1, odds: 3.1, outcomeID: "2", outcomeName: "Draw" },
      outcomeId: "2",
      outcomeName: "Draw",
    });
    await waitForAsyncWork();

    await store.applyBulkEarlyWinMode("1up");
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.earlyWinBulkMode).toBe("base");
    expect(state.selections[0].earlyWinMode).toBe("base");
  });

  it("does not keep Cut-1 enabled when the selections fail eligibility rules", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("301", 1.1, "1"));
    store.addSelection(buildPlainSelection("302", 2.0, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));

    await store.toggleCutOne();
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.useCutOne).toBe(false);
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
  });

  it("returns the bulk early-win state to base when the last X-UP eligible selection is removed", async () => {
    const store = useCouponStore.getState();
    const eligibleSelection = buildOneUpSelection("3011");
    const unsupportedSelection = {
      currentSelectionId: "",
      displayName: "1",
      eventId: "3012",
      eventName: "Lakers vs. Celtics",
      fixture: {
        awayTeam: "Celtics",
        derived_market_ids: [],
        homeTeam: "Lakers",
        market: [
          {
            marketID: 1,
            marketName: "1X2",
            outcomes: [{ active: 1, displayName: "1", odds: 2.1, outcomeID: "1", outcomeName: "Home" }],
          },
        ],
        matchID: "3012",
        outcomes: [{ active: 1, displayName: "1", marketID: 1, odds: 2.1, outcomeID: "1", outcomeName: "Home" }],
        sportID: 2,
      },
      homeTeam: "Lakers",
      id: "",
      market: {
        marketID: 1,
        marketName: "1X2",
        outcomes: [{ active: 1, displayName: "1", odds: 2.1, outcomeID: "1", outcomeName: "Home" }],
      },
      marketId: "1",
      marketName: "1X2",
      matchId: "3012",
      odds: 2.1,
      outcome: {
        active: 1,
        displayName: "1",
        marketID: 1,
        odds: 2.1,
        outcomeID: "1",
        outcomeName: "Home",
      },
      outcomeId: "1",
      outcomeName: "Home",
      producerId: 0,
      selectionId: "",
      selectionKeySpecifier: "",
      specifier: "",
      sportId: 2,
      sportName: "Basketball",
      startTime: "2026-06-11T19:00:00Z",
      tournament: "NBA",
      tournamentName: "NBA",
      type: "prematch" as const,
    };

    store.addSelection(eligibleSelection);
    store.addSelection(unsupportedSelection);
    await waitForAsyncWork();
    await store.applyBulkEarlyWinMode("1up");
    await waitForAsyncWork();

    const eligibleSelectionId = useCouponStore
      .getState()
      .selections.find((selection) => String(selection.matchId) === "3011")?.selectionId;
    expect(useCouponStore.getState().earlyWinBulkMode).toBe("1up");

    store.removeSelection(String(eligibleSelectionId));

    const state = useCouponStore.getState();
    expect(state.earlyWinBulkMode).toBe("base");
    expect(state.selections).toHaveLength(1);
  });

  it("force-applies bulk 1UP and 2UP modes across mixed early-win selections", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildOneUpSelection("3013"));
    store.addSelection(buildOneUpSelection("3014"));
    await waitForAsyncWork();

    await store.applyBulkEarlyWinMode("1up");
    await waitForAsyncWork();

    const secondSelectionId = useCouponStore
      .getState()
      .selections.find((selection) => String(selection.matchId) === "3014")?.selectionId;
    await store.setSelectionEarlyWinMode(String(secondSelectionId), "2up");
    await waitForAsyncWork();

    expect(useCouponStore.getState().earlyWinBulkMode).toBe("base");

    await store.applyBulkEarlyWinMode("1up");
    await waitForAsyncWork();

    let state = useCouponStore.getState();
    expect(state.earlyWinBulkMode).toBe("1up");
    expect(state.selections.every((selection) => selection.earlyWinMode === "1up")).toBe(true);

    await store.applyBulkEarlyWinMode("2up");
    await waitForAsyncWork();

    state = useCouponStore.getState();
    expect(state.earlyWinBulkMode).toBe("2up");
    expect(state.selections.every((selection) => selection.earlyWinMode === "2up")).toBe(true);
  });

  it("returns Early Goals to base when the last eligible selection is removed", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildEarlyGoalSelection("3021"));
    store.addSelection(buildPlainSelection("3022", 2.1, "1"));
    await waitForAsyncWork();
    await store.toggleEarlyGoal();
    await waitForAsyncWork();

    const earlyGoalSelectionId = useCouponStore
      .getState()
      .selections.find((selection) => String(selection.matchId) === "3021")?.selectionId;
    expect(useCouponStore.getState().useEarlyGoal).toBe(true);

    store.removeSelection(String(earlyGoalSelectionId));

    const state = useCouponStore.getState();
    expect(state.useEarlyGoal).toBe(false);
    expect(state.selections).toHaveLength(1);
  });

  it("builds a flex bet payload with minWins after Flex is enabled", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("401", 2.2, "1"));
    store.addSelection(buildPlainSelection("402", 2.2, "1"));
    store.addSelection(buildPlainSelection("403", 2.2, "1"));
    store.addSelection(buildPlainSelection("404", 2.2, "1"));
    await waitForAsyncWork();

    await store.toggleFlex();
    store.setFlexMinWins(3);
    await waitForAsyncWork();
    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{ betType: string; flex?: { minWins: number } }>;
    };
    expect(payload.bets[0].betType).toBe("flex");
    expect(payload.bets[0].flex?.minWins).toBe(3);
  });

  it("builds placement selections with numeric match ids", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("410", 2.2, "1"));
    store.addSelection(buildPlainSelection("411", 2.2, "1"));
    await waitForAsyncWork();

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{ selections: Array<{ matchId: number; marketId: number }> }>;
    };
    expect(payload.bets[0].selections[0].matchId).toBe(410);
    expect(typeof payload.bets[0].selections[0].matchId).toBe("number");
    expect(payload.bets[0].selections[0].marketId).toBe(1);
  });

  it("filters unsupported selections in sim mode and restores them in real mode", async () => {
    const store = useCouponStore.getState();
    const unsupportedSelection = {
      ...buildPlainSelection("420", 1.75, "1"),
      sportId: "2",
      market: {
        marketID: 9999,
        marketName: "Unsupported",
        outcomes: [{ active: 1, displayName: "1", odds: 1.75, outcomeID: "1", outcomeName: "Home" }],
      },
      marketId: "9999",
      marketName: "Unsupported",
      outcome: {
        active: 1,
        displayName: "1",
        marketID: 9999,
        odds: 1.75,
        outcomeID: "1",
        outcomeName: "Home",
      },
    };

    store.addSelection(unsupportedSelection);
    store.addSelection(buildPlainSelection("421", 2.2, "1"));
    await waitForAsyncWork();

    await store.setMode("sim");

    let state = useCouponStore.getState();
    expect(state.mode).toBe("sim");
    expect(state.selections).toHaveLength(1);
    expect(state.selections[0].sportId).toBe(1);
    expect(state.totalOdds).toBe(2.2);

    await store.setMode("real");

    state = useCouponStore.getState();
    expect(state.mode).toBe("real");
    expect(state.selections).toHaveLength(2);
    expect(state.selections.some((selection) => selection.marketId === "9999")).toBe(true);
  });

  it("prompts before adding a non-football or unsupported market in sim mode", async () => {
    const store = useCouponStore.getState();
    await store.setMode("sim");

    store.addSelection({
      ...buildPlainSelection("4201", 1.75, "1"),
      sportId: "2",
    });

    expect(useCouponStore.getState().selections).toHaveLength(0);
    expect(useCouponStore.getState().dialog).toMatchObject({
      action: "switchSimulationToRealAndAdd",
      kind: "confirm",
      title: "Unsupported market",
    });

    await store.confirmDialog();

    const state = useCouponStore.getState();
    expect(state.mode).toBe("real");
    expect(state.selections).toHaveLength(1);
    expect(state.selections[0].sportId).toBe("2");
  });

  it("does not call preview endpoints while the betslip is closed", async () => {
    const store = useCouponStore.getState();
    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    store.addSelection(buildPlainSelection("4210", 2.2, "1"));
    store.addSelection(buildPlainSelection("4211", 2.2, "1"));
    await waitForAsyncWork();

    expect(useCouponStore.getState().isOpen).toBe(false);
    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
  });

  it("coalesces rapid preview refresh triggers into a single acca preview call", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4210", 2.2, "1"));
    store.addSelection(buildPlainSelection("4211", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewAccaBonus.mockClear();
    store.updateStake(110);
    store.updateStake(120);
    store.updateStake(130);

    await new Promise((resolve) => setTimeout(resolve, 260));
    await waitForAsyncWork();

    expect(apiMocks.betsApi.previewAccaBonus).toHaveBeenCalledTimes(1);
    const accaPayload = (apiMocks.betsApi.previewAccaBonus.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(accaPayload).toMatchObject({
      selections: [
        expect.objectContaining({ marketId: 1, matchId: 4210, outcomeId: "1", specifier: "" }),
        expect.objectContaining({ marketId: 1, matchId: 4211, outcomeId: "1", specifier: "" }),
      ],
    });
  });

  it("does not call preview endpoints during submit-time validation", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4212", 2.2, "1"));
    store.addSelection(buildPlainSelection("4213", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    await store.placeBet();

    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
  });

  it("rejects simulation submit when unsupported selections already exist in sim mode", async () => {
    const store = useCouponStore.getState();
    store.addSelection({
      ...buildPlainSelection("422", 1.75, "1"),
      marketId: "9999",
      marketName: "Unsupported",
      market: {
        marketID: 9999,
        marketName: "Unsupported",
        outcomes: [{ active: 1, displayName: "1", odds: 1.75, outcomeID: "1", outcomeName: "Home" }],
      },
      outcome: {
        active: 1,
        displayName: "1",
        marketID: 9999,
        odds: 1.75,
        outcomeID: "1",
        outcomeName: "Home",
      },
    });
    store.addSelection(buildPlainSelection("423", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, mode: "sim" }));
    apiMocks.betsApi.placeBet.mockClear();

    const response = await store.placeBet();

    expect(response).toBeNull();
    expect(apiMocks.betsApi.placeBet).not.toHaveBeenCalled();
    expect(useCouponStore.getState().simulation.status).toBe("idle");
  });

  it("starts a successful simulation session without opening the real success state", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("430", 2.2, "1"));
    store.addSelection(buildPlainSelection("431", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);

    await store.placeBet();

    const state = useCouponStore.getState();
    expect(state.simulation.status).toBe("running");
    expect(state.betPlaced).toBeNull();
    expect(state.simulation.currentStage).toBe("start");
    expect(state.simulation.currentTimeSec).toBe(0);
    expect(state.simulation.eventsByMatchId["430"]).toMatchObject({
      awayGoals: 1,
      finalScoreText: "2-1",
      homeGoals: 2,
    });
    expect(apiMocks.betsApi.placeBet.mock.calls[0][0]).toMatchObject({ isBooking: 2 });
  });

  it("starts simulation from a nested bet-service wrapper response", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4301", 2.2, "1"));
    store.addSelection(buildPlainSelection("4302", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: {
        data: {
          bets: [
            {
              amountWon: 450,
              possibleWin: 900,
              potential_payout: 900,
              share_code: "SIM123",
            },
          ],
          events: [
            {
              away_goals: 1,
              final_score: "2-1",
              home_goals: 2,
              match_id: "4301",
              timeline: [{ minute: 21, team: "home", type: "goal" }],
            },
          ],
          selections: [
            {
              marketID: "1",
              matchID: "4301",
              outcomeID: "1",
              specifier: "",
              won: 1,
            },
          ],
        },
        status_code: 200,
      },
    } as PlaceBetResponse);

    await store.placeBet();

    const state = useCouponStore.getState();
    expect(state.simulation.status).toBe("running");
    expect(state.betPlaced).toBeNull();
    expect(state.simulation.eventsByMatchId["4301"]).toMatchObject({
      awayGoals: 1,
      finalScoreText: "2-1",
      homeGoals: 2,
    });
  });

  it("does not call preview endpoints in sim mode and sends a normal multi payload", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4310", 2.2, "1"));
    store.addSelection(buildPlainSelection("4311", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({
      ...state,
      isOpen: true,
      useCutOne: true,
      useFlex: true,
    }));
    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    store.setMode("sim");
    await waitForAsyncWork();

    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
    expect(useCouponStore.getState().useCutOne).toBe(false);
    expect(useCouponStore.getState().useFlex).toBe(false);

    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);
    await store.placeBet();

    const simPayload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<Record<string, unknown>>;
      isBooking: number;
    };

    expect(simPayload).toMatchObject({
      bets: [
        {
          betType: "multi",
        },
      ],
      isBooking: 2,
    });
    expect(simPayload.bets[0].cutOne).toBeUndefined();
    expect(simPayload.bets[0].flex).toBeUndefined();
  });

  it("sends matchId in the flex preview payload and only issues one preview call per toggle", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43120", 2.2, "1"));
    store.addSelection(buildPlainSelection("43121", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewFlex.mockClear();

    await store.toggleFlex();

    expect(apiMocks.betsApi.previewFlex).toHaveBeenCalledTimes(1);
    const flexPayload = (apiMocks.betsApi.previewFlex.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(flexPayload).toMatchObject({
      minWins: 2,
      selections: [
        expect.objectContaining({ marketId: 1, matchId: 43120, outcomeId: "1", specifier: "" }),
        expect.objectContaining({ marketId: 1, matchId: 43121, outcomeId: "1", specifier: "" }),
      ],
    });
  });

  it("sends selection identity fields in the cut-one preview payload", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43130", 2.2, "1"));
    store.addSelection(buildPlainSelection("43131", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewCutOne.mockClear();

    await store.toggleCutOne();
    await waitForAsyncWork();

    expect(apiMocks.betsApi.previewCutOne).toHaveBeenCalledTimes(1);
    const cutOnePayload = (apiMocks.betsApi.previewCutOne.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(cutOnePayload).toMatchObject({
      selections: [
        expect.objectContaining({ marketId: 1, matchId: 43130, outcomeId: "1", specifier: "" }),
        expect.objectContaining({ marketId: 1, matchId: 43131, outcomeId: "1", specifier: "" }),
      ],
    });
  });

  it("caps flex min wins at one less than the current selection count", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43140", 2.2, "1"));
    store.addSelection(buildPlainSelection("43141", 2.2, "1"));
    store.addSelection(buildPlainSelection("43142", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));

    await store.toggleFlex();
    await waitForAsyncWork();

    store.setFlexMinWins(99);

    expect(useCouponStore.getState().flexMinWins).toBe(2);
  });

  it("defaults flex min wins to one less than the active selection count when enabled", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43150", 2.2, "1"));
    store.addSelection(buildPlainSelection("43151", 2.2, "1"));
    store.addSelection(buildPlainSelection("43152", 2.2, "1"));
    store.addSelection(buildPlainSelection("43153", 2.2, "1"));
    store.addSelection(buildPlainSelection("43154", 2.2, "1"));
    store.addSelection(buildPlainSelection("43155", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewFlex.mockClear();

    await store.toggleFlex();

    expect(useCouponStore.getState().flexMinWins).toBe(5);
    const flexPayload = (apiMocks.betsApi.previewFlex.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(flexPayload).toMatchObject({ minWins: 5 });
  });

  it("keeps split-slip payloads as singles plus a plain multi even when flex or cut-one are selected", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4312", 2.2, "1"));
    store.addSelection({
      ...buildPlainSelection("4312", 2.4, "12"),
      currentSelectionId: "4312:18:12:total=2.5",
      marketId: "18",
      marketName: "Over/Under",
      outcomeId: "12",
      outcomeName: "Over 2.5",
      selectionId: "4312:18:total=2.5",
      specifier: "total=2.5",
    });
    store.addSelection(buildPlainSelection("4313", 2.1, "1"));
    store.addSelection(buildPlainSelection("4314", 2.3, "1"));
    await waitForAsyncWork();

    useCouponStore.setState((state) => ({
      ...state,
      useCutOne: true,
      useFlex: true,
    }));

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<Record<string, unknown>>;
    };
    const multipleBet = payload.bets.find((bet) => bet.betType === "multi");

    expect(payload.bets.filter((bet) => bet.betType === "single")).toHaveLength(2);
    expect(multipleBet).toBeTruthy();
    expect(multipleBet?.cutOne).toBeUndefined();
    expect(multipleBet?.flex).toBeUndefined();
  });

  it("blocks a second same-fixture selection when split bets are disabled", async () => {
    configureFeatures();
    useCouponStore.setState((state) => ({
      ...state,
      globalVars: { ...state.globalVars, EnableSplitBet: 0 },
    }));
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43125", 2.2, "1"));
    store.addSelection({
      ...buildPlainSelection("43125", 2.4, "2"),
      currentSelectionId: "43125:1:2:",
      outcomeId: "2",
      outcomeName: "Away",
    });

    const state = useCouponStore.getState();
    expect(state.selections).toHaveLength(1);
    expect(state.dialog).toMatchObject({
      description: "Multiple selections from the same fixture are currently unavailable.",
      kind: "error",
    });
  });

  it("derives split state and recalculates split min/max win when same-fixture selections are present", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43126", 2.2, "1"));
    store.addSelection({
      ...buildEarlyGoalSelection("43126"),
      odds: 1.8,
    });
    store.addSelection(buildPlainSelection("43127", 2.1, "1"));

    const state = useCouponStore.getState();
    expect(state.hasSplitBet).toBe(true);
    expect(state.splitMatchIds).toEqual(["43126"]);
    expect(state.nativeBetType).toBe("Split");
    expect(state.betType).toBe("Multiple");
    expect(state.minOdds).toBe(3.49);
    expect(state.totalOdds).toBe(8.11);
    expect(state.minWin).toBe(348.6);
    expect(state.maxWin).toBe(810.6);
  });

  it("clears existing bankers and prevents new banker toggles when the slip becomes split", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("43128", 2.2, "1"));
    store.addSelection(buildPlainSelection("43129", 2.3, "1"));
    store.addSelection(buildPlainSelection("43130", 2.4, "1"));
    await waitForAsyncWork();
    store.setBetType("System");
    const [firstSelection] = useCouponStore.getState().selections;
    store.toggleBanker(firstSelection.selectionId);
    expect(useCouponStore.getState().selections[0]?.fixed).toBe(true);

    store.addSelection({
      ...buildEarlyGoalSelection("43129"),
      odds: 1.9,
    });

    let state = useCouponStore.getState();
    expect(state.hasSplitBet).toBe(true);
    expect(state.betType).toBe("Multiple");
    expect(state.selections.every((selection) => !selection.fixed)).toBe(true);

    store.toggleBanker(state.selections[0].selectionId);
    state = useCouponStore.getState();
    expect(state.selections.every((selection) => !selection.fixed)).toBe(true);
    expect(state.dialog).toMatchObject({
      description: "Bankers are not available for split bets.",
      kind: "error",
    });
  });

  it("does not start simulation when the bet service status_code is not 200", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("432", 2.2, "1"));
    store.addSelection(buildPlainSelection("433", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: { bets: [] },
      status_code: 400,
      status_description: "Simulation failed",
    } as PlaceBetResponse);

    const response = await store.placeBet();

    expect(response).toBeNull();
    const state = useCouponStore.getState();
    expect(state.simulation.status).toBe("idle");
    expect(state.betPlaced).toBeNull();
    expect(state.dialog).toMatchObject({
      kind: "error",
      title: "Simulation unavailable",
    });
  });

  it("does not mark a real placement successful when the bet service status_code is not 200", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("434", 2.2, "1"));
    store.addSelection(buildPlainSelection("435", 2.2, "1"));
    await waitForAsyncWork();
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: { bets: [] },
      status_code: 400,
      status_description: "Placement failed",
    } as PlaceBetResponse);

    const response = await store.placeBet();

    expect(response).toBeNull();
    const state = useCouponStore.getState();
    expect(state.betPlaced).toBeNull();
    expect(state.simulation.status).toBe("idle");
    expect(state.dialog).toMatchObject({
      kind: "error",
      title: "Place bet failed",
    });
  });

  it("does not mark a real placement successful when a 200 response has no booking code", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4341", 2.2, "1"));
    store.addSelection(buildPlainSelection("4342", 2.2, "1"));
    await waitForAsyncWork();
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: { bets: [{ possibleWin: 900, potential_payout: 900 }] },
      status_code: 200,
    } as PlaceBetResponse);

    const response = await store.placeBet();

    expect(response).toBeNull();
    const state = useCouponStore.getState();
    expect(state.betPlaced).toBeNull();
    expect(state.dialog).toMatchObject({
      kind: "error",
      title: "Place bet failed",
    });
  });

  it("does not start simulation when a 200 response has no usable simulation payload", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4343", 2.2, "1"));
    store.addSelection(buildPlainSelection("4344", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: {
        bets: [{ possibleWin: 900, share_code: "LURYL4" }],
      },
      status_code: 200,
    } as PlaceBetResponse);

    const response = await store.placeBet();

    expect(response).toBeNull();
    const state = useCouponStore.getState();
    expect(state.simulation.status).toBe("idle");
    expect(state.dialog).toMatchObject({
      kind: "error",
      title: "Simulation unavailable",
    });
  });

  it("does not submit a bet payload when a selection has invalid numeric ids", async () => {
    const store = useCouponStore.getState();
    store.addSelection({
      ...buildPlainSelection("bad-match", 2.2, "1"),
      eventId: "bad-match",
      matchId: "bad-match",
    } as PlaceBetResponse);
    await waitForAsyncWork();
    apiMocks.betsApi.placeBet.mockClear();

    const response = await store.placeBet();

    expect(response).toBeNull();
    expect(apiMocks.betsApi.placeBet).not.toHaveBeenCalled();
    expect(useCouponStore.getState().dialog).toBeNull();
  });

  it("dismissing simulation preserves the current slip and sim mode", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("440", 2.2, "1"));
    store.addSelection(buildPlainSelection("441", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);
    await store.placeBet();

    store.dismissSimulation();

    const state = useCouponStore.getState();
    expect(state.mode).toBe("sim");
    expect(state.betType).toBe("Multiple");
    expect(state.selections).toHaveLength(2);
    expect(state.simulation.status).toBe("idle");
  });

  it("does not allow mode switches while a simulation is active", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("4401", 2.2, "1"));
    store.addSelection(buildPlainSelection("4402", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);
    await store.placeBet();

    store.setMode("real");

    const state = useCouponStore.getState();
    expect(state.mode).toBe("sim");
    expect(state.simulation.status).toBe("running");
  });

  it("falls back to real mode when persisted sim selections are ineligible", () => {
    const merge = useCouponStore.persist.getOptions().merge;
    const persistedState = {
      mode: "sim",
      selections: [
        {
          ...buildPlainSelection("4403", 2.2, "1"),
          fixture: {
            ...(buildPlainSelection("4403", 2.2, "1").fixture as Record<string, unknown>),
            derived_market_ids: [],
          },
          marketId: "9999",
          marketName: "Unsupported",
        },
      ],
    };

    const merged = merge?.(
      persistedState as Parameters<NonNullable<typeof merge>>[0],
      useCouponStore.getInitialState(),
    ) as
      | { mode: string }
      | undefined;

    expect(merged?.mode).toBe("real");
  });

  it("normalizes simulation payload variants and selection result keys", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("430", 2.2, "1"));
    store.addSelection(buildPlainSelection("431", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce({
      data: {
        bets: [{ amountWon: 250, possibleWin: 900, share_code: "LURYL4" }],
        events: JSON.stringify([
          {
            away_goals: 0,
            final_score: "1-0",
            home_goals: 1,
            match_id: 430,
            timeline: [{ minute: 33, team: "home", type: "goal" }],
          },
        ]),
        selectionResults: [
          {
            gameID: "430",
            marketID: "1",
            outcomeID: "1",
            won: "1",
          },
        ],
      },
      status_code: 200,
    } as PlaceBetResponse);

    await store.placeBet();

    const state = useCouponStore.getState();
    expect(state.simulation.resultAmountWon).toBe(250);
    expect(state.simulation.eventsByMatchId["430"]).toMatchObject({
      awayGoals: 0,
      finalScoreText: "1-0",
      homeGoals: 1,
    });
    expect(state.simulation.selectionResultsBySelectionKey["430:1:1:"]).toMatchObject({
      marketId: "1",
      matchId: "430",
      outcomeId: "1",
      won: true,
    });
  });

  it("advances and skips the simulation timeline deterministically", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("430", 2.2, "1"));
    store.addSelection(buildPlainSelection("431", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);

    await store.placeBet();
    store.advanceSimulation();
    store.advanceSimulation();

    let state = useCouponStore.getState();
    expect(state.simulation.currentTimeSec).toBe(0.2);
    expect(state.simulation.scorePhase).toBe(0);
    expect(state.simulation.currentStage).toBe("start");

    store.skipSimulationToResults();

    state = useCouponStore.getState();
    expect(state.simulation.status).toBe("complete");
    expect(state.simulation.currentStage).toBe("fulltime");
    expect(state.simulation.scorePhase).toBe(4);
    expect(state.simulation.timerEnded).toBe(true);
  });

  it("marks the simulation win modal as shown once per run", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("430", 2.2, "1"));
    store.addSelection(buildPlainSelection("431", 2.2, "1"));
    await waitForAsyncWork();
    store.setMode("sim");
    apiMocks.betsApi.placeBet.mockResolvedValueOnce(buildSimulationResponse() as PlaceBetResponse);

    await store.placeBet();
    store.skipSimulationToResults();
    store.markSimulationWinShown();

    expect(useCouponStore.getState().simulation.winModalShown).toBe(true);
  });

  it("supports distinct per-selection stakes for single bet payloads", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("450", 2.2, "1"));
    store.addSelection(buildPlainSelection("451", 2.4, "1"));
    await waitForAsyncWork();
    store.setBetType("Single");
    store.updateStake(150, useCouponStore.getState().selections[0].selectionId);
    store.updateStake(260, useCouponStore.getState().selections[1].selectionId);
    await waitForAsyncWork();

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{ betType: string; stake: number; totalStake: number }>;
    };
    expect(payload.bets).toHaveLength(2);
    expect(payload.bets[0]).toMatchObject({ betType: "single", stake: 150, totalStake: 150 });
    expect(payload.bets[1]).toMatchObject({ betType: "single", stake: 260, totalStake: 260 });
    expect(useCouponStore.getState().totalStake).toBe(410);
  });

  it("sends CustomBet as one single bet without leg odds in the placement payload", async () => {
    const store = useCouponStore.getState();
    store.addSelection({
      currentSelectionId: "custombet:72221256:1",
      customBetLegs: [
        {
          marketId: 18,
          marketName: "Over/Under",
          matchId: 72221256,
          odds: 1.41,
          outcomeId: "12",
          outcomeName: "over 2.5",
          specifier: "total=2.5",
        },
        {
          marketId: 1,
          marketName: "1x2",
          matchId: 72221256,
          odds: 1.23,
          outcomeId: "1",
          outcomeName: "Chelsea FC",
          specifier: "",
        },
      ],
      displayName: "BetBuilder",
      eventId: "72221256",
      eventName: "Chelsea FC vs Hull City",
      homeTeam: "Chelsea FC",
      id: "custombet:72221256:1",
      marketId: 18,
      marketName: "BetBuilder",
      matchId: "72221256",
      odds: 1.6002408849831082,
      outcomeId: "12",
      outcomeName: "2 CustomBet picks",
      selectionId: "custombet:72221256:1",
      specifier: "total=2.5",
      sportId: 1,
      sportName: "Football",
      startTime: "2026-09-12T14:00:00Z",
      tournamentName: "England - 17",
      type: "prematch",
    });
    await waitForAsyncWork();

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{
        betType: string;
        selections: Array<{
          customBet?: { legs?: Array<Record<string, unknown>> };
          type?: string;
        }>;
      }>;
    };
    expect(payload.bets).toHaveLength(1);
    expect(payload.bets[0].betType).toBe("single");
    expect(payload.bets[0].selections[0].type).toBe("custom_bet");
    expect(payload.bets[0].selections[0].customBet?.legs).toEqual([
      { marketId: 18, matchId: 72221256, outcomeId: "12", specifier: "total=2.5" },
      { marketId: 1, matchId: 72221256, outcomeId: "1", specifier: "" },
    ]);
  });

  it("recalculates single totals after per-selection stake updates", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("460", 2.0, "1"));
    store.addSelection(buildPlainSelection("461", 3.0, "1"));
    await waitForAsyncWork();
    store.setBetType("Single");
    store.updateStake(120, useCouponStore.getState().selections[0].selectionId);
    store.updateStake(80, useCouponStore.getState().selections[1].selectionId);

    const state = useCouponStore.getState();
    expect(state.totalStake).toBe(200);
    expect(state.maxWin).toBe(480);
  });

  it("builds banker indices into the system payload", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("470", 2.2, "1"));
    store.addSelection(buildPlainSelection("471", 2.3, "1"));
    store.addSelection(buildPlainSelection("472", 2.4, "1"));
    await waitForAsyncWork();
    store.setBetType("System");
    const [firstSelection, secondSelection] = useCouponStore.getState().selections;
    store.toggleBanker(firstSelection.selectionId);
    store.toggleBanker(secondSelection.selectionId);
    store.updateSystemStake(100, 2);
    await waitForAsyncWork();

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{ betType: string; system?: { bankers: number[]; sizes: number[] } }>;
    };
    expect(payload.bets[0].betType).toBe("system");
    expect(payload.bets[0].system?.bankers).toEqual([0, 1]);
    expect(payload.bets[0].system?.sizes).toEqual([2]);
  });

  it("supports play-all and per-size stakes for system bets", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("473", 2.2, "1"));
    store.addSelection(buildPlainSelection("474", 2.3, "1"));
    store.addSelection(buildPlainSelection("475", 2.4, "1"));
    await waitForAsyncWork();

    store.setBetType("System");
    store.updateSystemStake(100);
    store.updateSystemStake(250, 2);

    const state = useCouponStore.getState();
    const double = state.combos.find((combo) => combo.Grouping === 2);
    const treble = state.combos.find((combo) => combo.Grouping === 3);

    expect(double?.Stake).toBe(250);
    expect(treble?.Stake).toBe(100);
    expect(state.totalStake).toBe(
      Number(double?.Combinations || 0) * 250 + Number(treble?.Combinations || 0) * 100,
    );

    await store.placeBet();

    const payload = apiMocks.betsApi.placeBet.mock.calls[0][0] as {
      bets: Array<{ betType: string; system?: { sizes: number[]; unitStake: number[] } }>;
    };
    expect(payload.bets[0]).toMatchObject({
      betType: "system",
      system: {
        sizes: [2, 3],
        unitStake: [250, 100],
      },
    });
  });

  it("initializes system rows from combo minimum stake when switching to system", async () => {
    useCouponStore.setState((state) => ({
      ...state,
      globalVars: { ...(state.globalVars ?? {}), comboMinStake: 100 },
    }));
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("482", 2.2, "1"));
    store.addSelection(buildPlainSelection("483", 2.3, "1"));
    store.addSelection(buildPlainSelection("484", 2.4, "1"));
    await waitForAsyncWork();

    store.setBetType("System");

    const state = useCouponStore.getState();
    expect(state.combos.map((combo) => [combo.Grouping, combo.Stake])).toEqual([
      [2, 100],
      [3, 100],
    ]);
    expect(state.Groupings.map((combo) => combo.Grouping)).toEqual([2, 3]);
  });

  it("restores cached play-all system stake when switching back to system", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("485", 2.2, "1"));
    store.addSelection(buildPlainSelection("486", 2.3, "1"));
    store.addSelection(buildPlainSelection("487", 2.4, "1"));
    await waitForAsyncWork();

    store.setBetType("System");
    store.updateSystemStake(250);
    store.setBetType("Multiple");
    store.setBetType("System");

    const state = useCouponStore.getState();
    expect(state.combos.map((combo) => combo.Stake)).toEqual([250, 250]);
    expect(state.Groupings.map((combo) => combo.Grouping)).toEqual([2, 3]);
  });

  it("extends play-all system stake to newly available folds after adding a selection", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("488", 2.2, "1"));
    store.addSelection(buildPlainSelection("489", 2.3, "1"));
    store.addSelection(buildPlainSelection("490", 2.4, "1"));
    await waitForAsyncWork();

    store.setBetType("System");
    store.updateSystemStake(100);
    store.addSelection(buildPlainSelection("491", 2.5, "1"));
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.combos.map((combo) => [combo.Grouping, combo.Stake])).toEqual([
      [2, 100],
      [3, 100],
      [4, 100],
    ]);
  });

  it("keeps one staked system row isolated after adding a selection", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("492", 2.2, "1"));
    store.addSelection(buildPlainSelection("493", 2.3, "1"));
    store.addSelection(buildPlainSelection("494", 2.4, "1"));
    await waitForAsyncWork();

    store.setBetType("System");
    store.updateSystemStake(150, 2);
    store.addSelection(buildPlainSelection("495", 2.5, "1"));
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.combos.map((combo) => [combo.Grouping, combo.Stake])).toEqual([
      [2, 150],
      [3, 0],
      [4, 0],
    ]);
    expect(state.Groupings.map((combo) => combo.Grouping)).toEqual([2]);
  });

  it("keeps all available system fold options for a nine-selection slip", async () => {
    const store = useCouponStore.getState();
    for (let index = 0; index < 9; index += 1) {
      store.addSelection(buildPlainSelection(String(500 + index), 2.1 + index / 100, "1"));
    }
    await waitForAsyncWork();

    store.setBetType("System");

    const state = useCouponStore.getState();
    expect(state.combos.map((combo) => combo.Grouping)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.Groupings).toEqual([]);
    expect(state.combos.every((combo) => Number(combo.Stake || 0) === 0)).toBe(true);
  });

  it("dismissing success clears only the success state and preserves selections", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("480", 2.2, "1"));
    store.addSelection(buildPlainSelection("481", 2.3, "1"));
    await waitForAsyncWork();

    await store.placeBet();
    expect(useCouponStore.getState().betPlaced?.bookingCode).toBe("LURYL4");

    store.dismissSuccess();

    const state = useCouponStore.getState();
    expect(state.betPlaced).toBeNull();
    expect(state.selections).toHaveLength(2);
  });

  it("applies realtime odds changes to fixture-backed selections", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("505", 2.2, "1"));
    await waitForAsyncWork();

    store.handleOddsChange("505", [
      { marketId: "1", odds: 1.95, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await waitForAsyncWork();

    const selection = useCouponStore.getState().selections[0];
    expect(selection.odds).toBe(1.95);
    expect(selection.changed).toBe(true);
    expect(useCouponStore.getState().acceptChanges).toBe(false);
  });

  it("takes price rises on open selections without asking the player to accept", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("5060", 2.2, "1"));
    await waitForAsyncWork();
    const acceptBefore = useCouponStore.getState().acceptChanges;

    store.handleOddsChange("5060", [
      { marketId: "1", odds: 2.45, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await waitForAsyncWork();

    const selection = useCouponStore.getState().selections[0];
    expect(selection.odds).toBe(2.45);
    expect(selection.changed).toBeFalsy();
    expect(useCouponStore.getState().acceptChanges).toBe(acceptBefore);
  });

  it("recalculates previews from realtime odds changes before odds are accepted", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("5051", 2.2, "1"));
    store.addSelection(buildPlainSelection("5052", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    store.handleOddsChange("5051", [
      { marketId: "1", odds: 1.95, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(apiMocks.betsApi.previewAccaBonus).toHaveBeenCalledTimes(1);
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
    expect(useCouponStore.getState().acceptChanges).toBe(false);
  });

  it("does not call preview endpoints for realtime updates that do not change the selection", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("50509", 2.2, "1"));
    store.addSelection(buildPlainSelection("50510", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    store.handleOddsChange("50509", [
      { marketId: "1", odds: 2.2, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
  });

  it("restores an unavailable selection when a later realtime update marks it active again", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("50513", 2.2, "1"));
    await waitForAsyncWork();

    store.handleOddsChange("50513", [
      { marketId: "1", odds: 2.2, outcomeId: "1", specifier: "", statusName: "Unavailable" },
    ]);
    await waitForAsyncWork();

    expect(useCouponStore.getState().selections[0]?.odds).toBe(0);
    expect(useCouponStore.getState().selections[0]?.unavailable).toBe(true);

    store.handleOddsChange("50513", [
      { marketId: "1", odds: 2.45, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await waitForAsyncWork();

    expect(useCouponStore.getState().selections[0]?.odds).toBe(2.45);
    expect(useCouponStore.getState().selections[0]?.unavailable).toBe(false);
    expect(useCouponStore.getState().selections[0]?.suspended).toBe(false);
  });

  it("turns off Cut-1 immediately when an odds change makes the slip ineligible", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("50511", 2.2, "1"));
    store.addSelection(buildPlainSelection("50512", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    await store.toggleCutOne();
    await waitForAsyncWork();

    expect(useCouponStore.getState().useCutOne).toBe(true);

    store.handleOddsChange("50511", [
      { marketId: "1", odds: 1.1, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);

    expect(useCouponStore.getState().useCutOne).toBe(false);
  });

  it("turns off Flex immediately when the slip becomes ineligible", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("50521", 2.2, "1"));
    store.addSelection(buildPlainSelection("50522", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));
    await store.toggleFlex();
    await waitForAsyncWork();

    expect(useCouponStore.getState().useFlex).toBe(true);

    const selectionId = useCouponStore.getState().selections[0]?.selectionId;
    store.removeSelection(String(selectionId));

    expect(useCouponStore.getState().useFlex).toBe(false);
  });

  it("accepting odds changes clears the pending change state without triggering previews", async () => {
    const store = useCouponStore.getState();
    store.addSelection(buildPlainSelection("506", 2.2, "1"));
    store.addSelection(buildPlainSelection("507", 2.2, "1"));
    await waitForAsyncWork();
    useCouponStore.setState((state) => ({ ...state, isOpen: true }));

    store.handleOddsChange("506", [
      { marketId: "1", odds: 2.45, outcomeId: "1", specifier: "", statusName: "Active" },
    ]);
    await waitForAsyncWork();

    apiMocks.betsApi.previewAccaBonus.mockClear();
    apiMocks.betsApi.previewCutOne.mockClear();
    apiMocks.betsApi.previewFlex.mockClear();

    store.acceptOddsChanges();
    await waitForAsyncWork();

    const state = useCouponStore.getState();
    expect(state.acceptChanges).toBe(true);
    expect(state.selections.every((selection) => !selection.changed)).toBe(true);
    expect(apiMocks.betsApi.previewAccaBonus).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewCutOne).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.previewFlex).not.toHaveBeenCalled();
  });

  it("rebuilds a derived Early Goals selection from a load-code style response", async () => {
    const store = useCouponStore.getState();
    await store.rebuildBetslipFromLoadedSelections({
      selections: [
        {
          active: 1,
          eventName: "Mexico vs. South Africa",
          marketId: 60180,
          marketName: "Over/Under - Early Goals",
          matchId: 66456904,
          odds: 1.18,
          outcomeId: "12",
          outcomeName: "over 2.5",
          specifier: "minsnr=30|total=2.5",
          sportId: 1,
          startTime: "2026-06-11T19:00:00Z",
          statusName: "Active",
        },
      ],
    });

    const rebuilt = useCouponStore.getState().selections[0];
    expect(rebuilt.baseMarketId).toBe(18);
    expect(rebuilt.earlyGoalMode).toBe("earlygoal");
    expect(String(rebuilt.marketId)).toBe("60180");
    expect(rebuilt.selectionId).not.toBe(rebuilt.currentSelectionId);
  });

  it("rebuilds a derived 1UP selection from load-code data and preserves the stable base selection id", async () => {
    const store = useCouponStore.getState();

    await store.rebuildBetslipFromLoadedSelections({
      selections: [
        {
          active: 1,
          eventName: "Mexico vs. South Africa",
          marketId: 1601,
          marketName: "1X2 - XUP",
          matchId: 66456904,
          odds: 1.84,
          outcomeId: "1",
          outcomeName: "Home",
          specifier: "xup=1",
          sportId: 1,
          startTime: "2026-06-11T19:00:00Z",
          statusName: "Active",
        },
      ],
    });

    const rebuilt = useCouponStore.getState().selections[0];
    expect(rebuilt.baseMarketId).toBe(1);
    expect(rebuilt.earlyWinMode).toBe("1up");
    expect(String(rebuilt.marketId)).toBe("1601");
    expect(rebuilt.selectionId).toBe("66456904_1_1");
    expect(rebuilt.selectionId).not.toBe(rebuilt.currentSelectionId);
  });

  it("switches a rebuilt derived 1UP selection to 2UP by validating the alternate derived market on demand", async () => {
    const store = useCouponStore.getState();

    await store.rebuildBetslipFromLoadedSelections({
      selections: [
        {
          active: 1,
          eventName: "Mexico vs. South Africa",
          marketId: 1601,
          marketName: "1X2 - XUP",
          matchId: 66456904,
          odds: 1.84,
          outcomeId: "1",
          outcomeName: "Home",
          specifier: "xup=1",
          sportId: 1,
          startTime: "2026-06-11T19:00:00Z",
          statusName: "Active",
        },
      ],
    });

    apiMocks.betsApi.validateSelections.mockClear();
    apiMocks.betsApi.validateSelections.mockResolvedValueOnce({
      data: [
        {
          match_id: 66456904,
          market_id: 1601,
          odds: 1.72,
          outcome_id: "1",
          specifier: "xup=2",
          status_name: "Active",
        },
      ],
      status_code: 200,
    } as ValidateSelectionsResponse);
    const initial = useCouponStore.getState().selections[0];
    await store.setSelectionEarlyWinMode(initial.selectionId, "2up", { skipPreviewRefresh: true });

    const next = useCouponStore.getState().selections[0];
    const validatePayload = apiMocks.betsApi.validateSelections.mock.calls.at(-1)?.[0] as
      | Array<Record<string, unknown>>
      | undefined;

    expect(validatePayload?.[0]).toMatchObject({
      market_id: 1601,
      match_id: 66456904,
      outcome_id: "1",
      specifier: "xup=2",
    });
    expect(next.selectionId).toBe(initial.selectionId);
    expect(next.currentSelectionId).not.toBe(initial.currentSelectionId);
    expect(next.earlyWinMode).toBe("2up");
    expect(String(next.marketId)).toBe("1601");
    expect(next.specifier).toBe("xup=2");
  });

  it("reports an abandoned betslip after inactivity and ignores empty slips", async () => {
    vi.useFakeTimers();
    useUserStore.setState((state) => ({
      ...state,
      currentUser: {
        availableBalance: 1200,
        casinoBonusBalance: 0,
        currency: "NGN",
        id: "252",
        sportBonusBalance: 0,
        trustBalance: 0,
        username: "08012345678",
        virtualBonusBalance: 0,
      },
    }));
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true, token: "test-token" }));

    const store = useCouponStore.getState();
    store.startAbandonedBetslipTracker();
    store.addSelection(buildOneUpSelection("100"));

    await Promise.resolve();

    expect(apiMocks.betsApi.reportBetslipActivity).toHaveBeenCalledTimes(1);
    expect(apiMocks.betsApi.reportBetslipActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "252",
        user_id: "252",
        username: "08012345678",
        sessionId: expect.any(String),
        totalLegs: 1,
        potentialPayout: expect.any(Number),
        betslipSnapshot: expect.objectContaining({
          selections: expect.arrayContaining([
            expect.objectContaining({
              fixtureId: "100",
              marketId: 1,
              outcomeId: "1",
            }),
          ]),
        }),
      }),
    );
    expect(apiMocks.betsApi.reportBetslipAbandoned).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await Promise.resolve();

    expect(apiMocks.betsApi.reportBetslipAbandoned).toHaveBeenCalledTimes(1);
    expect(apiMocks.betsApi.reportBetslipAbandoned).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "252",
        user_id: "252",
        username: "08012345678",
        totalLegs: 1,
        sessionId: expect.any(String),
        eventId: expect.any(String),
        betslipSnapshot: expect.objectContaining({
          selections: expect.arrayContaining([
            expect.objectContaining({
              fixtureId: "100",
              marketId: 1,
              outcomeId: "1",
            }),
          ]),
        }),
      }),
    );

    apiMocks.betsApi.reportBetslipAbandoned.mockClear();
    store.clearSlip();
    await Promise.resolve();

    expect(apiMocks.betsApi.closeBetslipSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        status: "cleared",
      }),
    );

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await Promise.resolve();

    expect(apiMocks.betsApi.reportBetslipAbandoned).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not report abandoned betslip activity without an active user session", async () => {
    vi.useFakeTimers();

    const store = useCouponStore.getState();
    store.startAbandonedBetslipTracker();
    store.addSelection(buildOneUpSelection("101"));

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await Promise.resolve();

    expect(apiMocks.betsApi.reportBetslipActivity).not.toHaveBeenCalled();
    expect(apiMocks.betsApi.reportBetslipAbandoned).not.toHaveBeenCalled();

    store.stopAbandonedBetslipTracker();
    vi.useRealTimers();
  });
});
