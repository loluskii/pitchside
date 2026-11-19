export type MarketDisplayOutcome = {
  outcomeID?: unknown;
  outcomeName?: unknown;
  displayName?: unknown;
};

export type MarketDisplayInput = {
  marketID?: unknown;
  marketName?: unknown;
  specifier?: unknown;
  variant?: unknown;
  outcomes?: MarketDisplayOutcome[];
};

export type MarketSpecifierEntry = {
  key: string;
  value: string;
};

const ORDINAL_SPECIFIER_KEYS = new Set([
  "goalnr",
  "setnr",
  "periodnr",
  "quarternr",
  "inningnr",
  "mapnr",
  "gamenr",
  "framenr",
  "legnr",
  "roundnr",
]);

const SPECIFIER_PRIORITY = [
  "variant",
  "total",
  "hcp",
  "goalnr",
  "setnr",
  "periodnr",
  "quarternr",
  "inningnr",
  "mapnr",
  "gamenr",
  "framenr",
  "legnr",
  "roundnr",
  "player",
];

function getMarketSpecifier(market: MarketDisplayInput) {
  return String(market.specifier ?? "").trim();
}

export function getMarketDisplayName(market: MarketDisplayInput) {
  return String(market.marketName ?? "").trim();
}

export function parseMarketSpecifiers(specifier: unknown): MarketSpecifierEntry[] {
  return String(specifier ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return { key: "", value: part };

      return {
        key: part.slice(0, separator).trim().toLowerCase(),
        value: part.slice(separator + 1).trim(),
      };
    })
    .filter((entry) => entry.value);
}

function getSpecifierMap(specifier: unknown) {
  return Object.fromEntries(
    parseMarketSpecifiers(specifier)
      .filter((entry) => entry.key)
      .map((entry) => [entry.key, entry.value]),
  );
}

function isMachineIdentifier(value: string) {
  return /^sr:[^\s|,&}]+/i.test(value.trim());
}

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humanizeMachineValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || isMachineIdentifier(text)) return "";

  if (
    /^[+-]?\d+(\.\d+)?$/.test(text) ||
    /^[+-]?\d+(\.\d+)?\+$/.test(text) ||
    /^[+-]?\d+(\.\d+)?(:[+-]?\d+(\.\d+)?)+$/.test(text)
  ) {
    return text;
  }

  if (/^[a-z0-9]+([_-][a-z0-9]+)*$/i.test(text)) {
    return capitalizeWords(text.replace(/[_-]+/g, " "));
  }

  return text;
}

export function toOrdinal(value: unknown) {
  const numeric = Number.parseInt(String(value), 10);
  if (Number.isNaN(numeric)) return String(value);

  const normalized = numeric % 100;
  const suffix =
    normalized >= 11 && normalized <= 13
      ? "th"
      : ["th", "st", "nd", "rd", "th"][Math.min(numeric % 10, 4)];

  return `${numeric}${suffix}`;
}

function getPlayerDisplayName(market: MarketDisplayInput) {
  if (!getSpecifierMap(getMarketSpecifier(market)).player) return "";

  for (const outcome of market.outcomes ?? []) {
    const name = String(outcome.displayName ?? outcome.outcomeName ?? "").trim();
    if (!name) continue;

    const playerName = name.split(/\s+and\s+/i)[0].trim();
    if (playerName && !/^(yes|no|home|away|draw|[12x])$/i.test(playerName)) {
      return playerName;
    }
  }

  return "";
}

export function getOutcomeDisplayLabel(
  _market: MarketDisplayInput,
  outcome: MarketDisplayOutcome,
) {
  return String(outcome.displayName ?? outcome.outcomeName ?? outcome.outcomeID ?? "").trim();
}

function formatSpecifierValue(key: string, value: string, market: MarketDisplayInput) {
  if (key === "player") return getPlayerDisplayName(market);
  if (key === "total" || key === "hcp") return value;
  if (ORDINAL_SPECIFIER_KEYS.has(key)) return toOrdinal(value);
  if (key === "variant") return humanizeMachineValue(value);
  return humanizeMachineValue(value);
}

