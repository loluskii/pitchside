# CLAUDE.md

Guidance for working in this repository.

## Commands

```bash
npm run dev     # http://localhost:3000
npm test        # vitest (includes lib/engine tests)
npm run build
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query v5 · Zustand v5 · Axios (fetch adapter).

## Architecture

- `lib/engine/` — the match simulation. Everything is a pure function of (seed, time).
  - `catalog.ts` sports, regions, competitions, clubs (all fictional)
  - `model.ts` schedule, match state, pricing model
  - `feed.ts` feed-shaped fixtures/markets, settlement
  - `upstream.ts` answers service requests (fixtures, bets, platform) in-process
  - `install.ts` routes engine-host requests (global fetch in the browser; `engineFetch` in server routes)
  - `realtime.ts` publishes live topics: `sports/{sportId}/match/{matchId}/{markets|scores|match_status|bet_stop}`
  - `account.ts` play-money account and ticket ledger in localStorage
- `lib/api/` thin service wrappers; base URLs in `lib/api/config.ts`.
- `lib/services/mqttService.ts` + `lib/hooks/useMqtt.ts` live-topic subscription layer; `useSportsbookRealtimeBridge` patches the query cache.
- `store/couponStore.ts` the betslip.

## Conventions

- Keep engine output shapes identical to what the API layer and normalisers already consume.
- Design tokens live at the top of `app/globals.css` (`--ink`, `--chalk`, `--paper`, `--pitch`, `--lime`, `--flare`); the "Pitchside skin" block at the end overrides base component styles.
- Every fixture shows a `SimBadge`. No real-money flows.
- Mobile shell: max width 480px.
