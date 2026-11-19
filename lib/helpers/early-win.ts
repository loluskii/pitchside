export const DEFAULT_DERIVED_MARKET_CONFIG: Record<
  string,
  {
    baseLabel: string;
    featureMarketId?: number;
    modes: {
      key: Exclude<DerivedSelectionMode, "base">;
      id: number;
      label: string;
      specifier?: string;
    }[];
  }
> = {
  1: {
    baseLabel: "1X2 Base",
    featureMarketId: 1601,
    modes: [
      { key: "1up", id: 1601, label: "1UP", specifier: "xup=1" },
      { key: "2up", id: 1601, label: "2UP", specifier: "xup=2" },
    ],
  },
  18: {
    baseLabel: "Over/Under Base",
    modes: [{ key: "earlygoal", id: 60180, label: "Early Goals" }],
  },
};

export type DerivedSelectionMode = "base" | "1up" | "2up" | "earlygoal";

export const EARLY_WIN_MODE_KEYS = ["1up", "2up"] as const;
export const EARLY_WIN_MODE_LABELS: Record<DerivedSelectionMode, string> = {
  base: "Base",
  "1up": "1UP",
  "2up": "2UP",
  earlygoal: "Early Goals",
};
export const EARLY_WIN_DEFAULT_MODE = "2up";
export const EARLY_WIN_FOOTBALL_SPORT_ID = 1;
export const EARLY_WIN_BASE_MARKET_ID = 1;
export const X_UP_FEATURE_MARKET_ID = 1601;
export const EARLY_GOAL_BASE_MARKET_ID = 18;
export const EARLY_GOAL_DERIVED_MARKET_ID = 60180;
export const EARLY_GOAL_ALLOWED_TOTALS = ["1.5", "2.5", "3.5"] as const;

const BASE_MARKET_BY_DERIVED_ID = new Map<number, number>();
const DERIVED_MARKET_BY_BASE_AND_MODE = new Map<number, Map<string, number>>();
const DERIVED_SPECIFIER_BY_BASE_AND_MODE = new Map<number, Map<string, string>>();

Object.entries(DEFAULT_DERIVED_MARKET_CONFIG).forEach(([baseMarketId, config]) => {
  const modeMap = new Map<string, number>();
  const specifierMap = new Map<string, string>();
  (config?.modes || []).forEach((mode) => {
    const marketId = Number(mode.id);
    modeMap.set(mode.key, marketId);
    if (mode.specifier) specifierMap.set(mode.key, mode.specifier);
    if (!BASE_MARKET_BY_DERIVED_ID.has(marketId)) {
      BASE_MARKET_BY_DERIVED_ID.set(marketId, Number(baseMarketId));
    }
  });
  DERIVED_MARKET_BY_BASE_AND_MODE.set(Number(baseMarketId), modeMap);
  DERIVED_SPECIFIER_BY_BASE_AND_MODE.set(Number(baseMarketId), specifierMap);
});

export interface FixtureMarket {
  marketID?: number | string;
  marketId?: number | string;
  market_id?: number | string;
  id?: number | string;
  marketName?: string;
  market_name?: string;
  name?: string;
  specifier?: string;
  specifiers?: string;
  statusName?: string;
  status_name?: string;
  marketExtendVOS?: Array<{
    name?: string;
    rootMarketId?: string | number;
    nodeMarketId?: string | number;
    nodeSpecifier?: string;
    notSupport?: boolean;
  }>;
  outcomes?: FixtureOutcome[];
}

export interface FixtureOutcome {
  marketID?: number | string;
  marketId?: number | string;
  market_id?: number | string;
  outcomeID?: string | number;
  outcomeId?: string | number;
  id?: string | number;
  outcomeName?: string;
  outcome_name?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  specifier?: string;
  specifiers?: string;
  active?: number | boolean;
  isActive?: number | boolean;
  odds?: number | string;
  probability?: number | string;
  sourceIndex?: number;
}

export interface EarlyWinFixture {
  market?: FixtureMarket[];
  markets?: FixtureMarket[];
  outcomes?: FixtureOutcome[];
}

export interface EarlyWinQuote {
  marketId: number;
  marketName: string;
  specifier: string;
  idSpecifier: string;
  outcomeId: string;
  outcomeName: string;
  displayName: string;
  odds: number;
  active: number;
  statusName: string;
}

export interface EarlyWinSelectionState {
  baseMarketId: number;
  baseMarketName: string;
  earlyWinMode: DerivedSelectionMode;
  explicitDerivedMarketIds: number[];
  hasExplicitDerivedMarkets: boolean;
  supportedDerivedMarketIds: number[];
  supportedEarlyWinModes: string[];
  supportsEarlyWin: boolean;
  currentMarketName: string;
}

export interface EarlyGoalSelectionState {
  baseMarketId: number;
  baseMarketName: string;
  earlyGoalMode: DerivedSelectionMode;
  explicitDerivedMarketIds: number[];
  isEarlyGoalMarketCandidate: boolean;
  hasExplicitDerivedMarkets: boolean;
  supportedDerivedMarketIds: number[];
  supportsEarlyGoal: boolean;
  currentMarketName: string;
}

interface OutcomeReference {
  outcomeId?: string;
  outcomeName?: string;
  displayName?: string;
  specifier?: string;
  idSpecifier?: string;
  sourceIndex?: number;
}

