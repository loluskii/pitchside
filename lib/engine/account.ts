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
        sportName: price.fixture.sport.key === "football" ? "Football" : "Basketball",
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
