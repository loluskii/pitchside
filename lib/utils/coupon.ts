export function getPlacedBetStatus(status: number): string {
  switch (status) {
    case 0: return "Pending";
    case 1: return "Won";
    case 2: return "Lost";
    case 3: return "Cancelled";
    case 4: return "Void";
    default: return "Unknown";
  }
}

export function createID(
  matchID: number | string,
  marketID: number | string,
  outcomeID: number | string,
  specifier = "",
  marketName = "",
  outcomeName = "",
): string {
  void marketName;
  void outcomeName;
  const cleanSpecifier = String(specifier || "").trim();
  return `${matchID}_${marketID}_${outcomeID}${cleanSpecifier ? `_${cleanSpecifier}` : ""}`;
}

export function getCouponSelectionKeySpecifier(
  market: Record<string, unknown>,
  outcome: Record<string, unknown>,
): string {
  const outcomeSpecifier = String(outcome.specifier ?? outcome.specifiers ?? "").trim();
  const marketSpecifier = String(market.specifier ?? market.specifiers ?? "").trim();
  return outcomeSpecifier || marketSpecifier;
}

export function getCouponSelectionRequestSpecifier(
  market: Record<string, unknown>,
  outcome: Record<string, unknown>,
): string {
  return getCouponSelectionKeySpecifier(market, outcome);
}

export function buildCouponSelectionElementId({
  fixture = {},
  market = {},
  outcome = {},
  marketName = "",
}: {
  fixture?: Record<string, unknown>;
  market?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  marketName?: string;
}): string {
  const matchId = fixture.matchID ?? fixture.match_id ?? fixture.gameID ?? fixture.game_id ?? "";
  const marketId =
    market.marketID ?? market.marketId ?? market.market_id ??
    outcome.marketID ?? outcome.marketId ?? outcome.market_id ?? "";
  const outcomeId = outcome.outcomeID ?? outcome.outcomeId ?? outcome.outcome_id ?? outcome.id ?? "";
  const name = String(marketName || market.marketName || market.market_name || market.name || "").trim();
  const outcomeName = String(
    outcome.outcomeName || outcome.outcome_name || outcome.name || outcome.displayName || "",
  ).trim();
  const specifier = getCouponSelectionKeySpecifier(market, outcome);

  return createID(matchId as string, marketId as string, outcomeId as string, specifier, name, outcomeName);
}

export function buildCouponSelectionPayload({
  fixture = {},
  market = {},
  outcome = {},
  marketName = "",
  type = "prematch",
}: {
  fixture?: Record<string, unknown>;
  market?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  marketName?: string;
  type?: string;
}): Record<string, unknown> {
  const resolvedMarketName = String(
    marketName || market.marketName || market.market_name || market.name || "",
  ).trim();
  const marketId =
    market.marketID ?? market.marketId ?? market.market_id ??
    outcome.marketID ?? outcome.marketId ?? outcome.market_id ?? "";
  const outcomeId = outcome.outcomeID ?? outcome.outcomeId ?? outcome.outcome_id ?? outcome.id ?? "";
  const outcomeName = String(
    outcome.outcomeName || outcome.outcome_name || outcome.name || outcome.displayName || "",
  ).trim();
  const selectionKeySpecifier = getCouponSelectionKeySpecifier(market, outcome);

  return {
    fixture,
    market_name: resolvedMarketName,
    market_id: marketId,
    ele_id: buildCouponSelectionElementId({ fixture, market, outcome, marketName: resolvedMarketName }),
    selection_key_specifier: selectionKeySpecifier,
    outcome,
    odds: outcome.odds,
    odd_id: outcomeId,
    odd_name: outcomeName,
    type,
    event_id: fixture.matchID ?? fixture.match_id ?? fixture.gameID ?? fixture.game_id ?? "",
    specifier: getCouponSelectionRequestSpecifier(market, outcome),
  };
}

export function isSelected(
  eleId: string,
  coupon: { selections: { currentSelectionId?: string; selectionId?: string }[] },
): boolean {
  return coupon.selections.some(
    (s) => String(s.currentSelectionId || s.selectionId || "") === String(eleId),
  );
}

export function liveScore(score: string | null | undefined, team: "home" | "away"): string {
  if (!score) return "";
  const parts = score.split(":");
  return team === "home" ? parts[0] : parts[1];
}