export const normalizeEarlyWinMode = (mode: string): DerivedSelectionMode =>
  (mode === "1up" || mode === "2up" || mode === "earlygoal" ? mode : "base");

export const getEarlyWinModeFromSpecifier = (specifier = ""): DerivedSelectionMode => {
  const xup = getSpecifierValue(specifier, "xup");
  if (xup === "1") return "1up";
  if (xup === "2") return "2up";
  return "base";
};

const inferEarlyWinModeFromMarketName = (marketName = ""): DerivedSelectionMode => {
  const suffixMatch = String(marketName || "")
    .trim()
    .match(/(?:^|[-–])\s*(1|2|3)\s*up$/i);

  if (!suffixMatch) return "base";

  return normalizeEarlyWinMode(`${suffixMatch[1]}up`);
};

export const normalizeDerivedMarketIds = (input: unknown): number[] => {
  const values = Array.isArray(input) ? input : input != null ? [input] : [];
  return [...new Set(values.map(Number).filter((id) => Number.isFinite(id)))];
};

export const isFootballSport = (sportId: number | string): boolean =>
  Number(sportId) === EARLY_WIN_FOOTBALL_SPORT_ID;

export const getEarlyWinModeFromMarketId = (
  marketId: number | string,
  specifier = "",
): DerivedSelectionMode => {
  if (Number(marketId) !== X_UP_FEATURE_MARKET_ID) return "base";
  return getEarlyWinModeFromSpecifier(specifier);
};

export const getFeatureMarketIdForMode = (mode = "base"): number | "" => {
  const normalizedMode = normalizeEarlyWinMode(mode);
  if (normalizedMode === "1up" || normalizedMode === "2up") return X_UP_FEATURE_MARKET_ID;
  if (normalizedMode === "earlygoal") return EARLY_GOAL_DERIVED_MARKET_ID;
  return "";
};

export const getDerivedSpecifierForMode = (
  baseMarketId: number | string,
  mode = "base",
): string => {
  const normalizedMode = normalizeEarlyWinMode(mode);
  return (
    DERIVED_SPECIFIER_BY_BASE_AND_MODE.get(Number(baseMarketId || 0))?.get(normalizedMode) ||
    ""
  );
};

export const getBaseMarketIdFromMarketId = (marketId: number | string): number =>
  BASE_MARKET_BY_DERIVED_ID.get(Number(marketId)) || Number(marketId || 0);

export const stripEarlyWinSuffix = (marketName = ""): string =>
  String(marketName || "")
    .replace(/\s*[-–]?\s*(xup|(1|2)up)$/i, "")
    .trim();

export const formatEarlyWinMarketName = (
  baseMarketName = "",
  mode: DerivedSelectionMode = "base",
): string => {
  const safeBaseName = String(baseMarketName || "").trim();
  if (mode === "base") return safeBaseName;
  return [safeBaseName, mode === "1up" || mode === "2up" ? "XUP" : EARLY_WIN_MODE_LABELS[mode]]
    .filter(Boolean)
    .join(" - ");
};

export const stripEarlyGoalSuffix = (marketName = ""): string =>
  String(marketName || "")
    .replace(/\s*[-–]?\s*early goals$/i, "")
    .trim();

export const formatEarlyGoalMarketName = (
  baseMarketName = "",
  mode: DerivedSelectionMode = "base",
): string => {
  const safeBaseName = String(baseMarketName || "").trim();
  if (mode === "base") return safeBaseName;
  return [safeBaseName, EARLY_WIN_MODE_LABELS[mode]].filter(Boolean).join(" - ");
};

const normalizeFixtureText = (value = "") => String(value || "").trim().toLowerCase();

const getFixtureMarkets = (fixture: EarlyWinFixture): FixtureMarket[] => {
  if (Array.isArray(fixture?.market)) return fixture.market;
  if (Array.isArray(fixture?.markets)) return fixture.markets;
  return [];
};

const getFixtureFlatOutcomes = (fixture: EarlyWinFixture): FixtureOutcome[] =>
  Array.isArray(fixture?.outcomes) ? fixture.outcomes : [];

const getFixtureMarketId = (market: FixtureMarket): number =>
  Number(market.marketID ?? market.marketId ?? market.market_id ?? market.id ?? 0);

const getFixtureMarketName = (market: FixtureMarket): string =>
  String(market.marketName ?? market.market_name ?? market.name ?? "").trim();

const getFixtureMarketSpecifier = (market: FixtureMarket): string =>
  String(market.specifier ?? market.specifiers ?? "");

const getFixtureMarketStatus = (market: FixtureMarket): string =>
  String(market.statusName ?? market.status_name ?? "").trim();

const getFixtureOutcomeId = (outcome: FixtureOutcome): string =>
  String(outcome.outcomeID ?? outcome.outcomeId ?? outcome.id ?? "");

const getFixtureOutcomeSpecifier = (outcome: FixtureOutcome): string =>
  String(outcome.specifier ?? outcome.specifiers ?? "");

const getFixtureOutcomeName = (outcome: FixtureOutcome): string =>
  String(
    outcome.outcomeName ??
      outcome.outcome_name ??
      outcome.name ??
      outcome.displayName ??
      outcome.display_name ??
      "",
  ).trim();

