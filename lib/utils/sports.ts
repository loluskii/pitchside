import type { Sport } from "@/types";

// ─── Sport icon helpers ───────────────────────────────────────────────────────

export type SportIconKey =
  | "football"
  | "basketball"
  | "tennis"
  | "table-tennis"
  | "american-football"
  | "ice-hockey"
  | "field-hockey"
  | "volleyball"
  | "baseball"
  | "handball"
  | "badminton"
  | "rugby"
  | "cricket"
  | "boxing"
  | "mma"
  | "snooker"
  | "darts"
  | "esports"
  | "virtuals"
  | "golf"
  | "formula-one"
  | "cycling"
  | "water-polo"
  | "futsal"
  | "generic";

const SPORT_NAME_BY_ID = new Map<string, string>();

const SPORT_ICON_KEY_BY_NAME: Record<string, SportIconKey> = {
  football: "football",
  soccer: "football",
  basketball: "basketball",
  "basketball 3x3": "basketball",
  basketball3x3: "basketball",
  tennis: "tennis",
  squash: "tennis",
  badminton: "badminton",
  volleyball: "volleyball",
  "beach volleyball": "volleyball",
  "beach volley": "volleyball",
  baseball: "baseball",
  boxing: "boxing",
  mma: "mma",
  "mixed martial arts": "mma",
  "mixed martial art": "mma",
  ufc: "mma",
  rugby: "rugby",
  "rugby union": "rugby",
  "rugby league": "rugby",
  cricket: "cricket",
  futsal: "futsal",
  golf: "golf",
  cycling: "cycling",
  "formula 1": "formula-one",
  formula1: "formula-one",
  "motor sport": "formula-one",
  motorsport: "formula-one",
  handball: "handball",
  "table tennis": "table-tennis",
  "american football": "american-football",
  "amer football": "american-football",
  "ice hockey": "ice-hockey",
  hockey: "ice-hockey",
  "field hockey": "field-hockey",
  fieldhockey: "field-hockey",
  snooker: "snooker",
  billiards: "snooker",
  billiard: "snooker",
  pool: "snooker",
  darts: "darts",
  esports: "esports",
  "e sports": "esports",
  "counter strike": "esports",
  "league of legends": "esports",
  dota: "esports",
  esoccer: "esports",
  "e soccer": "esports",
  ebasketball: "esports",
  "e basketball": "esports",
  virtual: "virtuals",
  virtuals: "virtuals",
  "virtual football": "virtuals",
  vfootball: "virtuals",
  "v football": "virtuals",
  waterpolo: "water-polo",
  "water polo": "water-polo",
};

export function normalizeSportIconName(sportName = ""): string {
  return String(sportName)
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SPORT_CODE_BY_KEY: Record<SportIconKey, string> = {
  football: "FOOT",
  basketball: "BASK",
  tennis: "TENN",
  "table-tennis": "TABL",
  "american-football": "AMFO",
  "ice-hockey": "ICEH",
  "field-hockey": "HOCK",
  volleyball: "VOLL",
  baseball: "BASE",
  handball: "HAND",
  badminton: "BADM",
  rugby: "RUGU",
  cricket: "CRIC",
  boxing: "BOXI",
  mma: "MMAF",
  snooker: "SNOO",
  darts: "DART",
  esports: "ESPS",
  virtuals: "VRTS",
  golf: "GOLF",
  "formula-one": "FRM1",
  cycling: "CYCL",
  "water-polo": "WTPL",
  futsal: "FUTS",
  generic: "SPRT",
};

const SPORT_DISPLAY_NAME_BY_KEY: Record<SportIconKey, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "table-tennis": "Table Tennis",
  "american-football": "American Football",
  "ice-hockey": "Ice Hockey",
  "field-hockey": "Field Hockey",
  volleyball: "Volleyball",
  baseball: "Baseball",
  handball: "Handball",
  badminton: "Badminton",
  rugby: "Rugby",
  cricket: "Cricket",
  boxing: "Boxing",
  mma: "MMA",
  snooker: "Snooker",
  darts: "Darts",
  esports: "E-Sports",
  virtuals: "Virtuals",
  golf: "Golf",
  "formula-one": "Formula 1",
  cycling: "Cycling",
  "water-polo": "Water Polo",
  futsal: "Futsal",
  generic: "Sport",
};

export function primeSportsMenuCache(
  sports: Array<Pick<Sport, "id" | "name">>,
) {
  sports.forEach((sport) => {
    const id = String(sport.id ?? "").trim();
    const name = String(sport.name ?? "").trim();

    if (!id || !name) return;
    SPORT_NAME_BY_ID.set(id, name);
  });
}

