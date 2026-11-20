import { DEFAULT_DERIVED_MARKET_CONFIG } from "@/lib/helpers/early-win";
import type { Sport } from "@/types";
import { parseApiDateForBrowser } from "@/lib/utils/format";
import { primeSportsMenuCache } from "@/lib/utils/sports";
import type { RawFixture, RawMarket, RawOutcome } from "@/lib/utils/normalize";
import {
  getMarketDisplayName,
  getOutcomeDisplayLabel,
} from "@/lib/utils/market-display-resolver";

type RemoteSportMenuItem = {
  sport_id?: number | string;
  sport_name?: string;
  games?: number | string;
};

type DerivedMarketModeConfig = {
  baseBadge: string;
  baseLabel: string;
  modes: {
    key: Exclude<HomeDerivedMode, "base">;
    id: number;
    label: string;
    specifier?: string;
  }[];
};

type SanitizeHomeMarketsOptions = {
  includeDerived?: boolean;
};

export type HomeDerivedMode = "base" | "1up" | "2up" | "earlygoal";
export type HomeDerivedModeConfig = DerivedMarketModeConfig["modes"][number];

export type MarketSpecifierOption = {
  specifier: string;
  value: string;
};

export const FIXTURE_SPECIFIER_WIDTH = 62;
const FIXTURE_ODDS_BASE_WIDTH = 228;
const FIXTURE_ODDS_SPECIFIER_TOTAL_WIDTH = 236;
const FIXTURE_ODDS_GAP = 6;

const HOME_DERIVED_MARKET_CONFIG: Record<number, DerivedMarketModeConfig> = {
  1: {
    baseBadge: "1X2",
    baseLabel: "1X2 Base",
    modes: [
      { key: "1up", id: 1601, label: "1UP", specifier: "xup=1" },
      { key: "2up", id: 1601, label: "2UP", specifier: "xup=2" },
    ],
  },
  18: {
    baseBadge: "O/U",
    baseLabel: "O/U Base",
    modes: [{ key: "earlygoal", id: 60180, label: "EarlyGoals" }],
  },
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const DERIVED_MARKET_IDS = new Set(
  [...Object.values(DEFAULT_DERIVED_MARKET_CONFIG), ...Object.values(HOME_DERIVED_MARKET_CONFIG)]
    .flatMap((config) => config.modes)
    .map((mode) => Number(mode.id))
    .filter((id) => Number.isFinite(id)),
);

function asRemoteSportMenu(payload: unknown): RemoteSportMenuItem[] {
  if (Array.isArray(payload)) return payload as RemoteSportMenuItem[];

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: RemoteSportMenuItem[] }).data;
  }

  return [];
}

export function formatHomeSportName(name = ""): string {
  return name.trim().toLowerCase() === "soccer" ? "Football" : name.trim();
}

export function formatHomeMarketName(name = ""): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === "1x2") return "1X2";
  if (normalized === "over/under") return "O/U";
  if (normalized === "home over/under") return "Home O/U";
  if (normalized === "away over/under") return "Away O/U";
  return name.trim();
}

export function getHomeDerivedMarketConfig(
  marketId: number | string,
): DerivedMarketModeConfig | null {
  return HOME_DERIVED_MARKET_CONFIG[Number(marketId || 0)] ?? null;
}

function getCanonicalMarketScore(market: RawMarket): number {
  const specifier = String(market.specifier ?? "").trim();

  if (specifier && isHomeSelectableSpecifier(specifier)) return 2;
  if (!specifier) return 1;
  return 0;
}

function getHomeMarketOrder(market: RawMarket): number {
  const marketId = Number(market.marketID ?? market.id ?? 0);
  const sportId = String(market.sportID ?? "").trim();
  const isSoccerMarket = !sportId || sportId === "0" || sportId === "1";

  if (isSoccerMarket && marketId === 1) return 1;
  if (isSoccerMarket && marketId === 18) return 2;

  return 1000 + marketId;
}

function compareHomeMarkets(left: RawMarket, right: RawMarket): number {
  const leftOrder = getHomeMarketOrder(left);
  const rightOrder = getHomeMarketOrder(right);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const leftId = Number(left.marketID ?? left.id ?? 0);
  const rightId = Number(right.marketID ?? right.id ?? 0);
  return leftId - rightId;
}

