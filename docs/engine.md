# The match engine

Everything in `lib/engine` is a pure function of `(fixture, time)`. There is no stored state for matches: ask for the same match at the same instant and you get the same clock, score and prices, on the server or in any browser.

## 1. Schedule

Each competition has a kick-off grid (`slotMinutes`) and a fixed offset, so competitions don't all start on the hour.

| Sport | New slot every | Match length (real time) | Matches per slot |
|---|---|---|---|
| Football | 60 min | 105 min (2 × 45 + 15 break) | 3 |
| Basketball | 120 min | 108 min (4 quarters + breaks) | 3 |
| Ice hockey | 90 min | 80 min (3 × 20 + 2 × 10 breaks) | 3 |
| Tennis | 60 min | up to 126 min (best of three sets) | 2 |

The fixtures for a slot come from a seeded shuffle of the competition's clubs. Matches run longer than the gap between slots, so a club could otherwise appear in two live matches at once. To prevent that, clubs are split into `ceil(matchLength / slotGap)` pools, and each slot draws only from its own pool.

Fixture IDs encode the competition, slot and position, so `fixtureById` can rebuild any match from its ID alone.

## 2. Team strength

Every club has a rating. A fixture turns the two ratings into an expected rate for each side:

- **Football:** goals per match ≈ `1.35 × tempo × (home ÷ away)^0.8`, plus a small home advantage.
- **Ice hockey:** the same shape, around 2.9 goals per side.
- **Basketball:** about 108 points per side, shifted by 12 points per rating point of difference, plus 3 for the home side.
- **Tennis:** a probability of winning each set, kept between 18% and 82%.

`tempo` lets one competition play a little more open than another.

## 3. The match itself

Scoring is decided before kick-off. `timeline(fixture)` uses the fixture's seed to place goals (or scoring plays) at specific game minutes, drawn from the rates above. `matchState(fixture, now)` then converts real elapsed time into a game clock and reads the score off the timeline.

That gives:

- a clock and a status (`1st half`, `pause`, `3rd period`, `2nd quarter` and so on),
- the current score and half-time score,
- a `suspended` flag that is true for 25 seconds after a goal in football or hockey, and 20 seconds after each tennis set.

Tennis is handled separately. The set winners are decided up front, and set lengths depend on the game score, so a 6–1 set finishes faster than a 7–5 one.

## 4. Pricing

Prices start as probabilities and are then turned into odds.

**Football and hockey.** Remaining goals for each side follow a Poisson distribution with mean `rate × time remaining`. Adding them to the current score gives probabilities for every final score, and every market (1X2, totals, both teams to score, handicaps, first half) is a sum over that grid.

**Basketball.** The final margin is treated as normal, centred on the current margin plus the expected remaining difference. Its spread narrows as the clock runs down.

**Tennis.** The engine enumerates every way the remaining sets can go from the current set score, which is at most four paths in a best of three.

**From probability to odds:**

```
p    = clamp(probability × drift, 0.0075, 0.985)
odds = 1 / (p × 1.065)          // 6.5% margin
```

`drift` is a small deterministic wobble (±3.5%). It changes every 12 seconds in play and every 4 minutes before kick-off, so prices move like a real feed without the betslip asking you to re-accept them every few seconds.

Prices of 100 or more, and of 1.01, are shown with a padlock instead of a number. At that point the outcome is effectively decided, and a real bookmaker would have closed it too.

## 5. Settlement

When a match ends, each market's outcome is decided from the final score (or the half-time score for first-half markets). `account.ts` runs `settle()` every time the balance or the ticket list is loaded:

- A ticket is lost as soon as any leg loses, without waiting for the other matches.
- It wins once every leg has won or been voided. Void legs count at odds of 1.00, and a ticket where every leg is void is refunded.
- Winnings are credited to the play balance and logged as a transaction.

## 6. Casino maths

The casino games use the browser's `crypto.getRandomValues` rather than the match seed, since each round should be independent.

| Game | Rule | Return to player |
|---|---|---|
| Liftoff | Crash point = `0.97 ÷ (1 − u)`, capped at 1,000× | 97% |
| Spot Kick | Keeper picks one of three corners; each goal pays 1.45× | 97% per kick |
| Dice Duel | Payout = `99 ÷ win chance` | 99% |
| Hi-Lo | Payout per guess = `0.97 ÷ P(correct)`; ties lose | 97% |

## 7. Performance notes

- Pre-match prices are cached for each drift window, so repeat requests only cost a copy.
- The live feed reprices half of the subscribed matches per tick and skips messages where nothing changed.
- The feed starts after the page's `load` event, so it doesn't compete with first render.
