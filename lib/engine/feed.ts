// Builds feed-shaped payloads (fixtures, outcomes, market metadata) from the model.

import type { RawFixture, RawMarket, RawOutcome } from "@/lib/utils/normalize";
import { LEAGUES, SPORTS, getLeague } from "./catalog";
import {
  fixtureById,
  fixturesAround,
  matchState,
  probabilities,
  toOdds,
  type Fixture,
  type MatchState,
} from "./model";

type OutcomeDef = { id: number; name: string; label: string; p: number };
type MarketDef = {
  id: number;
  name: string;
  specifier: string;
  group: string;
  outcomes: OutcomeDef[];
};

export type FeedMarket = RawMarket & {
  marketID: number;
  marketName: string;
  specifier: string;
  sportID: number;
  status: number;
  statusName: string;
  group: string;
  outcomes: Array<RawOutcome & { outcomeID: number; odds: number; active: number }>;
};

const fmt = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

function footballMarkets(fixture: Fixture, state: MatchState): MarketDef[] {
  const p = probabilities(fixture, state);
  const goals = state.homeScore + state.awayScore;
  const lines = state.phase === "scheduled" ? [1.5, 2.5, 3.5] : [goals + 0.5, goals + 1.5, goals + 2.5];
  const markets: MarketDef[] = [
    {
      id: 1, name: "1X2", specifier: "", group: "Main",
      outcomes: [
        { id: 1, name: "Home", label: "1", p: p.home },
        { id: 2, name: "Draw", label: "X", p: p.draw },
        { id: 3, name: "Away", label: "2", p: p.away },
      ],
    },
    ...lines.map((line) => ({
      id: 18, name: "Over/Under", specifier: `total=${fmt(line)}`, group: "Goals",
      outcomes: [
        { id: 12, name: `Over ${fmt(line)}`, label: "Over", p: p.over(line) },
        { id: 13, name: `Under ${fmt(line)}`, label: "Under", p: 1 - p.over(line) },
      ],
    })),
    {
      id: 10, name: "Double chance", specifier: "", group: "Main",
      outcomes: [
        { id: 9, name: "Home or draw", label: "1X", p: p.home + p.draw },
        { id: 10, name: "Home or away", label: "12", p: p.home + p.away },
        { id: 11, name: "Draw or away", label: "X2", p: p.draw + p.away },
      ],
    },
    {
      id: 11, name: "Draw no bet", specifier: "", group: "Main",
      outcomes: [
        { id: 4, name: "Home", label: "1", p: p.home / Math.max(p.home + p.away, 0.001) },
        { id: 5, name: "Away", label: "2", p: p.away / Math.max(p.home + p.away, 0.001) },
      ],
    },
  ];

  if (!(state.homeScore > 0 && state.awayScore > 0)) {
    markets.push({
      id: 29, name: "Both teams to score", specifier: "", group: "Goals",
      outcomes: [
        { id: 74, name: "Yes", label: "Yes", p: p.btts },
        { id: 76, name: "No", label: "No", p: 1 - p.btts },
      ],
    });
  }

  for (const hcp of [-1.5, -0.5, 0.5]) {
    const cover = p.cover(hcp);
    markets.push({
      id: 16, name: "Handicap", specifier: `hcp=${hcp > 0 ? "+" : ""}${fmt(hcp)}`, group: "Handicap",
      outcomes: [
        { id: 1714, name: `Home (${hcp > 0 ? "+" : ""}${fmt(hcp)})`, label: "1", p: cover },
        { id: 1715, name: `Away (${hcp > 0 ? "" : "+"}${fmt(-hcp)})`, label: "2", p: 1 - cover },
      ],
    });
  }

  for (const side of ["home", "away"] as const) {
    const current = side === "home" ? state.homeScore : state.awayScore;
    for (const line of [current + 0.5, current + 1.5]) {
      markets.push({
        id: side === "home" ? 19 : 20,
        name: `${side === "home" ? fixture.home : fixture.away} total`,
        specifier: `total=${fmt(line)}`,
        group: "Goals",
        outcomes: [
          { id: 12, name: `Over ${fmt(line)}`, label: "Over", p: p.over(line, side) },
          { id: 13, name: `Under ${fmt(line)}`, label: "Under", p: 1 - p.over(line, side) },
        ],
      });
    }
  }

  if (p.firstHalf) {
    const fh = p.firstHalf;
    markets.push({
      id: 60, name: "1st half - 1X2", specifier: "", group: "Half",
      outcomes: [
        { id: 1, name: "Home", label: "1", p: fh.home },
        { id: 2, name: "Draw", label: "X", p: fh.draw },
        { id: 3, name: "Away", label: "2", p: fh.away },
      ],
    });
    for (const line of [goals + 0.5, goals + 1.5]) {
      markets.push({
        id: 68, name: "1st half - Over/Under", specifier: `total=${fmt(line)}`, group: "Half",
        outcomes: [
          { id: 12, name: `Over ${fmt(line)}`, label: "Over", p: fh.over(line) },
          { id: 13, name: `Under ${fmt(line)}`, label: "Under", p: 1 - fh.over(line) },
        ],
      });
    }
  }

  return markets;
}

