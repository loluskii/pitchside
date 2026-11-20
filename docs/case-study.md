# Case study: Pitchside

## The problem

Pitchside started as a mobile sportsbook front end built against a real betting API: fixtures, live odds over MQTT, bet placement, booking codes, a cash wallet. When that API was switched off, the app had nothing to show. Every screen depended on live data, and an empty sportsbook doesn't demonstrate anything.

The goal was to bring the product back as a public showcase without rebuilding the backend, without fake screenshots, and without real money anywhere near it. It had to feel live whenever someone opened it: matches in progress, prices moving, bets settling.

## The approach

Instead of mocking a few endpoints, the backend was replaced with a deterministic match engine that runs inside the app.

- **The whole sporting world is a function of the clock.** Given the current time, the engine knows which matches exist, what minute each one is in, the score, and a price for every market. Two visitors opening the site at the same moment see the same matches and the same scores, with no server or database coordinating them.
- **The engine speaks the old API's language.** Requests go to the same paths, and responses come back in the same shapes the app already used, so the UI layer, the data normalisers and the betslip didn't need rewriting. Live updates use the same topic names the MQTT broker used.
- **Accounts and tickets live in the browser.** Each visitor gets a play-money balance of ₦50,000, and bets settle against the engine's final scores.

On top of that, the product was rebranded and redesigned, and extended with ice hockey, tennis, four casino games and play-money deposit and withdrawal flows.

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