const getFixtureOutcomeDisplayName = (outcome: FixtureOutcome): string =>
  String(
    outcome.displayName ??
      outcome.display_name ??
      outcome.outcomeName ??
      outcome.outcome_name ??
      outcome.name ??
      "",
  ).trim();

const getFixtureOutcomeActive = (outcome: FixtureOutcome): number =>
  Number(outcome.active ?? outcome.isActive ?? 1);

const getConfiguredDerivedMarketIds = (baseMarketId: number | string): number[] => {
  const modeMap = DERIVED_MARKET_BY_BASE_AND_MODE.get(Number(baseMarketId || 0));
  return modeMap ? [...modeMap.values()] : [];
};

const splitSpecifierSegments = (specifier = "") =>
  String(specifier || "")
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

export const getSpecifierValue = (specifier = "", key = ""): string => {
  const normalizedKey = String(key || "").trim().toLowerCase();
  if (!normalizedKey) return "";

  const segment = splitSpecifierSegments(specifier).find((part) =>
    part.toLowerCase().startsWith(`${normalizedKey}=`),
  );

  return segment ? segment.split("=").slice(1).join("=").trim() : "";
};

export const toEarlyGoalBaseSpecifier = (specifier = ""): string => {
  const total = getSpecifierValue(specifier, "total");
  return total ? `total=${total}` : String(specifier || "");
};

const isSupported1x2DerivedOutcome = ({
  outcomeId,
  displayName = "",
  outcomeName = "",
}: {
  outcomeId?: string | number;
  displayName?: string;
  outcomeName?: string;
}) => {
  const normalizedOutcomeId = String(outcomeId || "").trim();
  if (normalizedOutcomeId === "1" || normalizedOutcomeId === "3") {
    return true;
  }

  const normalizedLabel = String(displayName || outcomeName || "")
    .trim()
    .toLowerCase();

  return normalizedLabel === "1" || normalizedLabel === "2";
};

const isSupportedEarlyGoalOutcome = ({
  outcomeId,
  specifier = "",
}: {
  outcomeId?: string | number;
  specifier?: string;
}) => {
  const normalizedOutcomeId = String(outcomeId || "").trim();
  const total = getSpecifierValue(specifier, "total");
  return normalizedOutcomeId === "12" && EARLY_GOAL_ALLOWED_TOTALS.includes(total as never);
};

export const isSupportedDerivedOutcome = ({
  marketId,
  baseMarketId,
  mode = "base",
  outcomeId,
  outcomeName = "",
  displayName = "",
  specifier = "",
}: {
  marketId?: number | string;
  baseMarketId?: number | string;
  mode?: string;
  outcomeId?: string | number;
  outcomeName?: string;
  displayName?: string;
  specifier?: string;
}) => {
  const normalizedMode = normalizeEarlyWinMode(mode);
  const normalizedBaseMarketId = Number(baseMarketId || getBaseMarketIdFromMarketId(marketId || 0));
  const normalizedMarketId = Number(marketId || 0);

  if (
    normalizedBaseMarketId === EARLY_WIN_BASE_MARKET_ID &&
    (normalizedMode === "1up" ||
      normalizedMode === "2up" ||
      normalizedMarketId === X_UP_FEATURE_MARKET_ID)
  ) {
    return isSupported1x2DerivedOutcome({ outcomeId, displayName, outcomeName });
  }

  if (
    normalizedBaseMarketId === EARLY_GOAL_BASE_MARKET_ID &&
    (normalizedMode === "earlygoal" || normalizedMarketId === EARLY_GOAL_DERIVED_MARKET_ID)
  ) {
    return isSupportedEarlyGoalOutcome({ outcomeId, specifier });
  }

  return true;
};

export const specifierMatches = (candidateSpecifier = "", referenceSpecifier = ""): boolean => {
  const normalizedCandidate = String(candidateSpecifier || "");
  const normalizedReference = String(referenceSpecifier || "");

  if (!normalizedReference) return true;
  if (!normalizedCandidate) return false;
  if (normalizedCandidate === normalizedReference) return true;

  const candidateSegments = splitSpecifierSegments(normalizedCandidate);
  const referenceSegments = splitSpecifierSegments(normalizedReference);

  if (!referenceSegments.length) return normalizedCandidate === normalizedReference;

  return referenceSegments.every((segment) => candidateSegments.includes(segment));
};

const findFixtureMarket = (
  markets: FixtureMarket[],
  marketId: number | string,
  specifier = "",
): FixtureMarket | null => {
  const candidates = markets.filter((market) => getFixtureMarketId(market) === Number(marketId));
  if (!candidates.length) return null;

  const normalizedSpecifier = String(specifier || "");
  return (
    candidates.find((market) =>
      specifierMatches(getFixtureMarketSpecifier(market), normalizedSpecifier),
    ) || candidates[0]
  );
};

const findFixtureOutcomes = (
  outcomes: FixtureOutcome[],
  marketId: number | string,
  specifier = "",
): FixtureOutcome[] => {
  const candidates = outcomes.filter(
    (outcome) =>
      Number(outcome.marketID ?? outcome.marketId ?? outcome.market_id ?? 0) === Number(marketId),
  );
  if (!candidates.length) return [];

  const normalizedSpecifier = String(specifier || "");
  const exactMatches = candidates.filter((outcome) =>
    specifierMatches(getFixtureOutcomeSpecifier(outcome), normalizedSpecifier),
  );

  return exactMatches.length ? exactMatches : candidates;
};

