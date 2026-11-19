import { describe, expect, it } from "vitest";
import { fixtureById, fixturesAround, matchState } from "./model";
import { liveFixtures, priceFixture, settleSelection } from "./feed";

const NOW = Date.UTC(2026, 10, 19, 18, 30);

describe("match engine", () => {
  it("always has fixtures in play", () => {
    for (let h = 0; h < 48; h += 3) {
      expect(liveFixtures(NOW + h * 3_600_000).length).toBeGreaterThan(10);
    }
  });

  it("is deterministic: the same fixture and time give the same state and prices", () => {
    const [fixture] = liveFixtures(NOW);
    expect(matchState(fixture, NOW)).toEqual(matchState(fixture, NOW));
    expect(priceFixture(fixture, NOW)).toEqual(priceFixture(fixture, NOW));
  });

  it("round-trips fixture ids", () => {
    for (const fixture of fixturesAround(NOW).slice(0, 50)) {
      expect(fixtureById(fixture.id)?.home).toBe(fixture.home);
    }
  });

  it("never schedules a club in two overlapping games", () => {
    const live = liveFixtures(NOW);
    const clubs = live.flatMap((f) => [`${f.league.id}:${f.home}`, `${f.league.id}:${f.away}`]);
    expect(new Set(clubs).size).toBe(clubs.length);
  });

  it("scores only go up and the clock moves forward", () => {
    const [fixture] = liveFixtures(NOW);
    let last = matchState(fixture, fixture.kickoff);
    for (let t = fixture.kickoff; t < fixture.kickoff + 110 * 60_000; t += 60_000) {
      const state = matchState(fixture, t);
      expect(state.homeScore).toBeGreaterThanOrEqual(last.homeScore);
      expect(state.awayScore).toBeGreaterThanOrEqual(last.awayScore);
      last = state;
    }
    expect(last.phase).toBe("ended");
  });

  it("prices a fair book with margin", () => {
    const [fixture] = fixturesAround(NOW).filter((f) => f.kickoff > NOW && f.sport.key === "football");
    const market = priceFixture(fixture, NOW).find((m) => m.marketID === 1)!;
    const overround = market.outcomes.reduce((sum, o) => sum + 1 / o.odds, 0);
    expect(overround).toBeGreaterThan(1.02);
    expect(overround).toBeLessThan(1.12);
  });

  it("settles 1X2 from the final score", () => {
    const [fixture] = liveFixtures(NOW);
    const end = fixture.kickoff + 200 * 60_000;
    const final = matchState(fixture, end);
    const winner = final.homeScore > final.awayScore ? 1 : final.homeScore === final.awayScore ? 2 : 3;
    expect(settleSelection(fixture.id, 1, "", winner, end).result).toBe("won");
    expect(settleSelection(fixture.id, 1, "", winner === 1 ? 3 : 1, end).result).toBe("lost");
    expect(settleSelection(fixture.id, 1, "", winner, fixture.kickoff - 1).result).toBe("pending");
  });
});
