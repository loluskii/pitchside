// Match scheduling, in-play state and pricing.
// Everything here is a pure function of (fixture, time).

import { LEAGUES, getLeague, getSport, type LeagueDef, type SportDef } from "./catalog";
import { hash, poissonSample, rng, shuffle } from "./random";

const MINUTE = 60_000;
/** Fixed origin for the kick-off grid. */
const EPOCH = Date.UTC(2026, 0, 1);
/** How far ahead the fixture list reaches. */
export const HORIZON_HOURS = 48;

export type Fixture = {
  id: number;
  league: LeagueDef;
  sport: SportDef;
  slot: number;
  kickoff: number;
  home: string;
  away: string;
  /** Pre-match strength of each side (expected goals / points per game). */
  homeRate: number;
  awayRate: number;
};

export type Phase = "scheduled" | "live" | "break" | "ended";

export type MatchState = {
  phase: Phase;
  /** Feed status text: "not started", "1st half", "halftime", ... */
  status: string;
  /** Clock as the feed shows it, "MM:SS". */
  clock: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  /** Share of regulation still to play, 0..1. */
  remaining: number;
  /** Score at the end of the first half (football) or null if not reached. */
  halfTime: [number, number] | null;
  /** True for ~25s after a score changes; markets are suspended meanwhile. */
  suspended: boolean;
};

// ─── Schedule ────────────────────────────────────────────────────────────────

function fixtureId(league: LeagueDef, slot: number, index: number) {
  // Stable, numeric, unique: league id, slot and index packed together.
  return Number(`${league.id}${String(slot % 1_000_000).padStart(6, "0")}${index}`);
}

function teamRating(league: LeagueDef, team: string) {
  const next = rng(`${league.id}:${team}:rating`);
  return 0.7 + next() * 0.6; // 0.7 .. 1.3
}

/** Fixtures for one competition slot. Teams split in two pools that alternate slots, so no club is ever in two live games at once. */
export function fixturesForSlot(league: LeagueDef, slot: number): Fixture[] {
  const sport = getSport(league.sportId)!;
  const kickoff = EPOCH + (slot * sport.slotMinutes + league.offset) * MINUTE;
  // Enough pools that a slot never shares players with any slot still in play.
  const pools = Math.max(1, Math.ceil(sport.liveMinutes / sport.slotMinutes));
  const pool = league.teams.filter((_, i) => i % pools === Math.abs(slot) % pools);
  const ordered = shuffle(pool, rng(`${league.id}:${slot}:draw`));
  const fixtures: Fixture[] = [];

  for (let i = 0; i < sport.matchesPerSlot && i * 2 + 1 < ordered.length; i++) {
    const home = ordered[i * 2];
    const away = ordered[i * 2 + 1];
    const hr = teamRating(league, home);
    const ar = teamRating(league, away);
    const rates = sideRates(sport, league, hr, ar);
    fixtures.push({
      id: fixtureId(league, slot, i),
      league,
      sport,
      slot,
      kickoff,
      home,
      away,
      homeRate: rates[0],
      awayRate: rates[1],
    });
  }
  return fixtures;
}

/** Expected goals/points per side; for tennis, the chance of each player winning a set. */
function sideRates(sport: SportDef, league: LeagueDef, hr: number, ar: number): [number, number] {
  switch (sport.key) {
    case "football":
      return [1.35 * league.tempo * (hr / ar) ** 0.8 + 0.15, 1.35 * league.tempo * (ar / hr) ** 0.8];
    case "hockey":
      return [2.9 * league.tempo * (hr / ar) ** 0.7 + 0.2, 2.9 * league.tempo * (ar / hr) ** 0.7];
    case "basketball":
      return [108 * league.tempo + (hr - ar) * 12 + 3, 108 * league.tempo + (ar - hr) * 12];
    case "tennis": {
      const p = Math.min(0.82, Math.max(0.18, 0.5 + (hr - ar) * 0.55));
      return [p, 1 - p];
    }
  }
}

