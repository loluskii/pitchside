import type { PhotoKey } from "@/lib/media";

export type CasinoGame = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  photo: PhotoKey;
  accent: string;
  rtp: string;
  maxWin: string;
};

/** Every game is original, runs in the browser, and plays for the play balance only. */
export const CASINO_GAMES: CasinoGame[] = [
  {
    slug: "liftoff",
    name: "Liftoff",
    tagline: "Cash out before it lands",
    blurb: "The multiplier climbs from 1.00×. Bank it whenever you like — if the flight ends first, the stake is gone.",
    photo: "nightFlight",
    accent: "#CBEA4E",
    rtp: "97%",
    maxWin: "1,000×",
  },
  {
    slug: "spot-kick",
    name: "Spot Kick",
    tagline: "Beat the keeper, build the streak",
    blurb: "Pick a corner. Every goal multiplies your stake by 1.45×. Five in a row and you walk off with 6.5×.",
    photo: "goalkeeper",
    accent: "#E0393E",
    rtp: "97%",
    maxWin: "6.5×",
  },
  {
    slug: "dice",
    name: "Dice Duel",
    tagline: "Set the odds yourself",
    blurb: "Choose a target and roll over or under it. The tighter the window, the bigger the payout.",
    photo: "dice",
    accent: "#F2B33D",
    rtp: "99%",
    maxWin: "99×",
  },
  {
    slug: "hi-lo",
    name: "Hi-Lo",
    tagline: "Higher or lower, card by card",
    blurb: "Call whether the next card beats the last. Chain correct calls and cash out before the deck turns on you.",
    photo: "cards",
    accent: "#7FB6FF",
    rtp: "97%",
    maxWin: "Unlimited",
  },
];

export const LOBBY_EXTRAS: { title: string; photo: PhotoKey }[] = [
  { title: "Table games", photo: "roulette" },
  { title: "Poker nights", photo: "poker" },
  { title: "Slots floor", photo: "slots" },
];

export function gameBySlug(slug: string) {
  return CASINO_GAMES.find((game) => game.slug === slug);
}

/** Uniform float in [0, 1) from the browser's CSPRNG. */
export function random() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

export function randomInt(maxExclusive: number) {
  return Math.floor(random() * maxExclusive);
}

// ─── Liftoff ────────────────────────────────────────────────────────────────

const LIFTOFF_EDGE = 0.97;
export const LIFTOFF_CAP = 1000;
/** Growth rate per second: 2× at ~5.8s, 10× at ~19s. */
export const LIFTOFF_RATE = 0.12;

export function liftoffCrashPoint() {
  const u = random();
  const point = Math.floor((LIFTOFF_EDGE / (1 - u)) * 100) / 100;
  return Math.min(LIFTOFF_CAP, Math.max(1, point));
}

export function liftoffMultiplier(elapsedMs: number) {
  return Math.floor(Math.exp((LIFTOFF_RATE * elapsedMs) / 1000) * 100) / 100;
}

// ─── Spot Kick ──────────────────────────────────────────────────────────────

export const SPOT_KICK_STEP = 1.45;
export const SPOT_KICK_ROUNDS = 5;

export function spotKickMultiplier(goals: number) {
  return Math.round(SPOT_KICK_STEP ** goals * 100) / 100;
}

// ─── Dice ───────────────────────────────────────────────────────────────────

export function dicePayout(target: number, mode: "over" | "under") {
  const chance = mode === "over" ? 100 - target : target;
  return Math.floor((99 / chance) * 10000) / 10000;
}

export function diceRoll() {
  return Math.floor(random() * 10000) / 100;
}

// ─── Hi-Lo ──────────────────────────────────────────────────────────────────

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export type Card = { rank: number; suit: (typeof SUITS)[number] };

export function drawCard(): Card {
  return { rank: randomInt(13), suit: SUITS[randomInt(4)] };
}

/** Ties lose. Returns 0 when the call can't win (e.g. "higher" on a King). */
export function hiLoStep(rank: number, call: "higher" | "lower") {
  const wins = call === "higher" ? 12 - rank : rank;
  if (wins <= 0) return 0;
  return Math.floor((0.97 / (wins / 13)) * 100) / 100;
}