export function calculateBonus(
  coupondata: { selections: { odds: number }[]; totalStake: number },
  globalVars: { MinBonusOdd: number } | null | undefined,
  bonusList: { ticket_length: number; bonus: number }[] | null | undefined,
): number {
  if (!globalVars || !bonusList) return 0;
  let ticketLength = 0;
  let totalBonusOdds = 1;
  const minBonusOdd = globalVars.MinBonusOdd;
  let bonusInfo: { bonus?: number } = {};

  coupondata.selections.forEach((item) => {
    if (item.odds >= minBonusOdd) {
      totalBonusOdds *= item.odds;
      ticketLength++;
    }
  });

  bonusList.forEach((item) => {
    if (item.ticket_length === ticketLength) bonusInfo = item;
  });

  if (bonusInfo.bonus !== undefined) {
    const maxWin = totalBonusOdds * coupondata.totalStake;
    return (maxWin * parseFloat(String(bonusInfo.bonus))) / 100;
  }
  return 0;
}

export function calculateWinnings(
  couponData: { totalOdds: number | string; totalStake: number | string; selections: { odds: number }[] },
  globalVars: { MinBonusOdd: number } | null | undefined,
  bonusList: { ticket_length: number; bonus: number }[] | null | undefined,
): { maxWin: string; grossWin: number; maxBonus: number; wthTax: number } {
  const maxWin =
    parseFloat(String(couponData.totalOdds)) * parseFloat(String(couponData.totalStake));
  const maxBonus = calculateBonus(
    couponData as Parameters<typeof calculateBonus>[0],
    globalVars,
    bonusList,
  );
  const total = maxWin + maxBonus;
  const wthTax = ((total - parseFloat(String(couponData.totalStake))) * 0) / 100;
  return { maxWin: (total - wthTax).toFixed(2), grossWin: total, maxBonus, wthTax };
}

export function calculateTotalOdds(selections: { odds: number }[]): number {
  return selections.reduce((total, s) => total * s.odds, 1);
}

export function groupSelections(
  data: {
    matchId: number | string;
    eventName: string;
    eventId: number | string;
    type: string;
    eventDate: string;
    score?: string;
  }[],
) {
  const keyHolder: Record<
    string,
    { eventName: string; eventId: unknown; type: string; started: string; score?: string; selections: unknown[] }
  > = {};
  const arr: (typeof keyHolder)[string][] = [];

  data.forEach((item) => {
    const key = String(item.matchId);
    if (!keyHolder[key]) {
      keyHolder[key] = {
        eventName: item.eventName,
        eventId: item.eventId,
        type: item.type,
        started: item.eventDate,
        score: item.score,
        selections: [],
      };
      arr.push(keyHolder[key]);
    }
    keyHolder[key].selections.push(item);
  });

  return arr;
}

export function groupTournament(
  data: {
    tournament: string;
    category: string;
    combinability: unknown;
    matchId: number | string;
    eventName: string;
    eventId: number | string;
    type: string;
    eventDate: string;
    score?: string;
  }[],
) {
  const keyHolder: Record<
    string,
    { tournamentName: string; category: string; combinability: unknown; events: typeof data; fixtures: ReturnType<typeof groupSelections> }
  > = {};
  const arr: (typeof keyHolder)[string][] = [];

  data.forEach((item) => {
    if (!keyHolder[item.tournament]) {
      keyHolder[item.tournament] = {
        tournamentName: item.tournament,
        category: item.category,
        combinability: item.combinability,
        events: [],
        fixtures: [],
      };
      arr.push(keyHolder[item.tournament]);
    }
    keyHolder[item.tournament].events.push(item);
    keyHolder[item.tournament].fixtures = groupSelections(keyHolder[item.tournament].events);
  });

  return arr;
}

export function multibetCombination(item: unknown[]): string | number {
  if (item.length === 1) return "Single";
  if (item.length <= 2) return "Doubles";
  if (item.length <= 3) return "Trebles";
  return item.length;
}

export function comboName(len: number): string {
  switch (len) {
    case 1: return " Singles";
    case 2: return " Doubles";
    case 3: return " Trebles";
    default: return " " + len + " folds";
  }
}

export function displayComboName(grouping: number): string {
  switch (grouping) {
    case 1: return "Single";
    case 2: return "Double";
    case 3: return "Treble";
    default: return grouping + " folds";
  }
}