function resolveSportName(
  value?: string | number,
  sportsMenu?: Array<Pick<Sport, "id" | "name">>,
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;

  return (
    sportsMenu?.find((sport) => String(sport.id) === raw)?.name ??
    SPORT_NAME_BY_ID.get(raw) ??
    ""
  );
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveSportNameFromSportsMenu(
  sportsMenu: Array<Pick<Sport, "id" | "name">>,
  value?: string | number,
): string {
  return resolveSportName(value, sportsMenu);
}

export function getSportDisplayName(value?: string | number): string {
  const resolved = resolveSportName(value);
  const normalized = normalizeSportIconName(resolved);
  const iconKey = getSportIconKey(value);

  if (!normalized) return "Sport";
  if (iconKey !== "generic") return SPORT_DISPLAY_NAME_BY_KEY[iconKey];

  return toTitleCase(normalized);
}

export function getSportIconKey(value?: string | number): SportIconKey {
  const normalized = normalizeSportIconName(resolveSportName(value));

  if (!normalized) return "generic";

  if (SPORT_ICON_KEY_BY_NAME[normalized]) {
    return SPORT_ICON_KEY_BY_NAME[normalized];
  }

  if (normalized.includes("virtual")) return "virtuals";
  if (normalized.includes("esport") || normalized.startsWith("e ")) return "esports";
  if (normalized.includes("formula 1") || normalized.includes("motor sport")) return "formula-one";
  if (normalized.includes("cycling")) return "cycling";
  if (normalized.includes("water polo")) return "water-polo";
  if (normalized.includes("table tennis")) return "table-tennis";
  if (normalized.includes("basketball")) return "basketball";
  if (normalized.includes("american football")) return "american-football";
  if (normalized.includes("football")) return "football";
  if (normalized.includes("field hockey")) return "field-hockey";
  if (normalized.includes("hockey")) return "ice-hockey";
  if (normalized.includes("volleyball")) return "volleyball";
  if (normalized.includes("baseball")) return "baseball";
  if (normalized.includes("handball")) return "handball";
  if (normalized.includes("badminton")) return "badminton";
  if (normalized.includes("rugby")) return "rugby";
  if (normalized.includes("cricket")) return "cricket";
  if (normalized.includes("boxing")) return "boxing";
  if (normalized.includes("golf")) return "golf";
  if (normalized.includes("futsal")) return "futsal";
  if (normalized.includes("dart")) return "darts";
  if (normalized.includes("snooker") || normalized.includes("billiard") || normalized.includes("pool")) {
    return "snooker";
  }
  if (normalized.includes("mixed martial") || normalized.includes("ufc")) return "mma";
  if (normalized.includes("mma")) return "mma";
  if (normalized.includes("tennis")) return "tennis";

  return "generic";
}

export function getSportShortCode(value?: string | number): string {
  const iconKey = getSportIconKey(value);
  if (iconKey !== "generic") {
    return SPORT_CODE_BY_KEY[iconKey];
  }

  const normalized = normalizeSportIconName(resolveSportName(value));

  if (!normalized) return "SPRT";

  const compact = normalized.replace(/[^a-z0-9]/g, "").toUpperCase();
  const fallback = compact.slice(0, 4);

  return fallback.padEnd(4, "X");
}

export function getSportSectionWrapperClass(value?: string | number): string {
  return `section-wrapper-${getSportShortCode(value)}`;
}

export function getSportIconClass(sportName = ""): string {
  return `section-wrapper-${getSportShortCode(sportName)}`;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, "_");
}

export function unslugify(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sortArr<T>(arr: T[], field: keyof T): T[] {
  if (!arr?.length) return arr;
  return [...arr].sort((a, b) => Number(a[field]) - Number(b[field]));
}

export function extractIdsFromURL(
  str: string,
  type: "category" | "tournament",
): { categoryID: string }[] | { tournamentID: string }[] {
  return str.split("_").map((part) => {
    const id = part.split(":").at(-1)!;
    return type === "category" ? { categoryID: id } : { tournamentID: id };
  }) as ReturnType<typeof extractIdsFromURL>;
}

export function chunks<T>(arr: T[]): T[][] {
  const size = arr.length % 2 === 0 ? 2 : 3;
  return arr.reduce<T[][]>((result, item, index) => {
    const i = Math.floor(index / size);
    if (!result[i]) result[i] = [];
    result[i].push(item);
    return result;
  }, []);
}

// ─── Image URL helpers (Firebase Storage) ────────────────────────────────────


export function getLeagueLogoUrl(name: string): string {
  return `/badge?kind=league&name=${encodeURIComponent(name.trim())}`;
}

export function getTeamLogoUrl(name: string): string {
  return `/badge?kind=team&name=${encodeURIComponent(name.trim())}`;
}

export function getTeamFallbackLogo(side: "home" | "away") {
  return side === "away" ? "/images/team-fallback-away.png" : "/images/team-fallback-home.png";
}
