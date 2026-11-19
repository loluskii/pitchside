# Pitchside

A mobile-first sportsbook running on a live match simulation. Fixtures kick off every hour, around the clock. Clocks tick, goals land, prices move every few seconds, markets suspend after a goal, and tickets settle when the final whistle goes.

Every fixture carries a **SIM** badge. Clubs and competitions are fictional, balances are play money, and no payments exist anywhere in the product.

**Live:** https://pitchside-app.vercel.app

## What's interesting here

### The match engine (`lib/engine`)

There's no backend or database, and nothing to keep in sync. The whole sporting world is a **pure function of time**:

- **Schedule** (`model.ts`): each competition has a kick-off grid. Fixtures for a slot are drawn from a seeded shuffle. Clubs are split into two pools that alternate slots, so no club ever appears in two live games at once.
- **Match state** (`model.ts`): scoring timelines are decided before kick-off, from each side's strength. Football uses Poisson goals across 90 minutes plus a 15-minute break. Basketball uses four quarters with pauses. `matchState(fixture, now)` returns the clock, phase and score at any instant.
- **Pricing** (`model.ts`, `feed.ts`): football prices come from the remaining expected goals, combined with a Poisson model of the score so far. Basketball uses a normal approximation on the points spread. Either way, prices carry a 6.5% margin plus a slow, deterministic drift, so they move like a real feed. Markets suspend for 25 seconds after each goal.
- **Settlement** (`feed.ts`, `account.ts`): when a match ends, the model's probabilities collapse to 0 or 1. Every selection settles from the final (or half-time) score, and winnings are paid back into the play balance.

The server-rendered feed and the in-browser live ticker don't share any state. Because both compute from the same seed and clock, they always agree.

### Same contracts, different source

The UI talks to the engine through the same service paths and payload shapes a production sportsbook API uses:

- **REST:** fixtures, markets, bet placement and history.
- **Live topics:** markets, scores, match status and bet stops.

`lib/engine/upstream.ts` answers those requests in-process, and `lib/engine/realtime.ts` publishes the live topics. Nothing upstream of the API layer knows the difference. Pointing `lib/api/config.ts` at a real API is a two-line change.

### The app

- **Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4.**
- **State:** TanStack Query for server state, with live updates patched into the query cache. Zustand for the betslip, auth and UI.
- **Betslip:** singles, multiples and system bets, odds-change acceptance, booking codes, and validation against live prices before placement.
- **Accounts:** the player account and ticket ledger live in the browser, so every visitor gets their own play balance.

## Design

The look is light "chalk and ink":

- **Surfaces:** warm off-white pages with paper-white cards.
- **Colour:** pitch green for state and for odds, chalk-lime for anything you can act on, and a red flare for in-play.
- **Type:** Bricolage Grotesque for headings, Geist for interface text, and Geist Mono for odds and clocks, so numbers line up as they change.
- **Navigation:** a dark floating dock.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests, including the engine
npm run build
```

No environment variables are needed.