const findOutcomeIndex = (
  market: { outcomes?: FixtureOutcome[] },
  reference: OutcomeReference = {},
): number => {
  const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
  if (!outcomes.length) return -1;

  const targetOutcomeId = String(reference.outcomeId || "");
  const targetSpecifier = String(reference.specifier || reference.idSpecifier || "");
  if (targetOutcomeId) {
    const idIndex = outcomes.findIndex((outcome) => {
      if (getFixtureOutcomeId(outcome) !== targetOutcomeId) return false;
      if (!targetSpecifier) return true;
      return specifierMatches(getFixtureOutcomeSpecifier(outcome), targetSpecifier);
    });
    if (idIndex !== -1) return idIndex;
  }

  if (targetSpecifier) {
    const specifierIndex = outcomes.findIndex((outcome) =>
      specifierMatches(getFixtureOutcomeSpecifier(outcome), targetSpecifier),
    );
    if (specifierIndex !== -1) return specifierIndex;
  }

  const candidateNames = [
    normalizeFixtureText(reference.outcomeName),
    normalizeFixtureText(reference.displayName),
  ].filter(Boolean);

  if (candidateNames.length) {
    const nameIndex = outcomes.findIndex((outcome) => {
      const outcomeNames = [
        normalizeFixtureText(getFixtureOutcomeName(outcome)),
        normalizeFixtureText(getFixtureOutcomeDisplayName(outcome)),
      ].filter(Boolean);
      return candidateNames.some((name) => outcomeNames.includes(name));
    });
    if (nameIndex !== -1) return nameIndex;
  }

  return -1;
};

const findOutcomeByReference = (
  market: { outcomes?: FixtureOutcome[] },
  reference: OutcomeReference = {},
  options: { allowSpecifierOnlyMatch?: boolean; allowSourceIndexMatch?: boolean } = {},
): FixtureOutcome | null => {
  const { allowSpecifierOnlyMatch = true, allowSourceIndexMatch = true } = options;
  const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
  if (!outcomes.length) return null;

  const targetOutcomeId = String(reference.outcomeId || "");
  const targetSpecifier = String(reference.specifier || reference.idSpecifier || "");
  if (targetOutcomeId) {
    const byId = outcomes.find((outcome) => {
      if (getFixtureOutcomeId(outcome) !== targetOutcomeId) return false;
      if (!targetSpecifier) return true;
      return specifierMatches(getFixtureOutcomeSpecifier(outcome), targetSpecifier);
    });
    if (byId) return byId;
  }

  if (targetSpecifier && allowSpecifierOnlyMatch) {
    const bySpecifier = outcomes.find((outcome) =>
      specifierMatches(getFixtureOutcomeSpecifier(outcome), targetSpecifier),
    );
    if (bySpecifier) return bySpecifier;
  }

  const candidateNames = [
    normalizeFixtureText(reference.outcomeName),
    normalizeFixtureText(reference.displayName),
  ].filter(Boolean);

  if (candidateNames.length) {
    const byName = outcomes.find((outcome) => {
      const outcomeNames = [
        normalizeFixtureText(getFixtureOutcomeName(outcome)),
        normalizeFixtureText(getFixtureOutcomeDisplayName(outcome)),
      ].filter(Boolean);
      return candidateNames.some((name) => outcomeNames.includes(name));
    });
    if (byName) return byName;
  }

  const sourceIndex = Number(reference.sourceIndex);
  if (
    allowSourceIndexMatch &&
    Number.isInteger(sourceIndex) &&
    sourceIndex >= 0 &&
    sourceIndex < outcomes.length
  ) {
    return outcomes[sourceIndex];
  }

  return null;
};

const getLocalQuoteStatusName = ({
  market,
  outcome,
  odds,
}: {
  market: FixtureMarket;
  outcome: FixtureOutcome;
  odds: number;
}) => {
  const marketStatus = getFixtureMarketStatus(market);
  if (marketStatus && marketStatus !== "Active") {
    return marketStatus;
  }
  if (getFixtureOutcomeActive(outcome) !== 1) {
    return "Suspended";
  }
  return Number.isFinite(odds) && odds > 1 ? "Active" : "Suspended";
};

const getFlatQuoteStatusName = ({
  outcome,
  odds,
}: {
  outcome: FixtureOutcome;
  odds: number;
}) => {
  if (getFixtureOutcomeActive(outcome) !== 1) {
    return "Suspended";
  }
  return Number.isFinite(odds) && odds > 1 ? "Active" : "Suspended";
};

export const getSupportedDerivedMarketIds = ({
  sportId,
  marketId,
  derivedMarketIds,
}: {
  sportId: number | string;
  marketId?: number | string;
  derivedMarketIds?: unknown;
}) => {
  if (!isFootballSport(sportId)) {
    return [];
  }

  const normalizedDerivedIds = normalizeDerivedMarketIds(derivedMarketIds);
  const explicitIds = normalizedDerivedIds.filter(
    (id) => id === X_UP_FEATURE_MARKET_ID || id === EARLY_GOAL_DERIVED_MARKET_ID,
  );
  const supportsXUpFeature =
    Number(marketId || 0) === EARLY_WIN_BASE_MARKET_ID &&
    normalizedDerivedIds.includes(X_UP_FEATURE_MARKET_ID);

  if (supportsXUpFeature) {
    return [
      ...new Set([...explicitIds, ...getConfiguredDerivedMarketIds(EARLY_WIN_BASE_MARKET_ID)]),
    ];
  }

  return explicitIds;
};