function basketballMarkets(fixture: Fixture, state: MatchState): MarketDef[] {
  const p = probabilities(fixture, state);
  const projected =
    state.homeScore + state.awayScore + (fixture.homeRate + fixture.awayRate) * state.remaining;
  const centre = Math.round(projected) + 0.5;
  const spread = Math.round((fixture.homeRate - fixture.awayRate) * state.remaining + state.homeScore - state.awayScore);
  const markets: MarketDef[] = [
    {
      id: 219, name: "Winner (incl. overtime)", specifier: "", group: "Main",
      outcomes: [
        { id: 4, name: "Home", label: "1", p: p.home },
        { id: 5, name: "Away", label: "2", p: p.away },
      ],
    },
  ];
  for (const line of [centre - 6, centre, centre + 6]) {
    markets.push({
      id: 225, name: "Total (incl. overtime)", specifier: `total=${fmt(line)}`, group: "Points",
      outcomes: [
        { id: 12, name: `Over ${fmt(line)}`, label: "Over", p: p.over(line) },
        { id: 13, name: `Under ${fmt(line)}`, label: "Under", p: 1 - p.over(line) },
      ],
    });
  }
  for (const offset of [-4, 0, 4]) {
    const hcp = -(spread + offset) + 0.5;
    const cover = p.cover(hcp);
    markets.push({
      id: 223, name: "Handicap (incl. overtime)", specifier: `hcp=${hcp > 0 ? "+" : ""}${fmt(hcp)}`, group: "Main",
      outcomes: [
        { id: 1714, name: `Home (${hcp > 0 ? "+" : ""}${fmt(hcp)})`, label: "1", p: cover },
        { id: 1715, name: `Away (${hcp > 0 ? "" : "+"}${fmt(-hcp)})`, label: "2", p: 1 - cover },
      ],
    });
  }
  for (const side of ["home", "away"] as const) {
    const mu = (side === "home" ? state.homeScore : state.awayScore) +
      (side === "home" ? fixture.homeRate : fixture.awayRate) * state.remaining;
    const line = Math.round(mu) + 0.5;
    markets.push({
      id: side === "home" ? 227 : 228,
      name: `${side === "home" ? fixture.home : fixture.away} total`,
      specifier: `total=${fmt(line)}`,
      group: "Points",
      outcomes: [
        { id: 12, name: `Over ${fmt(line)}`, label: "Over", p: p.over(line, side) },
        { id: 13, name: `Under ${fmt(line)}`, label: "Under", p: 1 - p.over(line, side) },
      ],
    });
  }
  return markets;
}

/** Fully priced markets for a fixture at `now`. */
export function priceFixture(fixture: Fixture, now: number, state = matchState(fixture, now)): FeedMarket[] {
  const defs = fixture.sport.key === "football" ? footballMarkets(fixture, state) : basketballMarkets(fixture, state);
  const frozen = state.suspended || state.phase === "ended";
  return defs.map((def) => ({
    marketID: def.id,
    marketName: def.name,
    specifier: def.specifier,
    sportID: fixture.sport.id,
    status: frozen ? 1 : 0,
    statusName: frozen ? "Suspended" : "Active",
    group: def.group,
    outcomes: def.outcomes.map((outcome) => {
      const odds = toOdds(outcome.p, fixture, `${def.id}:${def.specifier}:${outcome.id}`, now);
      return {
        outcomeID: outcome.id,
        marketID: def.id,
        outcomeName: outcome.name,
        displayName: outcome.label,
        specifier: def.specifier,
        odds,
        active: frozen ? 0 : 1,
      };
    }),
  }));
}

