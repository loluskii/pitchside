# Case study: Pitchside

## The problem

A sportsbook front end is hard to show. Every screen depends on a live odds feed, which means a licensed data provider, a betting backend and a wallet. Without those, the screens are empty, and an empty sportsbook doesn't demonstrate anything.

The goal was a public product that feels live whenever someone opens it (matches in progress, prices moving, bets settling) without a backend to run, without fake screenshots, and without real money anywhere near it.

## The approach

Instead of mocking a few endpoints, Pitchside has a deterministic match engine that runs inside the app.

- **The whole sporting world is a function of the clock.** Given the current time, the engine knows which matches exist, what minute each one is in, the score, and a price for every market. Two visitors opening the site at the same moment see the same matches and the same scores, with no server or database coordinating them.
- **The engine behaves like a real sportsbook API.** The app calls REST paths and subscribes to MQTT-style live topics, using the payload shapes a production odds feed uses. The UI, data normalisers and betslip are written against that contract, not against the engine, so they'd work unchanged against a real API.
- **Accounts and tickets live in the browser.** Each visitor gets a play-money balance of ₦50,000, and bets settle against the engine's final scores.

On top of that sit four sports, four casino games, and play-money deposit and withdrawal flows.

## What it shows

- About 50 matches in play at any time across four sports, with new kick-offs every hour.
- Prices that react to the score and the clock, lock when an outcome is decided, and suspend briefly after a goal.
- A full betslip: singles, accumulators and system bets, price-change handling, booking codes, and settlement.
- Four casino games with stated return-to-player figures, all using the same balance.

## Results

| | |
|---|---|
| Lighthouse accessibility | 100 on every page tested |
| Lighthouse best practices / SEO | 100 / 100 |
| Lighthouse performance (mobile) | 75 to 80 on sport and casino pages, 50 to 65 on the home page |
| Unit tests | 149 passing, including the engine |
| Backend | none |

The home page score is the one weak spot. The engine and the live feed both run on the main thread, and Lighthouse's simulated mid-range phone counts that heavily. Moving the engine into a Web Worker would fix it, and it's the first thing to do if the project goes further.

## Further reading

- [Architecture](architecture.md): how requests and live updates flow.
- [The match engine](engine.md): scheduling, scoring, pricing and settlement.
- [Decisions and trade-offs](decisions.md)
