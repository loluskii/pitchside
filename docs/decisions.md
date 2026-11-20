# Decisions and trade-offs

## No backend

**Decision:** Run the whole product in the app. Matches, prices and settlement come from a deterministic engine, and accounts live in the browser.

**Why:** The goal is a showcase that stays live with no running costs and nothing to break overnight. A deterministic engine also means every visitor sees the same matches, which makes the product feel shared rather than faked per user.

**Cost:** Each visitor's balance and tickets stay on their own device. Clearing site data resets them, and two devices can't share an account.

## Use real-world API contracts

**Decision:** The engine answers REST paths and publishes live topics in the shapes a production odds feed uses, instead of handing the UI plain objects.

**Why:** The UI, data normalisers, betslip and live-update bridge are written against that contract, so they're the same code that would run against a real provider. Pointing the app at a real API only means changing the base URLs in `lib/api/config.ts`.

**Cost:** Some payloads carry fields the engine doesn't need, and a few endpoints return empty lists for features this version doesn't have (promotions, referrals).

## Play money only

**Decision:** No real deposits, no withdrawals to real accounts, and no card or bank-number fields anywhere. The deposit and withdrawal screens move play money.

**Why:** It's a gambling product shown in public. Keeping real money out entirely removes the legal question, and the screens still demonstrate the flows.

## Lock decided prices instead of hiding them

**Decision:** Prices of 100 or more, or of 1.01, render as a padlock in the same spot.

**Why:** Showing 125.20 next to 1.01 looks like a broken feed. Removing the button instead would shift the other prices out of their columns.

## Accept price rises automatically

**Decision:** If a price in the betslip goes up, the slip takes it without asking. If a price goes down, or a market is suspended, the player confirms.

**Why:** A rise only helps the player, and live prices tick often. Asking every time made the slip unusable.

## Self-hosted photography

**Decision:** Photos are copied into `public/photos` at three widths by a GitHub Actions workflow (`.github/workflows/photos.yml`), rather than loaded from Unsplash.

**Why:** If a photographer removes an image, a hotlinked version breaks. Local copies also load from the same host as the page.

## Where it falls short

- **Home page performance.** The engine and live feed share the main thread with React. A Web Worker for the engine is the obvious next step.
- **Mobile only.** The layout is built for phone widths and is centred on larger screens.
- **Single device.** See "No backend" above.