export function getCanonicalHomeMarkets(markets: RawMarket[] = []): RawMarket[] {
  const groups = new Map<string, { market: RawMarket; score: number }>();

  markets.forEach((market) => {
    const marketId = Number(market.marketID ?? market.id ?? 0);
    if (!Number.isFinite(marketId)) return;

    const key = `${marketId}:${market.sportID ?? ""}`;
    const score = getCanonicalMarketScore(market);
    const current = groups.get(key);

    if (!current || score > current.score) {
      groups.set(key, { market, score });
    }
  });

  return [...groups.values()].map((entry) => entry.market).sort(compareHomeMarkets);
}

export function filterHomeMarketsBySport(
  markets: RawMarket[] = [],
  sportId: number | string,
): RawMarket[] {
  const normalizedSportId = String(sportId ?? "").trim();
  if (!normalizedSportId) return markets;

  return markets.filter((market) => {
    const marketSportId = String(market.sportID ?? "").trim();
    return !marketSportId || marketSportId === "0" || marketSportId === normalizedSportId;
  });
}

export function getHomeDerivedMarketId(
  marketId: number | string,
  mode: HomeDerivedMode,
): number {
  if (mode === "base") return Number(marketId || 0);

  return (
    HOME_DERIVED_MARKET_CONFIG[Number(marketId || 0)]?.modes.find((item) => item.key === mode)?.id ??
    0
  );
}

export function getHomeDerivedMarketSpecifier(
  marketId: number | string,
  mode: HomeDerivedMode,
): string {
  if (mode === "base") return "";
  return (
    HOME_DERIVED_MARKET_CONFIG[Number(marketId || 0)]?.modes.find((item) => item.key === mode)
      ?.specifier ?? ""
  );
}

export function getAvailableHomeDerivedModes(
  marketId: number | string,
  derivedMarkets: RawMarket[] = [],
): HomeDerivedModeConfig[] {
  const config = getHomeDerivedMarketConfig(marketId);
  if (!config) return [];
  if (!derivedMarkets.length) return config.modes;

  return config.modes.filter((mode) =>
    mode.key === "earlygoal" ||
    derivedMarkets.some((market) => {
      const candidateId = Number(market.marketID ?? market.id ?? 0);
      if (candidateId !== mode.id) return false;
      if (!mode.specifier) return true;
      return String(market.specifier ?? "") === mode.specifier;
    }),
  );
}

export function resolveHomeDisplayMarket(
  baseMarket: RawMarket | null,
  mode: HomeDerivedMode,
  derivedMarkets: RawMarket[] = [],
): RawMarket | null {
  if (!baseMarket) return null;
  if (mode === "base") return baseMarket;

  const baseMarketId = Number(baseMarket.marketID ?? baseMarket.id ?? 0);
  const targetMarketId = getHomeDerivedMarketId(baseMarketId, mode);
  const targetSpecifier = getHomeDerivedMarketSpecifier(baseMarketId, mode);

  return (
    derivedMarkets.find((market) => {
      const candidateId = Number(market.marketID ?? market.id ?? 0);
      if (candidateId !== targetMarketId) return false;
      if (!targetSpecifier) return true;
      return String(market.specifier ?? "") === targetSpecifier;
    }) ?? null
  );
}

export function isHomeSelectableSpecifier(specifier = ""): boolean {
  return !String(specifier || "").trim().toLowerCase().startsWith("xup=");
}