export const getSupportedEarlyWinModes = (input: {
  sportId: number | string;
  marketId?: number | string;
  derivedMarketIds?: unknown;
  fixture?: EarlyWinFixture;
}) => {
  const fixtureModes = getFixtureXupModes(input.fixture, input.marketId);
  const modes = fixtureModes.length
    ? fixtureModes
    : getSupportedDerivedMarketIds(input)
        .flatMap((marketId) =>
          Number(marketId) === X_UP_FEATURE_MARKET_ID
            ? [...EARLY_WIN_MODE_KEYS]
            : [getEarlyWinModeFromMarketId(marketId)],
        )
        .filter((mode) => mode !== "base");

  return [...EARLY_WIN_MODE_KEYS].filter((mode) => modes.includes(mode));
};

const getFixtureXupModes = (
  fixture: EarlyWinFixture | undefined,
  baseMarketId?: number | string,
): string[] => {
  if (!fixture || Number(baseMarketId || 0) !== EARLY_WIN_BASE_MARKET_ID) return [];

  return [
    ...new Set(
      getFixtureMarkets(fixture)
        .filter((market) => getFixtureMarketId(market) === EARLY_WIN_BASE_MARKET_ID)
        .flatMap((market) =>
          Array.isArray(market.marketExtendVOS)
            ? market.marketExtendVOS
                .filter(
                  (extension) =>
                    Number(extension.nodeMarketId) === X_UP_FEATURE_MARKET_ID &&
                    Number(extension.rootMarketId) === EARLY_WIN_BASE_MARKET_ID &&
                    !extension.notSupport,
                )
                .map((extension) =>
                  getEarlyWinModeFromMarketId(
                    X_UP_FEATURE_MARKET_ID,
                    String(extension.nodeSpecifier || ""),
                  ),
                )
            : [],
        )
        .filter((mode): mode is "1up" | "2up" => EARLY_WIN_MODE_KEYS.includes(mode as never)),
    ),
  ];
};

export const getDerivedMarketIdForMode = (
  baseMarketId: number | string,
  mode: string,
  supportedDerivedMarketIds: unknown[] = [],
) => {
  const normalizedMode = normalizeEarlyWinMode(mode);
  if (normalizedMode === "base") {
    return Number(baseMarketId || 0);
  }

  const explicitMatch = normalizeDerivedMarketIds(supportedDerivedMarketIds).find(
    (marketId) =>
      marketId === X_UP_FEATURE_MARKET_ID ||
      getEarlyWinModeFromMarketId(marketId) === normalizedMode,
  );
  if (explicitMatch) {
    return explicitMatch;
  }

  return DERIVED_MARKET_BY_BASE_AND_MODE.get(Number(baseMarketId || 0))?.get(normalizedMode) || 0;
};

