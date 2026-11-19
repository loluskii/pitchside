// Player account, wallet and bet ledger. Lives in the browser (localStorage),
// so every visitor gets their own account with its own play balance.

import { currentPrice, settleSelection } from "./feed";

const KEY = "pitchside-ledger-v1";
const STARTING_BALANCE = 50_000;

type Selection = {
  matchId: number;
  marketId: number;
  outcomeId: string;
  specifier: string;
  odds: number;
  eventName: string;
  marketName: string;
  outcomeName: string;
  sportName: string;
  eventDate: string;
};

type Bet = {
  id: number;
  shareCode: string;
  betType: string;
  stake: number;
  totalOdd: number;
  possibleWin: number;
  created: string;
  selections: Selection[];
  settled?: { status: 0 | 1 | 7; at: string };
};

type Transaction = {
  id: number;
  type: "credit" | "debit";
  subject: string;
  description: string;
  amount: number;
  transactionDate: string;
  status: number;
};

type Ledger = {
  user: null | {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    balance: number;
    createdAt: string;
  };
  bets: Bet[];
  transactions: Transaction[];
  nextId: number;
};

const empty = (): Ledger => ({ user: null, bets: [], transactions: [], nextId: 1000 });
let memory: Ledger | null = null;

function load(): Ledger {
  if (memory) return memory;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    memory = raw ? (JSON.parse(raw) as Ledger) : empty();
  } catch {
    memory = empty();
  }
  return memory;
}

function save(ledger: Ledger) {
  memory = ledger;
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function code(id: number) {
  // Short, unambiguous booking codes (no 0/O or 1/I).
  let n = (Math.imul(id + 7919, 2654435761) >>> 0) ^ Date.now();
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.abs(n) % CODE_ALPHABET.length];
    n = Math.floor(Math.abs(n) / CODE_ALPHABET.length) + i * 131;
  }
  return out;
}

function record(ledger: Ledger, entry: Omit<Transaction, "id" | "transactionDate" | "status">) {
  ledger.transactions.unshift({ ...entry, id: ledger.nextId++, transactionDate: new Date().toISOString(), status: 1 });
}

/** Settles finished bets and pays out winnings. Runs whenever account data is read. */
function settle(ledger: Ledger) {
  const now = Date.now();
  let changed = false;
  for (const bet of ledger.bets) {
    if (bet.settled) continue;
    const results = bet.selections.map((s) => settleSelection(s.matchId, s.marketId, s.specifier, s.outcomeId, now).result);
    if (results.includes("lost")) {
      bet.settled = { status: 0, at: new Date().toISOString() };
    } else if (results.every((r) => r === "won" || r === "void")) {
      const odds = bet.selections.reduce((acc, s, i) => acc * (results[i] === "void" ? 1 : s.odds), 1);
      const allVoid = results.every((r) => r === "void");
      const payout = Math.round(bet.stake * odds * 100) / 100;
      bet.settled = { status: allVoid ? 7 : 1, at: new Date().toISOString() };
      if (ledger.user) {
        ledger.user.balance += payout;
        record(ledger, {
          type: "credit",
          subject: allVoid ? "Bet refund" : "Bet winnings",
          description: `Ticket ${bet.shareCode}`,
          amount: payout,
        });
      }
    } else {
      continue;
    }
    changed = true;
  }
  if (changed) save(ledger);
}

export function profile() {
  const ledger = load();
  settle(ledger);
  const user = ledger.user;
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    mobileNumber: user.username,
    phone: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    availableBalance: Math.round(user.balance * 100) / 100,
    sportBonusBalance: 0,
    casinoBonusBalance: 0,
    virtualBonusBalance: 0,
    trustBalance: 0,
    currency: "NGN",
    kycStatus: "verified",
  };
}

export function signIn(username: string) {
  const ledger = load();
  if (!ledger.user || ledger.user.username !== username) {
    ledger.user = {
      id: ledger.nextId++,
      username,
      firstName: "Pitchside",
      lastName: "Player",
      email: "",
      balance: STARTING_BALANCE,
      createdAt: new Date().toISOString(),
    };
    ledger.bets = [];
    ledger.transactions = [];
    record(ledger, { type: "credit", subject: "Welcome credit", description: "Starting play balance", amount: STARTING_BALANCE });
  }
  save(ledger);
  return `pitchside.${ledger.user.id}.${Date.now().toString(36)}`;
}

export function updateProfile(patch: Record<string, unknown>) {
  const ledger = load();
  if (!ledger.user) return;
  for (const key of ["firstName", "lastName", "email"] as const) {
    if (typeof patch[key] === "string") ledger.user[key] = patch[key] as string;
  }
  save(ledger);
}