export function formatHomeSpecifierType(specifier = ""): string {
  const normalized = String(specifier || "").trim().toLowerCase();
  if (normalized === "total") return "Goals";
  if (normalized === "handicap" || normalized === "hcp") return "Handicap";

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatHomeSpecifierValue(specifier = ""): string {
  const rawSpecifier = String(specifier || "").trim();
  if (!rawSpecifier) return "";

  const segments = rawSpecifier
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const totalSegment = segments.find((segment) => segment.startsWith("total="));
  if (totalSegment) return totalSegment.split("=")[1] || "";

  const handicapSegment = segments.find((segment) => segment.startsWith("hcp="));
  if (handicapSegment) return handicapSegment.split("=")[1] || "";

  const lastKeyValueSegment = [...segments].reverse().find((segment) => segment.includes("="));
  if (lastKeyValueSegment) {
    return lastKeyValueSegment.split("=").slice(1).join("=") || "";
  }

  return rawSpecifier;
}

export function normalizeSportsMenu(payload: unknown): Sport[] {
  const seen = new Set<string>();
  const sports = asRemoteSportMenu(payload).reduce<Sport[]>((nextSports, item) => {
    const name = formatHomeSportName(String(item.sport_name ?? ""));
    const id = String(item.sport_id ?? "");
    const games = Number(item.games ?? 0);

    if (!id || !name || seen.has(id) || games <= 0) return nextSports;

    seen.add(id);
    nextSports.push({
      id,
      name,
      slug: slugify(name),
      matchCount: games,
    });

    return nextSports;
  }, []);

  sports.sort((left, right) => Number(left.id) - Number(right.id));
  primeSportsMenuCache(sports);

  return sports;
}

export function deriveLiveSports(fixtures: RawFixture[]): Sport[] {
  const map = new Map<string, Sport>();

  fixtures.forEach((fixture) => {
    const id = String(fixture.sportID ?? "");
    const rawName = String(fixture.sportName ?? "").trim();
    if (!id || !rawName || map.has(id)) return;

    const name = formatHomeSportName(rawName);
    map.set(id, {
      id,
      name,
      slug: slugify(name),
    });
  });

  const sports = [...map.values()].sort((left, right) => Number(left.id) - Number(right.id));
  primeSportsMenuCache(sports);
  return sports;
}

export function sanitizeHomeMarkets(
  markets: RawMarket[] = [],
  options: SanitizeHomeMarketsOptions = {},
): RawMarket[] {
  const { includeDerived = false } = options;
  const seen = new Set<string>();

  return markets
    .filter((market) => {
      const marketId = Number(market.marketID ?? market.id ?? 0);
      if (!Number.isFinite(marketId)) {
        return false;
      }
      if (!includeDerived && DERIVED_MARKET_IDS.has(marketId)) return false;

      const key = `${marketId}:${market.specifier ?? ""}:${market.sportID ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareHomeMarkets);
}

export function sortHomeOutcomesById<T extends RawOutcome>(outcomes: T[] = []): T[] {
  return [...outcomes].sort((left, right) => {
    const leftId = String(left.outcomeID ?? "").trim();
    const rightId = String(right.outcomeID ?? "").trim();
    const leftNumber = Number(leftId);
    const rightNumber = Number(rightId);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return leftId.localeCompare(rightId, undefined, { numeric: true });
  });
}

function getFixtureMarketOutcomePool(
  fixture: RawFixture,
  market: RawMarket | null,
): RawOutcome[] {
  if (!market) return [];

  const marketId = String(market.marketID ?? market.id ?? "");
  return sortHomeOutcomesById(
    (fixture.outcomes ?? []).filter((outcome) => {
      if (String(outcome.marketID ?? "") !== marketId) return false;
      if (outcome.active === 0 || outcome.active === false) return false;
      return true;
    }),
  );
}

export function getMarketSpecifierOptions(
  fixture: RawFixture,
  market: RawMarket | null,
): MarketSpecifierOption[] {
  if (!market || !String(market.specifier ?? "").trim()) return [];
  if (!isHomeSelectableSpecifier(String(market.specifier ?? ""))) return [];

  const seen = new Set<string>();
  const options: MarketSpecifierOption[] = [];

  getFixtureMarketOutcomePool(fixture, market).forEach((outcome) => {
    const specifier = String(outcome.specifier ?? "").trim();
    if (!specifier || seen.has(specifier)) return;

    seen.add(specifier);
    options.push({
      specifier,
      value: formatHomeSpecifierValue(specifier),
    });
  });

  return sortSpecifierOptions(options);
}

function sortSpecifierOptions(options: MarketSpecifierOption[]): MarketSpecifierOption[] {
  return [...options].sort((left, right) => {
    const leftNumber = Number(left.value);
    const rightNumber = Number(right.value);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.value.localeCompare(right.value, undefined, { numeric: true });
  });
}

export function getSharedMarketSpecifierOptions(
  fixtures: RawFixture[],
  market: RawMarket | null,
): MarketSpecifierOption[] {
  if (!market || !String(market.specifier ?? "").trim()) return [];

  const optionGroups = fixtures
    .map((fixture) => getMarketSpecifierOptions(fixture, market))
    .filter((options) => options.length > 0);

  if (!optionGroups.length) return [];

  const sharedSpecifiers = new Map<string, MarketSpecifierOption>();
  optionGroups[0]?.forEach((option) => {
    sharedSpecifiers.set(option.specifier, option);
  });

  optionGroups.slice(1).forEach((options) => {
    const available = new Set(options.map((option) => option.specifier));
    [...sharedSpecifiers.keys()].forEach((specifier) => {
      if (!available.has(specifier)) {
        sharedSpecifiers.delete(specifier);
      }
    });
  });

  return sortSpecifierOptions(
    sharedSpecifiers.size ? [...sharedSpecifiers.values()] : optionGroups[0] ?? [],
  );
}

export function resolveMarketOutcomes(
  fixture: RawFixture,
  market: RawMarket | null,
  selectedSpecifier = "",
): RawOutcome[] {
  if (!market) return [];

  const marketId = String(market.marketID ?? market.id ?? "");
  const marketSpecifier = String(market.specifier ?? market.specifiers ?? "").trim();
  const isSelectableSpecifier = isHomeSelectableSpecifier(marketSpecifier);
  const fallbackSpecifier =
    selectedSpecifier ||
    (!isSelectableSpecifier && marketSpecifier
      ? marketSpecifier
      : getMarketSpecifierOptions(fixture, market)[0]?.specifier || "");
  const rawOutcomes = getFixtureMarketOutcomePool(fixture, market).filter((outcome) => {
    if (!marketSpecifier || isSelectableSpecifier) return true;

    return String(outcome.specifier ?? outcome.specifiers ?? "").trim() === marketSpecifier;
  });
  const scopedOutcomes = fallbackSpecifier
    ? rawOutcomes.filter(
        (outcome) => String(outcome.specifier ?? outcome.specifiers ?? "").trim() === fallbackSpecifier,
      )
    : rawOutcomes;
  const displayOutcomes = scopedOutcomes.length ? scopedOutcomes : rawOutcomes;

  if (Array.isArray(market.outcomes) && market.outcomes.length) {
    return sortHomeOutcomesById(market.outcomes).map((template) => {
      const matched = displayOutcomes.find(
        (outcome) =>
          String(outcome.outcomeID ?? "") === String(template.outcomeID ?? "") &&
          (!fallbackSpecifier ||
            String(outcome.specifier ?? outcome.specifiers ?? "").trim() === fallbackSpecifier),
      );
      return matched ?? { ...template, marketID: marketId, specifier: fallbackSpecifier };
    });
  }

  return sortHomeOutcomesById(displayOutcomes);
}

export function formatOutcomeName(outcome: RawOutcome, market?: RawMarket | null): string {
  const rawName = market
    ? getOutcomeDisplayLabel(market, outcome)
    : String(outcome.displayName ?? outcome.outcomeName ?? "");
  const label = rawName
    .replace(/\{\$competitor1\}/gi, "1")
    .replace(/\{\$competitor2\}/gi, "2")
    .trim();

  return label.toLowerCase() === "draw" ? "X" : label;
}

export { getMarketDisplayName };

function normalizePeriod(matchStatus = ""): string {
  const status = matchStatus.toLowerCase();
  if (status.includes("1st") || status === "h1") return "H1";
  if (status.includes("2nd") || status === "h2") return "H2";
  if (status.includes("half") && status.includes("time")) return "HT";
  if (status.includes("90+")) return "90+";
  if (status.includes("extra") || status.includes("et")) return "ET";
  return matchStatus;
}

export function formatHomeLiveStatus(matchStatus: string): string {
  return normalizePeriod(String(matchStatus ?? "").trim());
}

export function formatHomeLiveTime(fixture: RawFixture): string {
  const time = String(fixture.eventTime ?? "").trim();
  const period = formatHomeLiveStatus(String(fixture.matchStatus ?? "").trim());
  return [time, period].filter(Boolean).join(" ");
}

// Building a formatter is expensive; list rows call this hundreds of times per render.
const HOME_START_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatHomeStartTime(value: string): string {
  const date = parseApiDateForBrowser(value);
  if (!date) return "-- -- --:--";

  return HOME_START_TIME_FORMAT.format(date);
}

export function getOddsContainerWidth(hasSpecifier: boolean): number {
  return hasSpecifier ? FIXTURE_ODDS_SPECIFIER_TOTAL_WIDTH : FIXTURE_ODDS_BASE_WIDTH;
}

export function getOddsColumnWidth(outcomeCount: number, hasSpecifier = false): number {
  const containerWidth = getOddsContainerWidth(hasSpecifier);
  const specifierWidth = hasSpecifier ? FIXTURE_SPECIFIER_WIDTH + FIXTURE_ODDS_GAP : 0;

  if (outcomeCount <= 1) return containerWidth - specifierWidth;

  return Math.floor(
    (containerWidth - specifierWidth - FIXTURE_ODDS_GAP * (outcomeCount - 1)) / outcomeCount,
  );
}