function slotAt(league: LeagueDef, sport: SportDef, time: number) {
  return Math.floor(((time - EPOCH) / MINUTE - league.offset) / sport.slotMinutes);
}

/** All fixtures (live and upcoming) known at `now`. */
export function fixturesAround(now: number, options: { sportId?: string | number; leagueId?: string | number } = {}) {
  const out: Fixture[] = [];
  for (const league of LEAGUES) {
    if (options.sportId && String(options.sportId) !== "0" && String(league.sportId) !== String(options.sportId)) continue;
    if (options.leagueId && String(options.leagueId) !== "0" && String(league.id) !== String(options.leagueId)) continue;
    const sport = getSport(league.sportId)!;
    const first = slotAt(league, sport, now - sport.liveMinutes * MINUTE);
    const last = slotAt(league, sport, now + HORIZON_HOURS * 60 * MINUTE);
    for (let slot = first; slot <= last; slot++) {
      for (const fixture of fixturesForSlot(league, slot)) {
        if (fixture.kickoff + sport.liveMinutes * MINUTE <= now) continue;
        out.push(fixture);
      }
    }
  }
  return out.sort((a, b) => a.kickoff - b.kickoff || a.id - b.id);
}

export function fixtureById(id: number | string): Fixture | null {
  const text = String(id);
  const league = getLeague(text.slice(0, 4));
  if (!league || text.length < 11) return null;
  const slot = Number(text.slice(4, -1));
  const index = Number(text.slice(-1));
  const candidates = [slot, slot - 1_000_000, slot + 1_000_000];
  for (const s of candidates) {
    const match = fixturesForSlot(league, s)[index];
    if (match && String(match.id) === text) return match;
  }
  return null;
}

// ─── Scoring timeline ────────────────────────────────────────────────────────

type ScoreEvent = { at: number; side: "home" | "away"; points: number };

const timelineCache = new Map<number, ScoreEvent[]>();

/** Scoring events in game minutes, decided before kick-off. */
function timeline(fixture: Fixture): ScoreEvent[] {
  const cached = timelineCache.get(fixture.id);
  if (cached) return cached;
  const next = rng(`${fixture.id}:timeline`);
  const events: ScoreEvent[] = [];

  if (fixture.sport.key === "football" || fixture.sport.key === "hockey") {
    const length = fixture.sport.key === "football" ? 90 : 60;
    for (const side of ["home", "away"] as const) {
      const goals = poissonSample(side === "home" ? fixture.homeRate : fixture.awayRate, next);
      for (let g = 0; g < goals; g++) {
        events.push({ at: 0.5 + next() * (length - 0.6), side, points: 1 });
      }
    }
  } else if (fixture.sport.key === "basketball") {
    // Scoring plays average ~2.2 points; space them so totals land near the expected rate.
    for (const side of ["home", "away"] as const) {
      const target = side === "home" ? fixture.homeRate : fixture.awayRate;
      const interval = (48 * 2.23) / target;
      let at = interval * next();
      while (at < 48) {
        const points = next() < 0.33 ? 3 : next() < 0.15 ? 1 : 2;
        events.push({ at, side, points });
        at += interval * (0.4 + next() * 1.2);
      }
    }
  }

  events.sort((a, b) => a.at - b.at);
  timelineCache.set(fixture.id, events);
  if (timelineCache.size > 4000) timelineCache.clear();
  return events;
}

function scoreAt(fixture: Fixture, gameMinute: number): [number, number] {
  let h = 0;
  let a = 0;
  for (const e of timeline(fixture)) {
    if (e.at > gameMinute) break;
    if (e.side === "home") h += e.points;
    else a += e.points;
  }
  return [h, a];
}

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