export const buildEarlyWinLocalQuoteMap = ({
  fixture,
  sportId,
  baseMarketId,
  baseMarketName = "",
  supportedDerivedMarketIds = [],
  marketId,
  specifier = "",
  outcomeId,
  outcomeName,
  displayName,
}: {
  fixture: EarlyWinFixture;
  sportId: number | string;
  baseMarketId: number | string;
  baseMarketName?: string;
  supportedDerivedMarketIds?: unknown[];
  marketId?: number | string;
  specifier?: string;
  outcomeId?: string;
  outcomeName?: string;
  displayName?: string;
}) => {
  if (!isFootballSport(sportId)) return {};

  const baseOutcomeSupported = isSupportedDerivedOutcome({
    baseMarketId,
    mode: "1up",
    outcomeId,
    outcomeName,
    displayName,
    specifier,
  });

  const markets = getFixtureMarkets(fixture);
  const flatOutcomes = getFixtureFlatOutcomes(fixture);
  if (!markets.length && !flatOutcomes.length) return {};

  const normalizedBaseMarketId = Number(baseMarketId || 0);
  const currentMode = getEarlyWinModeFromMarketId(marketId || 0, specifier);
  const fixtureXupModes = getFixtureXupModes(fixture, normalizedBaseMarketId);
  const supportsXup =
    fixtureXupModes.length > 0 ||
    normalizeDerivedMarketIds(supportedDerivedMarketIds).includes(X_UP_FEATURE_MARKET_ID) ||
    currentMode === "1up" ||
    currentMode === "2up";
  const xupModes = fixtureXupModes.length
    ? fixtureXupModes
    : supportsXup
      ? [...EARLY_WIN_MODE_KEYS]
      : [];
  const candidateModes: DerivedSelectionMode[] = [
    "base",
    ...xupModes.filter((mode): mode is "1up" | "2up" => mode === "1up" || mode === "2up"),
  ];

  const quotes: Record<string, EarlyWinQuote> = {};
  const reference: OutcomeReference = {
    outcomeId,
    outcomeName,
    displayName,
    specifier,
  };

  if (markets.length) {
    const sourceMarket =
      findFixtureMarket(markets, marketId || baseMarketId, specifier) ||
      findFixtureMarket(markets, normalizedBaseMarketId, currentMode === "base" ? specifier : "");
    if (!sourceMarket) return {};

    const sourceIndex = findOutcomeIndex(sourceMarket, reference);

    candidateModes.forEach((mode) => {
      const candidateMarketId =
        mode === "base" ? normalizedBaseMarketId : X_UP_FEATURE_MARKET_ID;
      const candidateSpecifier =
        mode === "base" ? (currentMode === "base" ? specifier : "") : getDerivedSpecifierForMode(normalizedBaseMarketId, mode);
      const market = findFixtureMarket(markets, candidateMarketId, candidateSpecifier);
      if (!market) return;

      const outcome = findOutcomeByReference(
        market,
        { ...reference, specifier: candidateSpecifier, idSpecifier: candidateSpecifier, sourceIndex },
        { allowSpecifierOnlyMatch: false, allowSourceIndexMatch: false },
      );
      if (!outcome) return;

      const normalizedOdds = Number(outcome.odds);
      if (mode !== "base" && !baseOutcomeSupported) return;

      quotes[mode] = {
        marketId: Number(candidateMarketId),
        marketName: formatEarlyWinMarketName(baseMarketName, mode),
        specifier: getFixtureMarketSpecifier(market) || candidateSpecifier,
        idSpecifier:
          getFixtureOutcomeSpecifier(outcome) ||
          getFixtureMarketSpecifier(market) ||
          candidateSpecifier,
        outcomeId: getFixtureOutcomeId(outcome),
        outcomeName: getFixtureOutcomeName(outcome),
        displayName: getFixtureOutcomeDisplayName(outcome),
        odds: normalizedOdds,
        active: getFixtureOutcomeActive(outcome),
        statusName: getLocalQuoteStatusName({ market, outcome, odds: normalizedOdds }),
      };
    });

    return quotes;
  }

  const primarySourceOutcomes = findFixtureOutcomes(flatOutcomes, marketId || baseMarketId, specifier);
  const sourceOutcomes = primarySourceOutcomes.length
    ? primarySourceOutcomes
    : findFixtureOutcomes(flatOutcomes, baseMarketId, specifier);
  if (!sourceOutcomes.length) return {};

  const sourceIndex = findOutcomeIndex({ outcomes: sourceOutcomes }, reference);

  candidateModes.forEach((mode) => {
    const candidateMarketId =
      mode === "base" ? normalizedBaseMarketId : X_UP_FEATURE_MARKET_ID;
    const candidateSpecifier =
      mode === "base" ? (currentMode === "base" ? specifier : "") : getDerivedSpecifierForMode(normalizedBaseMarketId, mode);
    const outcomesForMarket = findFixtureOutcomes(flatOutcomes, candidateMarketId, candidateSpecifier);
    if (!outcomesForMarket.length) return;

    const outcome = findOutcomeByReference(
      { outcomes: outcomesForMarket },
      { ...reference, specifier: candidateSpecifier, idSpecifier: candidateSpecifier, sourceIndex },
      { allowSpecifierOnlyMatch: false, allowSourceIndexMatch: false },
    );
    if (!outcome) return;

    const normalizedOdds = Number(outcome.odds);
    if (mode !== "base" && !baseOutcomeSupported) return;

      quotes[mode] = {
        marketId: Number(candidateMarketId),
        marketName: formatEarlyWinMarketName(baseMarketName, mode),
        specifier: getFixtureOutcomeSpecifier(outcome) || String(specifier || ""),
        idSpecifier: getFixtureOutcomeSpecifier(outcome) || candidateSpecifier,
        outcomeId: getFixtureOutcomeId(outcome),
        outcomeName: getFixtureOutcomeName(outcome),
        displayName: getFixtureOutcomeDisplayName(outcome),
      odds: normalizedOdds,
      active: getFixtureOutcomeActive(outcome),
      statusName: getFlatQuoteStatusName({ outcome, odds: normalizedOdds }),
    };
  });

  return quotes;
};