function iso(time: number) {
  return new Date(time).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** One fixture in list shape: header fields + the outcomes the list views render. */
export function rawFixture(fixture: Fixture, now: number, options: { allMarkets?: boolean } = {}): RawFixture & Record<string, unknown> {
  const state = matchState(fixture, now);
  const markets = priceFixture(fixture, now, state);
  const listMarketIds = fixture.sport.key === "football" ? [1, 18, 10, 29, 11] : [219, 225, 223];
  const visible = options.allMarkets ? markets : markets.filter((m) => listMarketIds.includes(m.marketID));
  const inPlay = state.phase !== "scheduled";

  return {
    matchID: fixture.id,
    eventId: fixture.id,
    homeTeam: fixture.home,
    awayTeam: fixture.away,
    date: iso(fixture.kickoff),
    eventTime: inPlay ? state.clock : "",
    homeScore: inPlay ? state.homeScore : null,
    awayScore: inPlay ? state.awayScore : null,
    matchStatus: state.status,
    tournament: fixture.league.name,
    tournamentID: fixture.league.id,
    tournamentName: fixture.league.name,
    categoryName: fixture.league.categoryName,
    categoryID: fixture.league.categoryId,
    country: fixture.league.categoryName,
    sportID: fixture.sport.id,
    sportName: fixture.sport.feedName,
    activeMarkets: markets.length,
    status: inPlay ? 1 : 0,
    producerStatus: "1",
    outcomes: visible.flatMap((m) => m.outcomes),
    market: options.allMarkets ? markets : undefined,
    eventInfo: inPlay
      ? {
          score: { home: state.homeScore, away: state.awayScore },
          period_scores: state.halfTime
            ? [{ number: 1, home_score: state.halfTime[0], away_score: state.halfTime[1], type: "regular_period" }]
            : [],
        }
      : undefined,
  };
}

/** Market headers for list views (one entry per market id, with the main line). */
export function listMarketMeta(sportId?: number | string): RawMarket[] {
  const meta: RawMarket[] = [
    { marketID: 1, marketName: "1X2", sportID: 1, specifier: "" },
    { marketID: 18, marketName: "Over/Under", sportID: 1, specifier: "total=2.5" },
    { marketID: 10, marketName: "Double chance", sportID: 1, specifier: "" },
    { marketID: 29, marketName: "Both teams to score", sportID: 1, specifier: "" },
    { marketID: 11, marketName: "Draw no bet", sportID: 1, specifier: "" },
    { marketID: 219, marketName: "Winner", sportID: 2, specifier: "" },
    { marketID: 225, marketName: "Total", sportID: 2, specifier: "" },
    { marketID: 223, marketName: "Handicap", sportID: 2, specifier: "" },
  ];
  if (!sportId || String(sportId) === "0") return meta;
  return meta.filter((m) => String(m.sportID) === String(sportId));
}

export function marketGroups(sportId: number | string) {
  if (String(sportId) === "2") {
    return [
      { id: 1, sportID: 2, name: "Main", marketIDs: [219, 223], priority: 1 },
      { id: 2, sportID: 2, name: "Points", marketIDs: [225, 227, 228], priority: 2 },
    ];
  }
  return [
    { id: 1, sportID: 1, name: "Main", marketIDs: [1, 10, 11], priority: 1 },
    { id: 2, sportID: 1, name: "Goals", marketIDs: [18, 29, 19, 20], priority: 2 },
    { id: 3, sportID: 1, name: "Handicap", marketIDs: [16], priority: 3 },
    { id: 4, sportID: 1, name: "1st Half", marketIDs: [60, 68], priority: 4 },
  ];
}

// ─── Queries the endpoints are built from ────────────────────────────────────

export function liveFixtures(now: number, sportId?: string | number) {
  return fixturesAround(now, { sportId }).filter((f) => {
    const phase = matchState(f, now).phase;
    return phase === "live" || phase === "break";
  });
}

export function upcomingFixtures(
  now: number,
  filter: { sportId?: string | number; leagueId?: string | number; categoryId?: string | number; from?: number; to?: number } = {},
) {
  return fixturesAround(now, { sportId: filter.sportId, leagueId: filter.leagueId }).filter((f) => {
    if (f.kickoff <= now) return false;
    if (filter.categoryId && String(filter.categoryId) !== "0" && String(f.league.categoryId) !== String(filter.categoryId)) return false;
    if (filter.from && f.kickoff < filter.from) return false;
    if (filter.to && f.kickoff > filter.to) return false;
    return true;
  });
}

export function sportsMenu(now: number) {
  return SPORTS.map((sport) => ({
    sport_id: sport.id,
    sport_name: sport.feedName,
    games: fixturesAround(now, { sportId: sport.id }).length,
  }));
}

export function liveCounter(now: number) {
  const sports = SPORTS.map((sport) => ({
    sport_id: sport.id,
    sport_name: sport.feedName,
    games: liveFixtures(now, sport.id).length,
  }));
  return { total: sports.reduce((sum, s) => sum + s.games, 0), sports };
}

export function categories(now: number, sportId: string | number) {
  const leagues = LEAGUES.filter((l) => String(l.sportId) === String(sportId));
  const seen = new Map<number, { category_id: number; country_name: string; category_name: string; games: number }>();
  for (const league of leagues) {
    const games = upcomingFixtures(now, { leagueId: league.id }).length;
    const entry = seen.get(league.categoryId) ?? {
      category_id: league.categoryId, country_name: league.categoryName, category_name: league.categoryName, games: 0,
    };
    entry.games += games;
    seen.set(league.categoryId, entry);
  }
  return [...seen.values()];
}

export function tournaments(now: number, sportId: string | number, categoryId?: string | number) {
  return LEAGUES.filter(
    (l) => String(l.sportId) === String(sportId) && (!categoryId || String(categoryId) === "0" || String(l.categoryId) === String(categoryId)),
  ).map((league) => ({
    tournament_id: league.id,
    tournamentID: league.id,
    name: league.name,
    tournament_name: league.name,
    category_id: league.categoryId,
    category_name: league.categoryName,
    games: upcomingFixtures(now, { leagueId: league.id }).length,
  }));
}

export function topTournaments() {
  return LEAGUES.map((league) => ({
    id: league.id,
    tournament_id: league.id,
    tournament_name: league.name,
    category_name: league.categoryName,
    sport_id: league.sportId,
    priority: league.priority,
  }));
}

export function search(now: number, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return fixturesAround(now)
    .filter((f) => [f.home, f.away, f.league.name, f.league.categoryName].some((v) => v.toLowerCase().includes(q)))
    .slice(0, 50);
}

export { fixtureById, getLeague, matchState };

// ─── Settlement ──────────────────────────────────────────────────────────────

function specValue(specifier: string, key: string) {
  const part = specifier.split("|").find((p) => p.startsWith(`${key}=`));
  return part ? Number(part.split("=")[1]) : NaN;
}

/**
 * Result of one selection once its fixture has finished:
 * "won" | "lost" | "void", or "pending" while it is still being played.
 */
export function settleSelection(
  matchId: number | string,
  marketId: number | string,
  specifier: string,
  outcomeId: number | string,
  now: number,
): { result: "won" | "lost" | "void" | "pending"; state: MatchState | null; fixture: Fixture | null } {
  const fixture = fixtureById(matchId);
  if (!fixture) return { result: "void", state: null, fixture: null };
  const state = matchState(fixture, now);
  const m = Number(marketId);
  const o = Number(outcomeId);
  const firstHalfDone = state.halfTime !== null;
  const isFirstHalfMarket = m === 60 || m === 68;
  if (state.phase !== "ended" && !(isFirstHalfMarket && firstHalfDone)) {
    return { result: "pending", state, fixture };
  }

  const [h, a] = isFirstHalfMarket ? state.halfTime! : [state.homeScore, state.awayScore];
  const total = h + a;
  const line = specValue(specifier, "total");
  const hcp = specValue(specifier, "hcp");
  let won: boolean | null = null;

  switch (m) {
    case 1: case 60: won = (o === 1 && h > a) || (o === 2 && h === a) || (o === 3 && h < a); break;
    case 10: won = (o === 9 && h >= a) || (o === 10 && h !== a) || (o === 11 && h <= a); break;
    case 11: case 219:
      if (h === a) return { result: "void", state, fixture };
      won = (o === 4 && h > a) || (o === 5 && a > h); break;
    case 18: case 68: case 225: won = o === 12 ? total > line : total < line; break;
    case 19: case 227: won = o === 12 ? h > line : h < line; break;
    case 20: case 228: won = o === 12 ? a > line : a < line; break;
    case 29: won = o === 74 ? h > 0 && a > 0 : !(h > 0 && a > 0); break;
    case 16: case 223: won = o === 1714 ? h + hcp > a : h + hcp < a; break;
  }
  if (won === null) return { result: "void", state, fixture };
  return { result: won ? "won" : "lost", state, fixture };
}

/** Current price of a selection, or null if it is no longer offered. */
export function currentPrice(matchId: number | string, marketId: number | string, specifier: string, outcomeId: number | string, now: number) {
  const fixture = fixtureById(matchId);
  if (!fixture) return null;
  const market = priceFixture(fixture, now).find(
    (m) => String(m.marketID) === String(marketId) && String(m.specifier) === String(specifier ?? ""),
  );
  const outcome = market?.outcomes.find((x) => String(x.outcomeID) === String(outcomeId));
  if (!market || !outcome) return null;
  return { odds: Number(outcome.odds), active: outcome.active === 1, market, fixture };
}