type PlacePayload = {
  bets?: Array<{
    betType?: string;
    stake?: number;
    totalStake?: number;
    selections?: Array<{ matchId: number; marketId: number; outcomeId: string; specifier?: string }>;
  }>;
};

export function placeBets(payload: PlacePayload) {
  const ledger = load();
  if (!ledger.user) return { status_code: 401, status_description: "Please log in to place a bet." };
  const now = Date.now();
  const placed: Array<Record<string, unknown>> = [];

  for (const slip of payload.bets ?? []) {
    const stake = Number(slip.totalStake ?? slip.stake ?? 0);
    if (!(stake > 0)) return { status_code: 400, status_description: "Enter a stake." };
    if (stake > ledger.user.balance) return { status_code: 400, status_description: "Insufficient balance." };

    const selections: Selection[] = [];
    for (const s of slip.selections ?? []) {
      const price = currentPrice(s.matchId, s.marketId, s.specifier ?? "", s.outcomeId, now);
      if (!price || !price.active) {
        return { status_code: 400, status_description: "A selection is suspended. Odds will be back shortly." };
      }
      const outcome = price.market.outcomes.find((o) => String(o.outcomeID) === String(s.outcomeId));
      selections.push({
        matchId: Number(s.matchId),
        marketId: Number(s.marketId),
        outcomeId: String(s.outcomeId),
        specifier: s.specifier ?? "",
        odds: Number(price.odds),
        eventName: `${price.fixture.home} - ${price.fixture.away}`,
        marketName: price.market.marketName,
        outcomeName: String(outcome?.outcomeName ?? ""),
        sportName: price.fixture.sport.feedName === "Soccer" ? "Football" : price.fixture.sport.feedName,
        eventDate: new Date(price.fixture.kickoff).toISOString(),
      });
    }
    if (!selections.length) return { status_code: 400, status_description: "Add a selection." };

    const totalOdd = Math.round(selections.reduce((acc, s) => acc * s.odds, 1) * 100) / 100;
    const id = ledger.nextId++;
    const bet: Bet = {
      id,
      shareCode: code(id),
      betType: slip.betType ?? (selections.length > 1 ? "multiple" : "single"),
      stake,
      totalOdd,
      possibleWin: Math.round(stake * totalOdd * 100) / 100,
      created: new Date().toISOString(),
      selections,
    };
    ledger.user.balance -= stake;
    ledger.bets.unshift(bet);
    record(ledger, { type: "debit", subject: "Bet placed", description: `Ticket ${bet.shareCode}`, amount: stake });
    placed.push({ id, share_code: bet.shareCode, possibleWin: bet.possibleWin, totalOdd, stake });
  }

  save(ledger);
  return { status_code: 200, status_description: "Bet placed", data: { bets: placed, share_code: placed[0]?.share_code } };
}

function selectionView(s: Selection, now: number) {
  const { result, state } = settleSelection(s.matchId, s.marketId, s.specifier, s.outcomeId, now);
  const statusDescription = result === "pending" ? "Pending" : result === "won" ? "Won" : result === "lost" ? "Lost" : "Void";
  return {
    id: `${s.matchId}-${s.marketId}-${s.outcomeId}`,
    eventId: s.matchId,
    eventName: s.eventName,
    eventDate: s.eventDate,
    marketId: s.marketId,
    marketName: s.marketName,
    outcomeId: s.outcomeId,
    outcomeName: s.outcomeName,
    specifier: s.specifier,
    odds: s.odds,
    sportName: s.sportName,
    matchStatus: state?.status ?? "",
    eventTime: state && state.phase !== "scheduled" ? state.clock : "",
    score: state && state.phase !== "scheduled" ? `${state.homeScore}:${state.awayScore}` : "",
    status: result === "pending" ? -1 : result === "won" ? 1 : result === "lost" ? 0 : 7,
    statusDescription,
  };
}

export function listBets(params: URLSearchParams) {
  const ledger = load();
  settle(ledger);
  const now = Date.now();
  const wanted = params.getAll("status").map(Number);
  const id = params.get("id");
  const page = Number(params.get("page") ?? 1);
  const perPage = Number(params.get("perPage") ?? 10);

  const rows = ledger.bets
    .filter((bet) => (id ? String(bet.id) === id : true))
    .map((bet) => {
      const status = bet.settled ? bet.settled.status : -1;
      return {
        id: bet.id,
        betType: bet.betType,
        created: bet.created,
        currency: "NGN",
        possibleWin: bet.possibleWin,
        selections: bet.selections.map((s) => selectionView(s, now)),
        shareCode: bet.shareCode,
        source: "web",
        stake: bet.stake,
        status,
        statusDescription: status === -1 ? "Pending" : status === 1 ? "Won" : status === 0 ? "Lost" : "Void",
        totalOdd: bet.totalOdd,
        totalSelections: bet.selections.length,
        username: ledger.user?.username,
      };
    })
    .filter((bet) => (wanted.length ? wanted.includes(bet.status) : true));

  const start = (page - 1) * perPage;
  return {
    status_code: 200,
    status_description: "Success",
    data: {
      count: rows.length,
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(rows.length / perPage)),
      data: rows.slice(start, start + perPage),
    },
  };
}

