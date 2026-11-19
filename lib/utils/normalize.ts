import { getTeamLogoUrl, getLeagueLogoUrl } from "@/lib/utils/sports";
import type { SportEvent, Market } from "@/types";

// ─── Raw API types (sportsbook fixture format) ───────────────────────────────

export type RawOutcome = {
  outcomeID?: number | string;
  marketID?: number | string;
  id?: number | string;
  desc?: string;
  alias?: string;
  outcomeName?: string;
  displayName?: string;
  odds?: number | string;
  active?: number | boolean;
  specifier?: string;
  specifiers?: string;
};

export type RawMarket = {
  marketID?: number | string;
  marketId?: number | string;
  marketName?: string;
  desc?: string;
  description?: string;
  displayName?: string;
  id?: number | string;
  name?: string;
  sportID?: number | string;
  specifier?: string;
  specifiers?: string;
  title?: string;
  group?: string;
  groupId?: number | string;
  status?: number | string;
  statusName?: string;
  variant?: string | number;
  version?: string | number;
  outcomes?: RawOutcome[];
  marketExtendVOS?: Array<{
    name?: string;
    rootMarketId?: string | number;
    nodeMarketId?: string | number;
    nodeSpecifier?: string;
    notSupport?: boolean;
  }>;
};

export type RawScorePair = {
  home?: number | string | null;
  away?: number | string | null;
  home_score?: number | string | null;
  away_score?: number | string | null;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
};

export type RawPeriodScore = {
  number?: number | string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
  description?: string;
  match_status_code?: number | string;
  type?: string;
};

export type RawFixture = {
  matchID?: number | string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  eventTime?: string;         // "45:32" for live
  homeScore?: number | string | null;
  awayScore?: number | string | null;
  matchStatus?: string;        // "1st half", "2nd half", "halftime"
  tournament?: string;
  tournamentID?: number | string;
  categoryName?: string;
  categoryID?: number | string;
  sportID?: number | string;
  sportName?: string;
  activeMarkets?: number;
  outcomes?: RawOutcome[];
  market?: RawMarket[];
  markets?: RawMarket[];
  // alternate score source used in some responses
  eventInfo?: {
    score?: RawScorePair;
    scores?: RawScorePair;
    game_score?: RawScorePair;
    period_scores?: RawPeriodScore[];
  };
};

export type RawFixtureResponse =
  | { fixtures?: RawFixture[]; markets?: RawMarket[] }
  | { data?: { fixtures?: RawFixture[]; markets?: RawMarket[] } }
  | RawFixture[]
  | null
  | undefined;

type RawFixtureEnvelope = { fixtures?: RawFixture[]; markets?: RawMarket[] };
type RawFixtureDataEnvelope = { data?: RawFixtureEnvelope };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function normalizeSport(sportName = ""): { name: string; slug: string } {
  const normalized = sportName.trim().toLowerCase();
  if (!normalized || normalized === "soccer") {
    return { name: "Football", slug: "football" };
  }
  return { name: sportName.trim(), slug: slugify(sportName) };
}

