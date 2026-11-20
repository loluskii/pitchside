"use client";

// In-browser live feed. Publishes the same topics and payloads the realtime
// layer subscribes to (markets, scores, match_status, bet_stop), driven by the
// match engine's clock.

import { priceFixture } from "./feed";
import { fixtureById, matchState } from "./model";

type Listener = (topic: string, data: Record<string, unknown>) => void;

const TICK_MS = 3000;
const topics = new Set<string>();
const lastStatus = new Map<string, string>();
const lastSuspended = new Map<string, boolean>();
let listener: Listener | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let starting = false;
let tickCount = 0;
const lastScores = new Map<string, string>();
const lastMarkets = new Map<string, string>();

/** Matches are split across two groups so each tick only reprices half of them. */
function groupOf(matchId: string) {
  let h = 0;
  for (let i = 0; i < matchId.length; i++) h = (h * 31 + matchId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2;
}

function publishMatch(sportId: string, matchId: string, wanted: Set<string>, now: number) {
  const fixture = fixtureById(matchId);
  if (!fixture || !listener) return;
  const state = matchState(fixture, now);
  if (state.phase === "scheduled") return;
  const base = `sports/${sportId}/match/${matchId}`;
  const header = {
    match_id: Number(matchId),
    event_time: state.clock,
    match_status: state.status,
    home_score: state.homeScore,
    away_score: state.awayScore,
  };

  if (wanted.has(`${base}/match_status`) && lastStatus.get(matchId) !== state.status) {
    lastStatus.set(matchId, state.status);
    listener(`${base}/match_status`, header);
  }

  const scoreKey = `${header.home_score}:${header.away_score}:${state.status}`;
  // First sighting: the page has just loaded this match fresh, so only record it.
  if (!lastScores.has(matchId)) lastScores.set(matchId, scoreKey);
  if (wanted.has(`${base}/scores`) && lastScores.get(matchId) !== scoreKey) {
    lastScores.set(matchId, scoreKey);
    listener(`${base}/scores`, {
      match_id: header.match_id,
      event_time: header.event_time,
      home_score: header.home_score,
      away_score: header.away_score,
    });
  }

  const suspended = state.suspended || state.phase === "ended";
  if (suspended && !lastSuspended.get(matchId) && wanted.has(`${base}/bet_stop`)) {
    listener(`${base}/bet_stop`, { match_id: header.match_id, suspended: true });
  }
  lastSuspended.set(matchId, suspended);

  if (!suspended && wanted.has(`${base}/markets`) && groupOf(matchId) === tickCount % 2) {
    const markets = priceFixture(fixture, now, state).map((market) => ({
        id: market.marketID,
        market_id: market.marketID,
        market_name: market.marketName,
        specifier: market.specifier,
        status_name: market.statusName,
        outcomes: market.outcomes.map((outcome) => ({
          id: outcome.outcomeID,
          outcome_id: outcome.outcomeID,
          outcome_name: outcome.outcomeName,
          alias: outcome.displayName,
          odds: outcome.odds,
          active: outcome.active,
        })),
      }));
    // Only publish when a price or status actually moved.
    const signature = markets
      .map((m) => `${m.market_id}|${m.specifier}|${m.status_name}|${m.outcomes.map((o) => `${o.odds}${o.active}`).join(",")}`)
      .join(";");
    const previous = lastMarkets.get(matchId);
    lastMarkets.set(matchId, signature);
    if (previous === undefined || previous === signature) return;
    listener(`${base}/markets`, { ...header, markets });
  }
}

function tick() {
  const now = Date.now();
  tickCount += 1;
  const byMatch = new Map<string, { sportId: string; topics: Set<string> }>();
  topics.forEach((topic) => {
    const m = topic.match(/^sports\/(\d+)\/match\/(\d+)\//);
    if (!m) return;
    const entry = byMatch.get(m[2]) ?? { sportId: m[1], topics: new Set<string>() };
    entry.topics.add(topic);
    byMatch.set(m[2], entry);
  });
  byMatch.forEach((entry, matchId) => publishMatch(entry.sportId, matchId, entry.topics, now));
}

export function connectLiveFeed(onMessage: Listener) {
  listener = onMessage;
  if (timer || starting || typeof window === "undefined") return;
  starting = true;
  // Let the first paint and hydration finish before the feed starts pushing updates.
  const start = () => {
    starting = false;
    if (!timer) timer = setInterval(tick, TICK_MS);
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (document.readyState === "complete") {
    if (idle) idle(start, { timeout: 4000 });
    else setTimeout(start, 1500);
  } else {
    window.addEventListener("load", () => (idle ? idle(start, { timeout: 4000 }) : setTimeout(start, 1500)), { once: true });
  }
}

export function subscribeLive(topic: string) {
  topics.add(topic);
}

export function unsubscribeLive(topic: string) {
  topics.delete(topic);
}