/** Converts real elapsed minutes into the game clock. */
export function matchState(fixture: Fixture, now: number): MatchState {
  const elapsed = (now - fixture.kickoff) / MINUTE;
  const scheduled: MatchState = {
    phase: "scheduled", status: "not started", clock: "", minute: 0,
    homeScore: 0, awayScore: 0, remaining: 1, halfTime: null, suspended: false,
  };
  if (elapsed < 0) return scheduled;

  let gameMinute: number;
  let status: string;
  let phase: Phase = "live";
  let regulation: number;

  if (fixture.sport.key === "football") {
    regulation = 90;
    if (elapsed < 45) {
      gameMinute = elapsed; status = "1st half";
    } else if (elapsed < 60) {
      gameMinute = 45; status = "halftime"; phase = "break";
    } else if (elapsed < 105) {
      gameMinute = 45 + (elapsed - 60); status = "2nd half";
    } else {
      gameMinute = 90; status = "ended"; phase = "ended";
    }
  } else if (fixture.sport.key === "tennis") {
    return tennisState(fixture, elapsed);
  } else if (fixture.sport.key === "hockey") {
    // 3 x 20-minute periods with 10-minute intermissions.
    regulation = 60;
    const periods = ["1st period", "2nd period", "3rd period"];
    gameMinute = 60; status = "ended"; phase = "ended";
    let t = elapsed;
    for (let q = 0; q < 3; q++) {
      if (t < 20) { gameMinute = q * 20 + t; status = periods[q]; phase = "live"; break; }
      t -= 20;
      if (q < 2) {
        if (t < 10) { gameMinute = (q + 1) * 20; status = "pause"; phase = "break"; break; }
        t -= 10;
      }
    }
  } else {
    // 4 x 12 game minutes, each played over 22 real minutes with short breaks.
    regulation = 48;
    const quarter = 22;
    const breaks = [5, 10, 5];
    let t = elapsed;
    gameMinute = 48; status = "ended"; phase = "ended";
    for (let q = 0; q < 4; q++) {
      if (t < quarter) {
        gameMinute = q * 12 + (t / quarter) * 12;
        status = `${["1st", "2nd", "3rd", "4th"][q]} quarter`;
        phase = "live";
        break;
      }
      t -= quarter;
      if (q < 3) {
        if (t < breaks[q]) {
          gameMinute = (q + 1) * 12;
          status = q === 1 ? "halftime" : "pause";
          phase = "break";
          break;
        }
        t -= breaks[q];
      }
    }
  }

  const [homeScore, awayScore] = scoreAt(fixture, gameMinute);
  const lastEvent = timeline(fixture).filter((e) => e.at <= gameMinute && e.points > 0).pop();
  const realMinutesPerGameMinute = fixture.sport.key === "basketball" ? 22 / 12 : 1;
  const sinceLast = lastEvent ? (gameMinute - lastEvent.at) * realMinutesPerGameMinute * 60 : Infinity;
  const half = fixture.sport.key === "football" && gameMinute >= 45 ? scoreAt(fixture, 45) : null;
  const seconds = (gameMinute % 1) * 60;

  return {
    phase,
    status,
    clock: `${pad(gameMinute)}:${pad(seconds)}`,
    minute: Math.floor(gameMinute),
    homeScore,
    awayScore,
    remaining: Math.max(0, (regulation - gameMinute) / regulation),
    halfTime: half,
    // Football goals are rare, so freeze markets briefly after each one.
    suspended: fixture.sport.key !== "basketball" && phase === "live" && sinceLast < 25,
  };
}

// ─── Tennis ──────────────────────────────────────────────────────────────────

type TennisSet = { winner: "home" | "away"; games: [number, number]; start: number; end: number };
const SET_MINUTES = 38;
const SET_BREAK = 4;
const setsCache = new Map<number, TennisSet[]>();