export function bookedSlip(shareCode: string) {
  const bet = load().bets.find((b) => b.shareCode.toLowerCase() === shareCode.toLowerCase());
  if (!bet) return { status_code: 404, status_description: "Booking code not found." };
  return {
    status_code: 200,
    data: {
      share_code: bet.shareCode,
      selections: bet.selections.map((s) => ({
        matchId: s.matchId,
        eventId: s.matchId,
        marketId: s.marketId,
        outcomeId: s.outcomeId,
        specifier: s.specifier,
        odds: s.odds,
        eventName: s.eventName,
        marketName: s.marketName,
        outcomeName: s.outcomeName,
      })),
    },
  };
}

export function transactions() {
  const ledger = load();
  settle(ledger);
  return { status_code: 200, status: true, data: ledger.transactions };
}

export function signOut() {
  // Accounts persist locally so a returning visitor keeps their history.
}

// ─── Wallet: play-money top-ups and withdrawals ─────────────────────────────

const MAX_BALANCE = 5_000_000;
const WITHDRAW_SETTLE_MS = 45_000;

type Withdrawal = { id: number; amount: number; created: string; reference: string };
type LedgerWithWallet = Ledger & { withdrawals?: Withdrawal[] };

export function deposit(amount: number) {
  const ledger = load() as LedgerWithWallet;
  if (!ledger.user) return { status_code: 401, status_description: "Log in to add funds." };
  const value = Math.round(Number(amount));
  if (!(value >= 100)) return { status_code: 400, status_description: "Minimum top-up is ₦100." };
  if (ledger.user.balance + value > MAX_BALANCE) {
    return { status_code: 400, status_description: "Play balances are capped at ₦5,000,000." };
  }
  ledger.user.balance += value;
  const reference = `TP${Date.now().toString(36).toUpperCase()}`;
  record(ledger, { type: "credit", subject: "Top-up", description: `Instant top-up · ${reference}`, amount: value });
  save(ledger);
  return { status_code: 200, status: true, message: "Funds added", data: { reference, balance: ledger.user.balance } };
}

export function withdraw(amount: number) {
  const ledger = load() as LedgerWithWallet;
  if (!ledger.user) return { status_code: 401, status_description: "Log in to withdraw." };
  const value = Math.round(Number(amount));
  if (!(value >= 500)) return { status_code: 400, status_description: "Minimum withdrawal is ₦500." };
  if (value > ledger.user.balance) return { status_code: 400, status_description: "That's more than your balance." };
  ledger.user.balance -= value;
  const entry: Withdrawal = {
    id: ledger.nextId++,
    amount: value,
    created: new Date().toISOString(),
    reference: `WD${Date.now().toString(36).toUpperCase()}`,
  };
  ledger.withdrawals = [entry, ...(ledger.withdrawals ?? [])].slice(0, 30);
  record(ledger, { type: "debit", subject: "Withdrawal", description: `Payout · ${entry.reference}`, amount: value });
  save(ledger);
  return { status_code: 200, status: true, message: "Withdrawal requested", data: entry };
}

export function withdrawals() {
  const ledger = load() as LedgerWithWallet;
  const now = Date.now();
  return {
    status_code: 200,
    status: true,
    data: (ledger.withdrawals ?? []).map((w) => ({
      ...w,
      status: now - new Date(w.created).getTime() > WITHDRAW_SETTLE_MS ? "Paid" : "Processing",
    })),
  };
}

// ─── Casino ─────────────────────────────────────────────────────────────────

/** Takes a stake for a casino round. Returns the new balance, or an error. */
export function casinoStake(game: string, stake: number) {
  const ledger = load();
  if (!ledger.user) return { ok: false as const, error: "Log in to play." };
  const value = Math.round(Number(stake) * 100) / 100;
  if (!(value >= 50)) return { ok: false as const, error: "Minimum stake is ₦50." };
  if (value > ledger.user.balance) return { ok: false as const, error: "Not enough balance." };
  ledger.user.balance -= value;
  record(ledger, { type: "debit", subject: game, description: "Casino stake", amount: value });
  save(ledger);
  return { ok: true as const, balance: ledger.user.balance };
}

export function casinoPayout(game: string, amount: number) {
  const ledger = load();
  if (!ledger.user || !(amount > 0)) return;
  const value = Math.round(amount * 100) / 100;
  ledger.user.balance += value;
  record(ledger, { type: "credit", subject: game, description: "Casino win", amount: value });
  save(ledger);
}