export function checkBetType(grouped: { selections: unknown[] }[]): "Multiple" | "Split" {
  return grouped.some((item) => item.selections.length > 1) ? "Split" : "Multiple";
}

export function checkIfHasLive(selections: { type: string }[]): boolean {
  return selections.some((item) => item.type === "live");
}

export function checkNoOfDraws(selections: { oddname?: string }[]): boolean {
  const draws = selections.filter((s) => s.oddname === "X").length;
  return draws === selections.length && draws > 5;
}

export function validateCombinability(
  noOfFixtures: number,
  tournaments: { combinability: string; category: string; tournamentName: string }[],
): { success: boolean; message?: string } {
  let res: { success: boolean; message?: string } = { success: true };
  for (const t of tournaments) {
    if (t.combinability === "double" && noOfFixtures < 2)
      res = { success: false, message: `You must select minimum of 2 games with ${t.category} -> ${t.tournamentName}` };
    else if (t.combinability === "treble" && noOfFixtures < 3)
      res = { success: false, message: `You must select minimum of 3 games with ${t.category} -> ${t.tournamentName}` };
    else if (t.combinability === "min_5" && noOfFixtures < 5)
      res = { success: false, message: `You must select minimum of 5 games with ${t.category} -> ${t.tournamentName}` };
  }
  return res;
}

export function calculateSplitProps<
  T extends {
    selections?: { matchId?: number | string; odds?: number }[];
    stake?: number;
    totalStake?: number;
    minOdds?: number; maxOdds?: number;
    minWin?: number; maxWin?: number;
    maxBonus?: number; minBonus?: number;
    minStake?: number | string;
    noOfCombos?: number;
  },
>(couponData: T): T {
  const prev = {
    minOdds: Number(couponData?.minOdds || 0),
    maxOdds: Number(couponData?.maxOdds || 0),
    minWin: Number(couponData?.minWin || 0),
    maxWin: Number(couponData?.maxWin || 0),
    maxBonus: Number(couponData?.maxBonus || 0),
    minBonus: Number(couponData?.minBonus || 0),
    minStake: couponData?.minStake ?? "",
  };

  const selections = couponData?.selections || [];
  const grouped: Record<string, typeof selections> = {};
  selections.forEach((s) => {
    const key = String(s?.matchId || "");
    if (!key) return;
    grouped[key] = grouped[key] || [];
    grouped[key].push(s);
  });

  const groups = Object.values(grouped);
  const noOfCombos = groups.length > 0 ? groups.reduce((acc, g) => acc * g.length, 1) : 0;

  let minOdds = 0, maxOdds = 0;
  if (groups.length > 0) {
    minOdds = 1; maxOdds = 1;
    groups.forEach((group) => {
      const odds = group.map((i) => Number(i?.odds)).filter((v) => Number.isFinite(v));
      if (!odds.length) return;
      minOdds *= Math.min(...odds);
      maxOdds *= odds.reduce((sum, v) => sum + v, 0);
    });
  }

  const stake = Number(couponData?.stake || couponData?.totalStake || 0);
  couponData.noOfCombos = noOfCombos;
  couponData.minOdds = minOdds > 0 ? Number(minOdds.toFixed(2)) : prev.minOdds;
  couponData.maxOdds = maxOdds > 0 ? Number(maxOdds.toFixed(2)) : prev.maxOdds;
  couponData.maxBonus = prev.maxBonus || 0;
  couponData.minWin = Number((minOdds > 0 && stake ? minOdds * stake : prev.minWin).toFixed(2));
  couponData.maxWin = Number((maxOdds > 0 && stake ? maxOdds * stake : prev.maxWin).toFixed(2));
  couponData.minStake = stake > 0 ? stake : prev.minStake;
  couponData.minBonus = prev.minBonus || 0;
  return couponData;
}

export async function getSplitProps<
  T extends {
    selections?: { matchId?: number | string; odds?: number }[];
    stake?: number;
    totalStake?: number;
    minOdds?: number; maxOdds?: number;
    minWin?: number; maxWin?: number;
    maxBonus?: number; minBonus?: number;
    minStake?: number | string;
    noOfCombos?: number;
  },
>(couponData: T): Promise<T> {
  return calculateSplitProps(couponData);
}