/** Best of three sets, decided before the first serve. */
export function tennisSets(fixture: Fixture): TennisSet[] {
  const cached = setsCache.get(fixture.id);
  if (cached) return cached;
  const next = rng(`${fixture.id}:sets`);
  const sets: TennisSet[] = [];
  let won = { home: 0, away: 0 };
  let t = 0;
  while (won.home < 2 && won.away < 2) {
    const winner = next() < fixture.homeRate ? "home" : "away";
    const tiebreak = next() < 0.16;
    const loserGames = tiebreak ? 6 : Math.floor(next() * 5);
    const winGames = tiebreak ? 7 : loserGames === 5 ? 7 : 6;
    const length = SET_MINUTES * ((winGames + loserGames) / 10);
    sets.push({
      winner,
      games: winner === "home" ? [winGames, loserGames] : [loserGames, winGames],
      start: t,
      end: t + length,
    });
    won = { ...won, [winner]: won[winner] + 1 };
    t += length + SET_BREAK;
  }
  setsCache.set(fixture.id, sets);
  if (setsCache.size > 4000) setsCache.clear();
  return sets;
}

function tennisState(fixture: Fixture, elapsed: number): MatchState {
  const sets = tennisSets(fixture);
  const done = sets.filter((s) => s.end <= elapsed);
  const homeScore = done.filter((s) => s.winner === "home").length;
  const awayScore = done.length - homeScore;
  const current = sets.find((s) => s.start <= elapsed && elapsed < s.end);
  const ended = done.length === sets.length;
  const ordinal = ["1st", "2nd", "3rd"];
  const lastEnd = done.length ? done[done.length - 1].end : -Infinity;
  return {
    phase: ended ? "ended" : current ? "live" : "break",
    status: ended ? "ended" : current ? `${ordinal[sets.indexOf(current)]} set` : "pause",
    clock: `${pad(elapsed)}:${pad((elapsed % 1) * 60)}`,
    minute: Math.floor(elapsed),
    homeScore,
    awayScore,
    // For tennis "remaining" is sets still needed by either player, scaled 0..1.
    remaining: ended ? 0 : 1 - done.length / 3,
    halfTime: null,
    suspended: !ended && (elapsed - lastEnd) * 60 < 20,
  };
}

/** Completed set scores, for period-by-period display. */
export function tennisSetScores(fixture: Fixture, now: number) {
  const elapsed = (now - fixture.kickoff) / MINUTE;
  return tennisSets(fixture).filter((s) => s.end <= elapsed).map((s) => s.games);
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

const MARGIN = 1.065;

function poissonPmf(lambda: number, max: number) {
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= max; k++) {
    out.push(p);
    p = (p * lambda) / (k + 1);
  }
  return out;
}

