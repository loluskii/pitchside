export const queryKeys = {
  user: {
    details: ["user", "details"] as const,
    globalVars: ["user", "globalVars"] as const,
    notifications: ["user", "notifications"] as const,
  },
  content: {
    banners: ["content", "banners"] as const,
    bonusList: ["content", "bonusList"] as const,
    promotions: ["content", "promotions"] as const,
    cms: (slug: string) => ["content", "cms", slug] as const,
  },
  sports: {
    menu: ["sports", "menu"] as const,
    topTournaments: ["sports", "topTournaments"] as const,
    categories: (sportId: number | string, period?: unknown) =>
      ["sports", "categories", sportId, period] as const,
    tournaments: (sportId: number | string, categoryId: number | string, period?: unknown) =>
      ["sports", "tournaments", sportId, categoryId, period] as const,
    fixtures: (tournamentId: number | string, sportId: number | string, period?: string) =>
      ["sports", "fixtures", tournamentId, sportId, period] as const,
    fixturesByCategory: (categoryId: number | string, sportId: number | string) =>
      ["sports", "fixturesByCategory", categoryId, sportId] as const,
    fixtureMarkets: (fixtureId: number | string) =>
      ["sports", "fixtureMarkets", fixtureId] as const,
    customBetMarkets: (fixtureId: number | string) =>
      ["sports", "customBetMarkets", fixtureId] as const,
    marketsGrouping: (sportId: number | string) =>
      ["sports", "marketsGrouping", sportId] as const,
    highlights: (sportId: number | string, page?: number) =>
      ["sports", "highlights", sportId, page] as const,
    highlightsV2: (payload: unknown) => ["sports", "highlightsV2", payload] as const,
    today: (sportId: number | string, page?: number) =>
      ["sports", "today", sportId, page] as const,
    upcoming: (sportId: number | string, period?: unknown) =>
      ["sports", "upcoming", sportId, period] as const,
    live: ["sports", "live"] as const,
    liveCounter: ["sports", "liveCounter"] as const,
    liveCount: (sportId: number | string) => ["sports", "liveCount", sportId] as const,
    search: (q: string) => ["sports", "search", q] as const,
  },
  events: {
    featured: () => ["events", "featured"] as const,
    live: (sportId?: number | string, limit?: number) =>
      ["events", "live", sportId, limit] as const,
    upcoming: (sportId?: number | string, period?: string, limit?: number) =>
      ["events", "upcoming", sportId, period, limit] as const,
  },
  bets: {
    list: (params?: unknown) => ["bets", "list", params] as const,
    detail: (id: string) => ["bets", id] as const,
    codeHub: (params?: unknown) => ["bets", "codeHub", params] as const,
    byCode: (code: string) => ["bets", "byCode", code] as const,
  },
  casino: {
    catalog: ["casino", "catalog"] as const,
    games: (params?: unknown) => ["casino", "games", params] as const,
    providers: ["casino", "providers"] as const,
    categories: ["casino", "categories"] as const,
    gameCategories: (clientId?: number | string) =>
      ["casino", "gameCategories", clientId] as const,
    searchGames: (q: string, params?: unknown) => ["casino", "searchGames", q, params] as const,
    continuePlaying: (userId: string | number, clientId?: number | string) =>
      ["casino", "continuePlaying", userId, clientId] as const,
    byProvider: (providerId?: number | string, categoryId?: number | string) =>
      ["casino", "byProvider", providerId, categoryId] as const,
    jackpots: ["casino", "jackpots"] as const,
    jackpotWinners: ["casino", "jackpotWinners"] as const,
    bonusGames: (userId: string | number) => ["casino", "bonusGames", userId] as const,
  },
  wallet: {
    transactions: (params?: unknown) => ["wallet", "transactions", params] as const,
    pendingWithdrawals: ["wallet", "pendingWithdrawals"] as const,
    bankAssets: ["wallet", "bankAssets"] as const,
    paymentMethods: ["wallet", "paymentMethods"] as const,
    banks: ["wallet", "banks"] as const,
  },
  referrals: {
    dashboard: ["referrals", "dashboard"] as const,
    codes: ["referrals", "codes"] as const,
    friends: (params?: unknown) => ["referrals", "friends", params] as const,
    validate: (code: string) => ["referrals", "validate", code] as const,
  },
  bonuses: {
    list: ["bonuses", "list"] as const,
    active: ["bonuses", "active"] as const,
    cashback: ["bonuses", "cashback"] as const,
    firstDeposit: ["bonuses", "firstDeposit"] as const,
  },
};