export const buildEarlyWinSelectionState = ({
  sportId,
  marketId,
  marketName,
  specifier = "",
  derivedMarketIds,
  fixture,
}: {
  sportId: number | string;
  marketId: number | string;
  marketName: string;
  specifier?: string;
  derivedMarketIds?: unknown;
  fixture?: EarlyWinFixture;
}): EarlyWinSelectionState => {
  const derivedMode = getEarlyWinModeFromMarketId(marketId, specifier);
  const inferredModeFromSpecifier = getEarlyWinModeFromSpecifier(specifier);
  const inferredMode =
    EARLY_WIN_MODE_KEYS.includes(derivedMode as "1up" | "2up")
      ? derivedMode
      : inferredModeFromSpecifier !== "base"
        ? inferredModeFromSpecifier
        : inferEarlyWinModeFromMarketName(marketName);
  const currentMode = EARLY_WIN_MODE_KEYS.includes(inferredMode as "1up" | "2up")
    ? inferredMode
    : "base";
  const baseMarketId = getBaseMarketIdFromMarketId(marketId);
  const baseMarketName =
    currentMode === "base"
      ? String(marketName || "").trim()
      : stripEarlyWinSuffix(marketName) || String(marketName || "").trim();

  const explicitDerivedMarketIds = getSupportedDerivedMarketIds({
    sportId,
    marketId: baseMarketId,
    derivedMarketIds,
  }).filter((id) => id === X_UP_FEATURE_MARKET_ID);
  const supportedEarlyWinModes = getSupportedEarlyWinModes({
    sportId,
    marketId: baseMarketId,
    derivedMarketIds: explicitDerivedMarketIds,
    fixture,
  });
  const supportedDerivedMarketIds =
    supportedEarlyWinModes.length > 0 && Number(baseMarketId) === EARLY_WIN_BASE_MARKET_ID
      ? [X_UP_FEATURE_MARKET_ID]
      : [...explicitDerivedMarketIds];

  if (
    (currentMode === "1up" || currentMode === "2up") &&
    !supportedEarlyWinModes.includes(currentMode)
  ) {
    supportedEarlyWinModes.push(currentMode);
  }

  return {
    baseMarketId,
    baseMarketName,
    earlyWinMode: currentMode,
    explicitDerivedMarketIds,
    hasExplicitDerivedMarkets: isFootballSport(sportId) && supportedEarlyWinModes.length > 0,
    supportedDerivedMarketIds,
    supportedEarlyWinModes,
    supportsEarlyWin: isFootballSport(sportId) && supportedEarlyWinModes.length > 0,
    currentMarketName: formatEarlyWinMarketName(baseMarketName, currentMode),
  };
};

export const buildEarlyGoalLocalQuoteMap = ({
  fixture,
  sportId,
  marketId,
  baseMarketId,
  baseMarketName = "",
  specifier = "",
  outcomeId,
  outcomeName,
  displayName,
  derivedMarketIds = [],
}: {
  fixture: EarlyWinFixture;
  sportId: number | string;
  marketId: number | string;
  baseMarketId?: number | string;
  baseMarketName?: string;
  specifier?: string;
  outcomeId?: string;
  outcomeName?: string;
  displayName?: string;
  derivedMarketIds?: unknown[];
}) => {
  if (!isFootballSport(sportId)) return {};

  const baseOutcomeSupported = isSupportedDerivedOutcome({
    baseMarketId,
    mode: "earlygoal",
    outcomeId,
    outcomeName,
    displayName,
    specifier,
  });

  const normalizedCurrentMarketId = Number(marketId || 0);
  const isCurrentEarlyGoal = normalizedCurrentMarketId === EARLY_GOAL_DERIVED_MARKET_ID;
  const resolvedBaseMarketId = isCurrentEarlyGoal
    ? Number(baseMarketId || getBaseMarketIdFromMarketId(normalizedCurrentMarketId) || 0)
    : normalizedCurrentMarketId;
  if (resolvedBaseMarketId !== EARLY_GOAL_BASE_MARKET_ID) return {};

  const explicitDerivedIds = normalizeDerivedMarketIds(derivedMarketIds);
  const supportsDerived =
    explicitDerivedIds.includes(EARLY_GOAL_DERIVED_MARKET_ID) || isCurrentEarlyGoal;
  if (!supportsDerived) return {};

  const markets = getFixtureMarkets(fixture);
  const flatOutcomes = getFixtureFlatOutcomes(fixture);
  if (!markets.length && !flatOutcomes.length) return {};

  const candidateMarketIds = [resolvedBaseMarketId, EARLY_GOAL_DERIVED_MARKET_ID];
  const quotes: Record<string, EarlyWinQuote> = {};
  const reference: OutcomeReference = {
    outcomeId,
    outcomeName,
    displayName,
    specifier,
  };
  const baseSpecifier = toEarlyGoalBaseSpecifier(specifier);

  if (markets.length) {
    const sourceMarket =
      findFixtureMarket(markets, normalizedCurrentMarketId || resolvedBaseMarketId, specifier) ||
      findFixtureMarket(markets, resolvedBaseMarketId, specifier);
    if (!sourceMarket) return {};

    const sourceIndex = findOutcomeIndex(sourceMarket, reference);

    candidateMarketIds.forEach((candidateMarketId) => {
      const mode = Number(candidateMarketId) === resolvedBaseMarketId ? "base" : "earlygoal";
      const candidateSpecifier = mode === "base" ? baseSpecifier : specifier;
      const market = findFixtureMarket(markets, candidateMarketId, candidateSpecifier);
      if (!market) return;

      const outcome = findOutcomeByReference(
        market,
        {
          ...reference,
          specifier: candidateSpecifier,
          idSpecifier: candidateSpecifier,
          sourceIndex,
        },
        {
          allowSpecifierOnlyMatch: false,
          allowSourceIndexMatch: false,
        },
      );
      if (!outcome) return;

      const normalizedOdds = Number(outcome.odds);
      if (mode !== "base" && !baseOutcomeSupported) return;

      quotes[mode] = {
        marketId: Number(candidateMarketId),
        marketName:
          mode === "base"
            ? getFixtureMarketName(market)
            : formatEarlyGoalMarketName(baseMarketName, mode),
        specifier: getFixtureMarketSpecifier(market),
        idSpecifier: getFixtureOutcomeSpecifier(outcome),
        outcomeId: getFixtureOutcomeId(outcome),
        outcomeName: getFixtureOutcomeName(outcome),
        displayName: getFixtureOutcomeDisplayName(outcome),
        odds: normalizedOdds,
        active: getFixtureOutcomeActive(outcome),
        statusName: getLocalQuoteStatusName({ market, outcome, odds: normalizedOdds }),
      };
    });

    return quotes;
  }

  const primarySourceOutcomes = findFixtureOutcomes(
    flatOutcomes,
    normalizedCurrentMarketId || resolvedBaseMarketId,
    specifier,
  );
  const sourceOutcomes = primarySourceOutcomes.length
    ? primarySourceOutcomes
    : findFixtureOutcomes(flatOutcomes, resolvedBaseMarketId, specifier);
  if (!sourceOutcomes.length) return {};

  const sourceIndex = findOutcomeIndex({ outcomes: sourceOutcomes }, reference);

  candidateMarketIds.forEach((candidateMarketId) => {
    const mode = Number(candidateMarketId) === resolvedBaseMarketId ? "base" : "earlygoal";
    const candidateSpecifier = mode === "base" ? baseSpecifier : specifier;
    const outcomesForMarket = findFixtureOutcomes(flatOutcomes, candidateMarketId, candidateSpecifier);
    if (!outcomesForMarket.length) return;

    const outcome = findOutcomeByReference(
      { outcomes: outcomesForMarket },
      {
        ...reference,
        specifier: candidateSpecifier,
        idSpecifier: candidateSpecifier,
        sourceIndex,
      },
      {
        allowSpecifierOnlyMatch: false,
        allowSourceIndexMatch: false,
      },
    );
    if (!outcome) return;

    const normalizedOdds = Number(outcome.odds);
    if (mode !== "base" && !baseOutcomeSupported) return;

    quotes[mode] = {
      marketId: Number(candidateMarketId),
      marketName: formatEarlyGoalMarketName(baseMarketName, mode),
      specifier: getFixtureOutcomeSpecifier(outcome) || String(specifier || ""),
      idSpecifier: getFixtureOutcomeSpecifier(outcome),
      outcomeId: getFixtureOutcomeId(outcome),
      outcomeName: getFixtureOutcomeName(outcome),
      displayName: getFixtureOutcomeDisplayName(outcome),
      odds: normalizedOdds,
      active: getFixtureOutcomeActive(outcome),
      statusName: getFlatQuoteStatusName({ outcome, odds: normalizedOdds }),
    };
  });

  return quotes;
};