function normalCdf(x: number) {
  // Abramowitz-Stegun approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Small, smooth drift so prices move every few seconds like a real feed. */
function drift(fixture: Fixture, key: string, now: number) {
  const tick = Math.floor(now / 12000);
  const phase = (hash(`${fixture.id}:${key}`) % 1000) / 159;
  return 1 + 0.035 * Math.sin(tick * 0.9 + phase) * Math.cos(tick * 0.37 + phase * 2);
}

export function toOdds(probability: number, fixture: Fixture, key: string, now: number) {
  const p = Math.min(0.985, Math.max(0.0075, probability * drift(fixture, key, now)));
  const odds = 1 / (p * MARGIN);
  if (odds < 1.02) return 1.01;
  return Math.round(Math.min(odds, 151) * 100) / 100;
}

export type Probabilities = {
  home: number;
  draw: number;
  away: number;
  /** P(total > line) for a given line. */
  over: (line: number, side?: "home" | "away") => number;
  btts: number;
  firstHalf: { home: number; draw: number; away: number; over: (line: number) => number } | null;
  /** P(home wins by more than -hcp), used for handicap / spread. */
  cover: (hcp: number) => number;
};

function tennisProbabilities(fixture: Fixture, state: MatchState): Probabilities {
  const p = fixture.homeRate;
  // Enumerate the remaining sets of a best-of-three.
  const outcomes: Array<{ h: number; a: number; prob: number }> = [];
  const walk = (h: number, a: number, prob: number) => {
    if (h === 2 || a === 2) { outcomes.push({ h, a, prob }); return; }
    walk(h + 1, a, prob * p);
    walk(h, a + 1, prob * (1 - p));
  };
  walk(state.homeScore, state.awayScore, 1);
  const sum = (f: (o: { h: number; a: number }) => boolean) =>
    outcomes.reduce((acc, o) => acc + (f(o) ? o.prob : 0), 0);
  const home = sum((o) => o.h === 2);
  return {
    home,
    draw: 0,
    away: 1 - home,
    over: (line) => sum((o) => o.h + o.a > line),
    btts: 1,
    firstHalf: null,
    cover: (hcp) => sum((o) => o.h + hcp > o.a),
  };
}

export function probabilities(fixture: Fixture, state: MatchState): Probabilities {
  if (fixture.sport.key === "tennis") return tennisProbabilities(fixture, state);
  if (fixture.sport.key === "basketball") {
    const r = Math.max(state.remaining, 0.002);
    const muH = state.homeScore + fixture.homeRate * r;
    const muA = state.awayScore + fixture.awayRate * r;
    const sdDiff = 12 * Math.sqrt(r) + 0.5;
    const sdTotal = 16 * Math.sqrt(r) + 0.5;
    const home = normalCdf((muH - muA) / sdDiff);
    return {
      home,
      draw: 0,
      away: 1 - home,
      over: (line, side) => {
        const mu = side === "home" ? muH : side === "away" ? muA : muH + muA;
        const sd = side ? sdTotal * 0.7 : sdTotal;
        return 1 - normalCdf((line - mu) / sd);
      },
      btts: 1,
      firstHalf: null,
      cover: (hcp) => normalCdf((muH - muA + hcp) / sdDiff),
    };
  }

  const r = state.remaining;
  const lh = fixture.homeRate * r;
  const la = fixture.awayRate * r;
  const ph = poissonPmf(lh, 10);
  const pa = poissonPmf(la, 10);
  let home = 0, draw = 0, away = 0, btts = 0;
  const totals = new Map<string, number>();
  const sideTotals = { home: new Map<number, number>(), away: new Map<number, number>() };

  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = ph[i] * pa[j];
      const fh = state.homeScore + i;
      const fa = state.awayScore + j;
      if (fh > fa) home += p; else if (fh === fa) draw += p; else away += p;
      if (fh > 0 && fa > 0) btts += p;
      const t = fh + fa;
      totals.set(String(t), (totals.get(String(t)) ?? 0) + p);
      sideTotals.home.set(fh, (sideTotals.home.get(fh) ?? 0) + p);
      sideTotals.away.set(fa, (sideTotals.away.get(fa) ?? 0) + p);
    }
  }

  const over = (line: number, side?: "home" | "away") => {
    let p = 0;
    if (side) {
      sideTotals[side].forEach((v, k) => { if (k > line) p += v; });
    } else {
      totals.forEach((v, k) => { if (Number(k) > line) p += v; });
    }
    return p;
  };

  const cover = (hcp: number) => {
    let p = 0;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      if (state.homeScore + i + hcp > state.awayScore + j) p += ph[i] * pa[j];
    }
    return p;
  };

  // First-half markets only make sense before the break.
  let firstHalf: Probabilities["firstHalf"] = null;
  if (fixture.sport.key === "football" && (state.phase === "scheduled" || (state.phase === "live" && state.status === "1st half"))) {
    const rh = state.phase === "scheduled" ? 0.5 : Math.max(0, (45 - state.minute) / 90);
    const fhH = poissonPmf(fixture.homeRate * rh * 0.9, 8);
    const fhA = poissonPmf(fixture.awayRate * rh * 0.9, 8);
    let h = 0, d = 0, a = 0;
    const t = new Map<number, number>();
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const p = fhH[i] * fhA[j];
      const x = state.homeScore + i, y = state.awayScore + j;
      if (x > y) h += p; else if (x === y) d += p; else a += p;
      t.set(x + y, (t.get(x + y) ?? 0) + p);
    }
    firstHalf = {
      home: h, draw: d, away: a,
      over: (line) => { let p = 0; t.forEach((v, k) => { if (k > line) p += v; }); return p; },
    };
  }

  return { home, draw, away, over, btts, firstHalf, cover };
}