/** Map displayName / outcomeName → "home" | "draw" | "away" */
function outcomeKey(displayName: string, outcomeName: string): "home" | "draw" | "away" | null {
  const d = displayName.trim();
  const o = outcomeName.trim().toLowerCase();

  if (/^1(\s|\(|$)/.test(d) || ["1", "home", "home win", "team 1"].includes(o)) return "home";
  if (/^x(\s|\(|$)/i.test(d) || ["x", "draw", "tie"].includes(o)) return "draw";
  if (/^2(\s|\(|$)/.test(d) || ["2", "away", "away win", "team 2"].includes(o)) return "away";
  return null;
}

/** "1st half" / "2nd half" → "H1" / "H2" */
function normalizePeriod(matchStatus = ""): string {
  const s = matchStatus.toLowerCase();
  if (s.includes("1st") || s === "h1") return "H1";
  if (s.includes("2nd") || s === "h2") return "H2";
  if (s.includes("half") && s.includes("time")) return "HT";
  if (s.includes("90+")) return "90+";
  if (s.includes("extra") || s.includes("et")) return "ET";
  return matchStatus || "H2";
}

/** "45:32" → 45 */
function parseMinute(eventTime = ""): number {
  const parts = eventTime.split(":");
  return Number(parts[0]) || 0;
}

function parseScoreValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildFixtureMarkets(raw: RawFixture, markets: RawMarket[]): NonNullable<SportEvent["fixtureMarkets"]> {
  const outcomes = Array.isArray(raw.outcomes) ? raw.outcomes : [];
  const marketMeta = [...(Array.isArray(raw.market) ? raw.market : []), ...(Array.isArray(raw.markets) ? raw.markets : []), ...markets];
  const groups = new Map<string, RawOutcome[]>();

  outcomes.forEach((outcome) => {
    const marketId = String(outcome.marketID ?? "");
    if (!marketId) return;
    const specifier = String(outcome.specifier ?? outcome.specifiers ?? "");
    const key = `${marketId}|${specifier}`;
    const group = groups.get(key) ?? [];
    group.push(outcome);
    groups.set(key, group);
  });

  return Array.from(groups.entries()).map(([key, groupedOutcomes]) => {
    const separatorIndex = key.indexOf("|");
    const marketId = key.slice(0, separatorIndex);
    const specifier = key.slice(separatorIndex + 1);
    const meta = marketMeta.find((market) => {
      if (String(market.marketID ?? market.id ?? "") !== marketId) return false;
      const metaSpecifier = String(market.specifier ?? market.specifiers ?? "");
      return !metaSpecifier || metaSpecifier === specifier;
    });

    return {
      marketID: marketId,
      marketName: String(meta?.marketName ?? meta?.name ?? "").trim() || undefined,
      desc: meta?.desc,
      description: meta?.description,
      displayName: meta?.displayName,
      specifier,
      statusName: meta?.statusName,
      status: meta?.status,
      group: meta?.group,
      groupId: meta?.groupId,
      title: meta?.title,
      marketExtendVOS: meta?.marketExtendVOS,
      outcomes: groupedOutcomes,
    };
  });
}

// ─── Core normalizer ─────────────────────────────────────────────────────────

export function normalizeRawFixture(
  raw: RawFixture,
  markets: RawMarket[]
): SportEvent | null {
  const homeTeam = String(raw.homeTeam ?? "").trim();
  const awayTeam = String(raw.awayTeam ?? "").trim();
  if (!homeTeam || !awayTeam) return null;

  const matchId = String(raw.matchID ?? "");
  if (!matchId) return null;

  const sportId = String(raw.sportID ?? "1");
  const tournamentId = String(raw.tournamentID ?? raw.tournament ?? "");
  const tournamentName = String(raw.tournament ?? "");

  // Score — try multiple sources
  const rawHome = raw.homeScore ?? raw.eventInfo?.score?.home ?? raw.eventInfo?.scores?.home;
  const rawAway = raw.awayScore ?? raw.eventInfo?.score?.away ?? raw.eventInfo?.scores?.away;
  const homeScore = parseScoreValue(rawHome);
  const awayScore = parseScoreValue(rawAway);
  const statusText = String(raw.matchStatus ?? "").trim().toLowerCase();
  const isLive =
    homeScore !== null &&
    awayScore !== null &&
    Number.isFinite(homeScore) &&
    Number.isFinite(awayScore) &&
    !statusText.includes("not started") &&
    !statusText.includes("scheduled");

  // Market odds — find marketID=1 (1X2) first, fallback to first market
  const marketMeta =
    markets.find((m) => String(m.marketID ?? m.id ?? "") === "1") ??
    markets[0];
  const fallbackMarketId =
    raw.outcomes?.find((outcome) => String(outcome.marketID ?? "") === "1")?.marketID ??
    raw.outcomes?.[0]?.marketID ??
    "1";
  const targetMarketId = String(marketMeta?.marketID ?? marketMeta?.id ?? fallbackMarketId);
  const marketName = String(marketMeta?.marketName ?? marketMeta?.name ?? "1X2");

  const sport = normalizeSport(String(raw.sportName ?? "Football"));

  const odds: Record<string, number> = {};
  const seen = new Set<string>();
  for (const outcome of raw.outcomes ?? []) {
    if (String(outcome.marketID ?? "") !== targetMarketId) continue;
    if (outcome.active === 0 || outcome.active === false) continue;
    const val = Number(outcome.odds);
    if (!Number.isFinite(val) || val <= 1) continue;
    const key = outcomeKey(
      String(outcome.displayName ?? ""),
      String(outcome.outcomeName ?? "")
    );
    if (!key || seen.has(key)) continue;
    odds[key] = val;
    seen.add(key);
  }

  // Need at least home + away to show odds
  const normalizedMarkets: Market[] =
    Number.isFinite(odds.home) && Number.isFinite(odds.away)
      ? [{
          id: targetMarketId,
          name: marketName,
          type: "1x2",
          odds,
          specifier: String(marketMeta?.specifier ?? ""),
          marketExtendVOS: marketMeta?.marketExtendVOS,
        }]
      : [];

  return {
    id: matchId,
    sport: { id: sportId, ...sport },
    league: {
      id: tournamentId,
      name: tournamentName,
      slug: slugify(tournamentName),
      sportId,
      logo: getLeagueLogoUrl(tournamentName),
    },
    homeTeam: {
      id: `${matchId}-home`,
      name: homeTeam,
      shortName: homeTeam.slice(0, 3).toUpperCase(),
      logo: getTeamLogoUrl(homeTeam),
    },
    awayTeam: {
      id: `${matchId}-away`,
      name: awayTeam,
      shortName: awayTeam.slice(0, 3).toUpperCase(),
      logo: getTeamLogoUrl(awayTeam),
    },
    status: isLive ? "live" : "upcoming",
    startTime: raw.date ?? new Date().toISOString(),
    marketCount: Number(raw.activeMarkets) || 0,
    markets: normalizedMarkets,
    fixtureMarkets: buildFixtureMarkets(raw, markets),
    ...(isLive
      ? {
          score: { home: homeScore!, away: awayScore! },
          minute: parseMinute(raw.eventTime),
          period: normalizePeriod(raw.matchStatus),
        }
      : {}),
  };
}

/** Normalizes the `{ fixtures, markets }` envelope or bare array returned by the API */
export function normalizeFixtureResponse(response: RawFixtureResponse): SportEvent[] {
  if (!response) return [];

  let fixtures: RawFixture[];
  let markets: RawMarket[];

  if (Array.isArray(response)) {
    fixtures = response;
    markets = [];
  } else if ("data" in response) {
    const payload = (response as RawFixtureDataEnvelope).data;
    fixtures = payload?.fixtures ?? [];
    markets = payload?.markets ?? [];
  } else {
    const payload = response as RawFixtureEnvelope;
    fixtures = payload.fixtures ?? [];
    markets = payload.markets ?? [];
  }

  return fixtures
    .map((f) => normalizeRawFixture(f, markets))
    .filter((e): e is SportEvent => e !== null);
}