export const buildEarlyGoalSelectionState = ({
  sportId,
  marketId,
  marketName,
  derivedMarketIds,
  baseMarketId,
}: {
  sportId: number | string;
  marketId: number | string;
  marketName: string;
  derivedMarketIds?: unknown;
  baseMarketId?: number | string;
}): EarlyGoalSelectionState => {
  const normalizedMarketId = Number(marketId || 0);
  const isCurrentEarlyGoal = normalizedMarketId === EARLY_GOAL_DERIVED_MARKET_ID;
  const resolvedBaseMarketId = isCurrentEarlyGoal
    ? Number(baseMarketId || getBaseMarketIdFromMarketId(normalizedMarketId) || 0)
    : normalizedMarketId;
  const isEarlyGoalMarketCandidate =
    isFootballSport(sportId) && Number(resolvedBaseMarketId) === EARLY_GOAL_BASE_MARKET_ID;
  const normalizedBaseMarketName =
    isCurrentEarlyGoal
      ? stripEarlyGoalSuffix(marketName) || String(marketName || "").trim()
      : String(marketName || "").trim();
  const explicitDerivedMarketIds = isEarlyGoalMarketCandidate
    ? normalizeDerivedMarketIds(derivedMarketIds).filter((id) => id === EARLY_GOAL_DERIVED_MARKET_ID)
    : [];
  const supportedDerivedMarketIds = [...explicitDerivedMarketIds];

  if (isCurrentEarlyGoal && !supportedDerivedMarketIds.includes(EARLY_GOAL_DERIVED_MARKET_ID)) {
    supportedDerivedMarketIds.push(EARLY_GOAL_DERIVED_MARKET_ID);
  }

  return {
    baseMarketId: resolvedBaseMarketId,
    baseMarketName: normalizedBaseMarketName,
    earlyGoalMode: isCurrentEarlyGoal ? "earlygoal" : "base",
    explicitDerivedMarketIds,
    isEarlyGoalMarketCandidate,
    hasExplicitDerivedMarkets:
      isEarlyGoalMarketCandidate && explicitDerivedMarketIds.length > 0,
    supportedDerivedMarketIds,
    supportsEarlyGoal: isEarlyGoalMarketCandidate && explicitDerivedMarketIds.length > 0,
    currentMarketName: formatEarlyGoalMarketName(
      normalizedBaseMarketName,
      isCurrentEarlyGoal ? "earlygoal" : "base",
    ),
  };
};

export const getPreferredEarlyWinModeForSelection = (
  selection: { supportedEarlyWinModes?: string[] } | null | undefined,
  preferredMode = EARLY_WIN_DEFAULT_MODE,
) => {
  const modes = Array.isArray(selection?.supportedEarlyWinModes)
    ? selection.supportedEarlyWinModes
    : [];

  if (modes.includes(preferredMode)) {
    return preferredMode;
  }

  return modes[0] || "base";
};