export function getMarketLineLabel(market: MarketDisplayInput) {
  const entries = parseMarketSpecifiers(getMarketSpecifier(market));

  if (!entries.length) return humanizeMachineValue(market.variant);

  const rangeStart = entries.find((entry) => entry.key === "from")?.value;
  const rangeEnd = entries.find((entry) => entry.key === "to")?.value;
  const labels = SPECIFIER_PRIORITY
    .map((key) => entries.find((entry) => entry.key === key))
    .filter((entry): entry is MarketSpecifierEntry => Boolean(entry))
    .map((entry) => formatSpecifierValue(entry.key, entry.value, market))
    .filter(Boolean);

  if (rangeStart && rangeEnd) labels.push(`${rangeStart}-${rangeEnd}`);

  if (labels.length) return labels.join(" / ");

  return entries
    .map((entry) => formatSpecifierValue(entry.key, entry.value, market))
    .filter(Boolean)
    .join(" / ");
}

function replaceTemplateValue(
  key: string,
  modifier: string,
  specifierMap: Record<string, string>,
  market: MarketDisplayInput,
) {
  const value = specifierMap[key];
  if (!value) return "";
  if (modifier === "!") return toOrdinal(value);
  if (modifier === "%") return getPlayerDisplayName(market);
  if (isMachineIdentifier(value)) return "";
  if (modifier === "+") return /^[+-]/.test(value) ? value : `+${value}`;
  if (modifier === "-") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(-numeric) : "";
  }
  return value;
}

function stripDynamicSpecifierPrefix(value: string, specifierMap: Record<string, string>) {
  if (!/[|][a-z0-9_]+=/i.test(value)) return value;

  const ordinal = specifierMap.goalnr ?? specifierMap.cornernr;
  const ordinalLabel = ordinal ? `${toOrdinal(ordinal)} ` : "";
  const spacedMatch = value.match(/^(.+?\s-\s)(?:[^|\s]+(?:\|[^|=\s]+=[^|\s]+)+)(?=\s)/i);
  if (spacedMatch) {
    const suffix = value.slice(spacedMatch[0].length).trimStart();
    return `${spacedMatch[1]}${ordinalLabel}${suffix}`;
  }

  const compactMatch = value.match(/^(?:[^|\s]+(?:\|[^|=\s]+=[^|\s]+)+)(?:st|nd|rd|th)?\s+/i);
  if (!compactMatch) return value;

  const suffix = value.slice(compactMatch[0].length).trimStart();
  return `${ordinalLabel}${suffix}`;
}

function stripMachineIdentifiers(value: string) {
  return value.replace(/\bsr:[^\s|,&}]+/gi, "");
}

export function cleanMarketName(
  name: unknown,
  specifier: unknown,
  market: MarketDisplayInput = {},
) {
  const rawName = String(name ?? market.marketName ?? "").trim();
  if (!rawName) return "Market";

  const specifierMap = getSpecifierMap(specifier);
  let cleaned = stripDynamicSpecifierPrefix(rawName, specifierMap);
  if (/sr:/i.test(cleaned)) {
    cleaned = cleaned.replace(/^.*?(?:st|nd|rd|th)\s+/i, "");
  }

  cleaned = cleaned.replace(/\{([!+%-]?)([a-z0-9_]+)\}/gi, (_, modifier: string, key: string) =>
    replaceTemplateValue(key.toLowerCase(), modifier, specifierMap, market),
  );
  cleaned = stripMachineIdentifiers(cleaned)
    .replace(/^[|=._\-\s]+|[|=._\-\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || "Market";
}

export function getMarketGroupName(market: MarketDisplayInput) {
  const rawName = getMarketDisplayName(market);
  const specifier = getMarketSpecifier(market);
  const cleaned = cleanMarketName(rawName, specifier, market);

  return cleaned
    .replace(/(\s-\s)\d+(?:st|nd|rd|th)\s+/i, "$1")
    .replace(/^\d+(?:st|nd|rd|th)\s+(?=.*goalscorer)/i, "")
    .trim() || "Market";
}

export function getMarketSpecifierValue(specifier: unknown) {
  const entries = parseMarketSpecifiers(specifier);
  const preferred = entries.find((entry) => entry.key === "total" || entry.key === "hcp");
  return preferred?.value || entries[entries.length - 1]?.value || "";
}
