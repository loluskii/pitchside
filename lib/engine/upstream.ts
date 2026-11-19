// Answers requests addressed to the engine's service hosts.
// Same paths and payload shapes the app's API layer already speaks, so the
// UI, proxies and normalisers run unchanged.

import * as account from "./account";
import {
  categories,
  fixtureById,
  liveCounter,
  liveFixtures,
  listMarketMeta,
  marketGroups,
  priceFixture,
  rawFixture,
  search,
  sportsMenu,
  topTournaments,
  tournaments,
  upcomingFixtures,
} from "./feed";
import { matchState } from "./model";
import { getLeague } from "./catalog";

export const ENGINE_ORIGIN = "https://engine.pitchside.internal";

const ok = (data: unknown, extra: Record<string, unknown> = {}) => ({
  status_code: 200,
  status_description: "Success",
  status: true,
  success: true,
  data,
  ...extra,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function dayBounds(value: string | null, end = false) {
  if (!value) return undefined;
  const date = new Date(/T/.test(value) ? value : `${value.replace(" ", "T")}${value.length <= 10 ? (end ? "T23:59:59" : "T00:00:00") : ""}`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function fixturesEnvelope(list: ReturnType<typeof upcomingFixtures>, now: number, sportId?: string | number) {
  return ok({ fixtures: list.map((f) => rawFixture(f, now)), markets: listMarketMeta(sportId) });
}

function paginate<T>(items: T[], params: URLSearchParams, fallback = 20) {
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const perPage = Math.max(1, Number(params.get("per_page") ?? params.get("perPage") ?? fallback));
  return items.slice((page - 1) * perPage, page * perPage);
}

async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body || typeof init.body !== "string") return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

/** Fixture feed: sports, competitions, fixtures, markets. */
function fixtures(path: string, params: URLSearchParams, now: number): unknown {
  let m: RegExpMatchArray | null;

  if ((m = path.match(/^\/\d+\/sports$/))) return ok(sportsMenu(now));
  if (path === "/live/counter") return ok(liveCounter(now));
  if ((m = path.match(/^\/\d+\/top_tournament$/))) return ok(topTournaments());
  if ((m = path.match(/^\/\d+\/categories\/(\d+)$/))) return ok(categories(now, m[1]));
  if ((m = path.match(/^\/\d+\/tournaments\/(\d+)$/))) return ok(tournaments(now, m[1], params.get("category_id") ?? undefined));
  if ((m = path.match(/^\/\d+\/markets\/groups$/))) return ok(marketGroups(params.get("sport_id") ?? "1"));

  if ((m = path.match(/^\/v1\/\d+\/fixtures\/live\/(\d+)$/))) {
    const list = liveFixtures(now, m[1]);
    return fixturesEnvelope(paginate(list, params, 50), now, m[1]);
  }

  if ((m = path.match(/^\/v1\/\d+\/fixtures\/highlights\/(\d+)$/))) {
    const sportId = m[1];
    const hours = Number(params.get("hours") ?? 0);
    let from = dayBounds(params.get("start"));
    let to = dayBounds(params.get("end"), true);
    if (params.get("today") === "1") {
      const end = new Date(now);
      end.setUTCHours(23, 59, 59, 0);
      to = Math.max(end.getTime(), now + 6 * 3600_000);
    }
    if (hours > 0) to = now + hours * 3600_000;
    if (from && from < now) from = undefined;
    const list = upcomingFixtures(now, {
      sportId,
      leagueId: params.get("tournament_id") ?? undefined,
      categoryId: params.get("category_id") ?? undefined,
      from,
      to,
    }).sort((a, b) => b.league.priority - a.league.priority || a.kickoff - b.kickoff);
    const byTime = list.sort((a, b) => a.kickoff - b.kickoff);
    return fixturesEnvelope(paginate(byTime, params, 15), now, sportId);
  }

  if ((m = path.match(/^\/v1\/(?:\d+\/)?fixtures\/(?:tournament|top-tournament)\/(\d+)$/))) {
    const league = getLeague(m[1]);
    const live = liveFixtures(now, league?.sportId).filter((f) => f.league.id === league?.id);
    const next = upcomingFixtures(now, { leagueId: m[1] }).slice(0, 12);
    return fixturesEnvelope([...live, ...next], now, league?.sportId);
  }

  if ((m = path.match(/^\/\d+\/game\/(\d+)$/))) {
    const fixture = fixtureById(m[1]);
    if (!fixture) return { status_code: 404, status_description: "Fixture not found", data: null };
    return ok(rawFixture(fixture, now, { allMarkets: true }));
  }

  if (path === "/search") {
    const results = search(now, params.get("search") ?? "");
    return ok({ fixtures: results.map((f) => rawFixture(f, now)), markets: listMarketMeta() });
  }

  if (path === "/odd/status") return null; // handled with the body in POST

  if (/custombet/.test(path)) return { status_code: 404, status_description: "Build-a-bet is not offered on this fixture." };

  return undefined;
}

async function bets(path: string, params: URLSearchParams, init: RequestInit | undefined): Promise<unknown> {
  const method = (init?.method ?? "GET").toUpperCase();
  let m: RegExpMatchArray | null;

  if (/^\/\d+\/bet$/.test(path) && method === "POST") return account.placeBets(await readBody(init));
  if (/^\/\d+\/bet$/.test(path)) return account.listBets(params);
  if ((m = path.match(/^\/\d+\/codehub\/(\w+)$/))) return account.bookedSlip(m[1]);
  if (/features\/config/.test(path)) return ok({ features: [] });
  if (/acca-bonus|cut-one|flex/.test(path)) return { status_code: 404, status_description: "Not available" };
  if (/cashout/.test(path)) return { status_code: 400, status_description: "Cash out is not available on this ticket." };
  if (/custom-codes|codehub/.test(path)) return ok([]);
  return undefined;
}

async function platform(path: string, params: URLSearchParams, init: RequestInit | undefined): Promise<unknown> {
  const method = (init?.method ?? "GET").toUpperCase();

  if (path.startsWith("/auth/login") || path.startsWith("/auth/register")) {
    const body = await readBody(init);
    const username = String(body.username ?? body.phoneNumber ?? body.phone ?? "player").replace(/\D/g, "") || "player";
    const token = account.signIn(username);
    return ok({ token, user: account.profile() }, { token, message: "Login successful" });
  }
  if (path.startsWith("/auth/details")) {
    const user = account.profile();
    return user ? ok(user) : { status_code: 401, status: false, message: "Not signed in" };
  }
  if (path.startsWith("/auth/update/details")) {
    account.updateProfile(await readBody(init));
    return ok(account.profile(), { message: "Profile updated" });
  }
  if (path.startsWith("/auth/verify-username")) return ok({}, { responseMessage: "FAILED", success: false, status: false });
  if (path.startsWith("/auth/globalvariables")) {
    return ok({ min_stake: 50, max_stake: 1_000_000, max_winning: 50_000_000, currency: "NGN", tax: 0 });
  }
  if (path.startsWith("/notification/user")) return ok([]);
  if (path.startsWith("/notification/")) return ok({}, { message: "Code sent" });
  if (path.startsWith("/user/wallet/transactions")) return account.transactions();
  if (path.startsWith("/user/wallet/initiate-deposit")) {
    const body = await readBody(init);
    return account.deposit(Number(body.amount ?? 0));
  }
  if (path.startsWith("/user/wallet/withdraw")) {
    const body = await readBody(init);
    return account.withdraw(Number(body.amount ?? 0));
  }
  if (path.startsWith("/user/wallet/list-pending-withdrawal")) return account.withdrawals();
  if (path.startsWith("/user/wallet/")) return ok([]);
  if (path.startsWith("/content-management/banner")) return ok(BANNERS);
  if (path.startsWith("/content-management/page")) return ok({ title: "", content: "" });
  if (path.startsWith("/games/promotions")) return ok([]);
  if (path.startsWith("/bonus/")) return ok([]);
  if (path.startsWith("/referrals/")) return ok([]);
  if (path.startsWith("/crm/")) return ok({});
  if (path.startsWith("/bets/book-bet")) return ok({ share_code: "" });
  if (method !== "GET") return ok({});
  return ok([]);
}

const BANNERS = [
  { title: "Live all day", caption: "Fixtures kick off every hour", image: "/brand/banner-live.svg", link: "/live" },
  { title: "Build your slip", caption: "Prices move in real time", image: "/brand/banner-slip.svg", link: "/sports" },
  { title: "Track every ticket", caption: "Settled the second it ends", image: "/brand/banner-tickets.svg", link: "/my-bets" },
];

/** Returns a Response for engine-hosted URLs, or null for anything else. */
export async function handleEngineRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!href.startsWith(ENGINE_ORIGIN)) return null;
  const effectiveInit: RequestInit | undefined =
    init ?? (typeof input === "object" && "method" in input
      ? { method: input.method, body: input.method !== "GET" ? await input.clone().text() : undefined }
      : undefined);

  const url = new URL(href);
  const [, service, ...rest] = url.pathname.split("/");
  const path = `/${rest.join("/")}`.replace(/\/+$/, "") || "/";
  const now = Date.now();

  let body: unknown;
  if (service === "fixtures") {
    if (path === "/odd/status") {
      const payload = await readBody(effectiveInit);
      const list = Array.isArray(payload) ? payload : (payload.selections as unknown[]) ?? [];
      body = ok(
        (list as Array<Record<string, unknown>>).map((s) => {
          const matchId = String(s.match_id ?? s.matchId ?? s.eventId ?? "");
          const marketId = String(s.market_id ?? s.marketId ?? "");
          const outcomeId = String(s.outcome_id ?? s.outcomeId ?? "");
          const specifier = String(s.specifier ?? "");
          const fixture = fixtureById(matchId);
          const market = fixture
            ? priceFixture(fixture, now).find((mk) => String(mk.marketID) === marketId && mk.specifier === specifier)
            : null;
          const outcome = market?.outcomes.find((o) => String(o.outcomeID) === outcomeId);
          const live = Boolean(outcome && outcome.active);
          return {
            ...s,
            match_id: Number(matchId),
            market_id: Number(marketId),
            outcome_id: outcomeId,
            specifier,
            odds: outcome?.odds ?? 0,
            active: live ? 1 : 0,
            status_name: !outcome ? "Unavailable" : live ? "Active" : "Suspended",
            market_name: market?.marketName ?? "",
            outcome_name: outcome?.outcomeName ?? "",
            display_name: outcome?.displayName ?? "",
          };
        }),
      );
    } else {
      body = fixtures(path, url.searchParams, now);
    }
  } else if (service === "bet") {
    body = await bets(path, url.searchParams, effectiveInit);
  } else if (service === "platform") {
    body = await platform(path, url.searchParams, effectiveInit);
  } else if (service === "casino") {
    body = ok([]);
  }

  if (body === undefined || body === null) return json({ status_code: 404, message: "Not found" }, 404);
  const code = Number((body as { status_code?: number }).status_code ?? 200);
  return json(body, code === 401 ? 401 : 200);
}

export { matchState };
