"use client";

import { useMemo, useState } from "react";
import { DEFAULT_DERIVED_MARKET_CONFIG, X_UP_FEATURE_MARKET_ID } from "@/lib/helpers/early-win";
import { sortHomeOutcomesById } from "@/lib/utils/home-fixtures";
import {
  cleanMarketName,
  getMarketGroupName,
  getMarketLineLabel,
  getMarketSpecifierValue as getSpecifierDisplayValue,
  humanizeMachineValue,
} from "@/lib/utils/market-display-resolver";
import type { RawFixture, RawMarket, RawOutcome } from "@/lib/utils/normalize";
import { chunks } from "@/lib/utils/sports";

const DEFAULT_DERIVED_MARKET_IDS = [1601, 60180];

export type FixtureDetailOutcome = RawOutcome & {
  active?: number | boolean;
  probability?: number;
};

export type FixtureDetailMarket = RawMarket & {
  statusName?: string;
  group?: string;
  groupID?: number | string;
  title?: string;
  lastOddsChangeTime?: number | string;
  marketExtendVOS?: Array<{
    name?: string;
    rootMarketId?: string | number;
    nodeMarketId?: string | number;
    nodeSpecifier?: string;
    notSupport?: boolean;
  }>;
  outcomes: FixtureDetailOutcome[];
};

export type FixtureDetailMarketGroup = {
  id: number | string;
  sportID?: number | string;
  name: string;
  marketIDs: Array<number | string>;
  priority: number;
};

type FixtureDetailLike = RawFixture & {
  derived_market_ids?: Array<number | string>;
  derived_market_id?: number | string | Array<number | string>;
};

type DetailCell = {
  key: string;
  market: FixtureDetailMarket;
  outcome: FixtureDetailOutcome;
};

type DetailRow = {
  key: string;
  label: string | null;
  cells: Array<DetailCell | null>;
};

type DetailLooseRow = {
  key: string;
  cells: DetailCell[];
};

export type FixtureDetailSection = {
  key: string;
  label: string | null;
  rows: DetailRow[];
  columns?: string[];
  displayColumns?: string[];
  totalCols: number;
  leftoverRows?: DetailLooseRow[];
};

export type FixtureDetailLayout = {
  type: "flat" | "matrix";
  sections: FixtureDetailSection[];
};

export type FixtureDetailMarketFamily =
  | "plain"
  | "line-selector"
  | "compound-line-selector"
  | "variant-line"
  | "ordinal";

export type FixtureDisplayMarketGroup = {
  groupKey: string;
  marketID?: number | string;
  marketName?: string;
  specifier?: string;
  family: FixtureDetailMarketFamily;
  headerBadge?: string | null;
  markets: FixtureDetailMarket[];
  layout: FixtureDetailLayout;
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

function escapeRegExp(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRowLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^[0-9x]+$/i.test(text)) return text.toUpperCase();
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getChunks<T>(array: T[]) {
  return array ? chunks(array) : [];
}

function getNumericSortValue(value: unknown) {
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function marketIdMatches(left: unknown, right: unknown) {
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();

  if (!leftText || !rightText) return false;
  if (leftText === rightText) return true;

  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
}

function getTitleInfo(title: unknown) {
  if (!title) return null;
  const parts = String(title)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { specifierLabel: parts[0], columns: parts.slice(1) };
}

function findOutcomeForColumn(outcomes: FixtureDetailOutcome[], column: string) {
  const normalizedColumn = String(column || "").toLowerCase().trim();
  return (
    outcomes.find((outcome) => {
      const displayName = String(outcome.displayName || "").trim();
      const loweredDisplayName = displayName.toLowerCase();

      if (normalizedColumn === "home") return /^1[\s(]|^1$/.test(displayName);
      if (normalizedColumn === "away") return /^2[\s(]|^2$/.test(displayName);
      if (normalizedColumn === "draw") return /^x[\s(]|^x$/i.test(displayName);

      return loweredDisplayName.startsWith(normalizedColumn);
    }) ?? null
  );
}

function getHcpFromDisplayName(displayName: string) {
  const match = String(displayName || "").match(/\(([^)]+)\)/);
  return match ? match[1] : displayName;
}

function getMarketSpecifier(market?: Partial<FixtureDetailMarket> | null) {
  return String(market?.specifier ?? (market as { specifiers?: string } | null)?.specifiers ?? "").trim();
}

function getOutcomeSpecifier(outcome?: Partial<FixtureDetailOutcome> | null) {
  return String(
    outcome?.specifier ?? (outcome as { specifiers?: string } | null)?.specifiers ?? "",
  ).trim();
}

function getMarketIdentityKey(market: FixtureDetailMarket) {
  const variant = String(
    (market as FixtureDetailMarket & {
      variant?: string | number;
    }).variant ?? "",
  ).trim();
  const version = String(
    (market as FixtureDetailMarket & {
      version?: string | number;
    }).version ?? "",
  ).trim();

  return [String(market.marketID ?? ""), getMarketSpecifier(market), variant, version].join("|");
}

function isXupMarketGroup(marketGroup: Pick<FixtureDetailMarket, "marketID">) {
  return Number(marketGroup?.marketID || 0) === X_UP_FEATURE_MARKET_ID;
}

function getXupSortValue(marketGroup: Pick<FixtureDetailMarket, "marketName" | "specifier">) {
  const specifier = String((marketGroup as FixtureDetailMarket & { specifier?: string }).specifier || "");
  const specifierMatch = specifier.match(/xup\s*=\s*(\d+)/i);
  if (specifierMatch) {
    return Number(specifierMatch[1]);
  }

  const marketName = String(marketGroup?.marketName || "");
  const nameMatch = marketName.match(/\b([123])\s*up\b/i);
  return nameMatch ? Number(nameMatch[1]) : Number.MAX_SAFE_INTEGER;
}

function getGroupIdentity(marketGroup: FixtureDetailMarket) {
  const cleanedName = getMarketGroupName(marketGroup);
  if (isXupMarketGroup(marketGroup)) {
    return `${marketGroup.marketID}|${cleanedName}|${getMarketSpecifier(marketGroup) || ""}`;
  }
  return `${marketGroup.marketID}|${cleanedName}`;
}

function getRowLabel(market: FixtureDetailMarket, specifierLabel: string | null) {
  if (specifierLabel?.toLowerCase() === "handicap") {
    const homeOutcome = market.outcomes?.find((outcome) =>
      /^1[\s(]/.test(String(outcome.displayName ?? "")),
    );
    if (homeOutcome) return getHcpFromDisplayName(String(homeOutcome.displayName ?? ""));
  }

  return getMarketLineLabel(market);
}

function getSpecifierType(specifier: unknown) {
  return String(specifier ?? "").split("|")[0].split("=")[0].trim().toLowerCase();
}

function shouldSplitVariantMarketLine(specifier: unknown) {
  return getSpecifierType(specifier) === "variant";
}

function hasCompoundOutcome(market?: FixtureDetailMarket | null) {
  return Boolean(
    market?.outcomes?.some((outcome) =>
      /\sand\s/i.test(String(outcome.displayName ?? outcome.outcomeName ?? "").trim()),
    ),
  );
}

function getMarketFamilyForGroup({
  specifier,
  markets,
}: {
  specifier?: string;
  markets: FixtureDetailMarket[];
}): FixtureDetailMarketFamily {
  const specifierType = getSpecifierType(specifier);
  const firstMarket = markets[0];

  if (specifierType === "variant") return "variant-line";
  if (specifierType === "total" || specifierType === "hcp") {
    return hasCompoundOutcome(firstMarket) ? "compound-line-selector" : "line-selector";
  }
  if (ORDINAL_SPECIFIER_KEYS.has(specifierType)) return "ordinal";

  return "plain";
}

function stripConnectorArtifacts(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\s*(and|or|\/|,|-)\s*/i, "")
    .replace(/\s*(and|or|\/|,|-)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripSpecifierValue(value: unknown, market?: FixtureDetailMarket) {
  const candidates = [
    getSpecifierDisplayValue(getMarketSpecifier(market)),
    market ? getMarketLineLabel(market) : "",
  ].filter(Boolean);

  if (!candidates.length) return String(value ?? "").trim();

  return candidates.reduce(
    (currentValue, candidate) =>
      currentValue
        .replace(new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "gi"), "")
        .replace(/\s+/g, " ")
        .trim(),
    String(value ?? ""),
  );
}

function normalizeAxisValue(value: unknown, market?: FixtureDetailMarket) {
  return stripConnectorArtifacts(stripSpecifierValue(value, market)).toLowerCase();
}

function splitCompoundOutcome(outcome: FixtureDetailOutcome) {
  const displayName = String(outcome.displayName || outcome.outcomeName || "").trim();
  if (!displayName || !/\sand\s/i.test(displayName)) return null;

  const parts = displayName.split(/\sand\s/i).map((part) => stripConnectorArtifacts(part));
  if (parts.length !== 2 || parts.some((part) => !part)) return null;

  return {
    left: normalizeRowLabel(parts[0]),
    right: normalizeRowLabel(parts[1]),
  };
}

function getOrderedUnique(values: string[] = []) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function getTitleTokens(
  titleInfo: { specifierLabel: string; columns: string[] } | null,
  market: FixtureDetailMarket,
) {
  if (!titleInfo) return [];

  return [titleInfo.specifierLabel, ...titleInfo.columns]
    .map((token) => normalizeAxisValue(token, market))
    .filter((token) => token && !["goals", "goal"].includes(token));
}

function scoreAxisAgainstTitle(axisLabels: string[], titleTokens: string[], market: FixtureDetailMarket) {
  return axisLabels.reduce((score, label) => {
    const normalizedLabel = normalizeAxisValue(label, market);
    return score + (titleTokens.includes(normalizedLabel) ? 1 : 0);
  }, 0);
}

function getCompactDisplayColumns(columns: string[], market?: FixtureDetailMarket) {
  return columns.map((column) => {
    const compactLabel = stripConnectorArtifacts(stripSpecifierValue(column, market));
    return compactLabel || column;
  });
}

function createCell(market: FixtureDetailMarket, outcome: FixtureDetailOutcome): DetailCell {
  return {
    key: `${getMarketIdentityKey(market)}|${outcome.outcomeID}`,
    market,
    outcome,
  };
}

function buildFlatRows(outcomes: FixtureDetailOutcome[], market: FixtureDetailMarket): DetailLooseRow[] {
  return getChunks(sortHomeOutcomesById(outcomes)).map((chunk, index) => ({
    key: `${getMarketIdentityKey(market)}|row-${index}`,
    cells: chunk.map((outcome) => createCell(market, outcome)),
  }));
}

function sortSections(sections: FixtureDetailSection[] = []) {
  return [...sections].sort((left, right) => {
    const leftValue = getNumericSortValue(left.label);
    const rightValue = getNumericSortValue(right.label);

    if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
      return leftValue - rightValue;
    }

    if (left.label == null && right.label != null) return -1;
    if (left.label != null && right.label == null) return 1;

    return String(left.label || "").localeCompare(String(right.label || ""));
  });
}

function buildFlatLayout(marketGroup: { marketID?: number | string; markets: FixtureDetailMarket[] }) {
  const sections: FixtureDetailSection[] =
    marketGroup.markets.length > 1 && getMarketSpecifier(marketGroup.markets[0]) !== ""
      ? sortSections(
          marketGroup.markets.map((market) => {
            const rows = buildFlatRows(market.outcomes, market);

            return {
              key: getMarketIdentityKey(market),
              label: getMarketLineLabel(market),
              rows: rows.map((row) => ({
                key: row.key,
                label: null,
                cells: row.cells,
              })),
              totalCols: Math.max(...rows.map((row) => row.cells.length), 0),
            };
          }),
        )
      : [
          {
            key: `${marketGroup.marketID}|flat`,
            label: null,
            rows: buildFlatRows(marketGroup.markets[0].outcomes, marketGroup.markets[0]).map((row) => ({
              key: row.key,
              label: null,
              cells: row.cells,
            })),
            totalCols: Math.max(
              ...buildFlatRows(marketGroup.markets[0].outcomes, marketGroup.markets[0]).map(
                (row) => row.cells.length,
              ),
              0,
            ),
          },
        ];

  return {
    type: "flat" as const,
    sections,
  };
}

function buildCompoundMatrixLayout(marketGroup: { markets: FixtureDetailMarket[] }) {
  const titleInfo = getTitleInfo(marketGroup.markets[0]?.title);
  const sections = marketGroup.markets.map<FixtureDetailSection | null>((market) => {
    const parsedOutcomes = market.outcomes.map((outcome) => ({
      market,
      outcome,
      extracted: splitCompoundOutcome(outcome),
    }));

    const matrixCandidates = parsedOutcomes.filter((item) => item.extracted);
    const leftovers = parsedOutcomes.filter((item) => !item.extracted).map((item) => item.outcome);

    if (matrixCandidates.length < 4) {
      return null;
    }

    const extractedCandidates = matrixCandidates as Array<{
      market: FixtureDetailMarket;
      outcome: FixtureDetailOutcome;
      extracted: { left: string; right: string };
    }>;

    const leftLabels = getOrderedUnique(extractedCandidates.map((item) => item.extracted.left));
    const rightLabels = getOrderedUnique(extractedCandidates.map((item) => item.extracted.right));

    if (leftLabels.length < 2 || rightLabels.length < 2) {
      return null;
    }

    const titleTokens = getTitleTokens(titleInfo, market);
    const leftScore = scoreAxisAgainstTitle(leftLabels, titleTokens, market);
    const rightScore = scoreAxisAgainstTitle(rightLabels, titleTokens, market);

    let rowLabels = leftLabels;
    let columns = rightLabels;

    if (leftScore > rightScore) {
      rowLabels = rightLabels;
      columns = leftLabels;
    } else if (leftScore === rightScore && leftLabels.length < rightLabels.length) {
      rowLabels = rightLabels;
      columns = leftLabels;
    }

    const totalSlots = rowLabels.length * columns.length;
    if (totalSlots < 4 || matrixCandidates.length / totalSlots < 0.5) {
      return null;
    }

    return {
      key: getMarketIdentityKey(market),
      label: getMarketLineLabel(market),
      columns,
      displayColumns: getCompactDisplayColumns(columns, market),
      totalCols: columns.length + 1,
      rows: rowLabels.map((rowLabel) => ({
        key: `${getMarketIdentityKey(market)}|${rowLabel}`,
        label: rowLabel,
        cells: columns.map((column) => {
          const match = extractedCandidates.find(
            (item) =>
              (item.extracted.left === rowLabel && item.extracted.right === column) ||
              (item.extracted.right === rowLabel && item.extracted.left === column),
          );

          return match ? createCell(market, match.outcome) : null;
        }),
      })),
      leftoverRows: leftovers.length ? buildFlatRows(leftovers, market) : [],
    };
  });

  if (sections.some((section) => !section)) {
    return null;
  }

  return {
    type: "matrix" as const,
    sections: sortSections(sections as FixtureDetailSection[]),
  };
}

function buildTitleMatrixLayout(marketGroup: { marketID?: number | string; markets: FixtureDetailMarket[] }) {
  if (marketGroup.markets.length < 2) return null;

  const titleInfo = getTitleInfo(marketGroup.markets[0]?.title);
  if (!titleInfo || titleInfo.columns.length === 0) return null;

  const buildSection = ({
    key,
    label,
    outcomesForMarket,
  }: {
    key: string;
    label: string | null;
    outcomesForMarket: (market: FixtureDetailMarket) => FixtureDetailOutcome[];
  }): FixtureDetailSection | null => {
    const sampleMarket = marketGroup.markets.find((market) => outcomesForMarket(market).length > 0);
    if (!sampleMarket) return null;

    const sampleOutcomes = outcomesForMarket(sampleMarket);
    let specifierLabel: string | null = titleInfo.specifierLabel;
    let candidateColumns = titleInfo.columns;

    if (findOutcomeForColumn(sampleOutcomes, specifierLabel) !== null) {
      specifierLabel = null;
      candidateColumns = [titleInfo.specifierLabel, ...titleInfo.columns];
    }

    const columns = candidateColumns.filter(
      (column) => findOutcomeForColumn(sampleOutcomes, column) !== null,
    );

    if (columns.length < 2) return null;

    return {
      key,
      label,
      columns,
      totalCols: columns.length + (specifierLabel !== null ? 1 : 0),
      rows: marketGroup.markets.map((market) => {
        const marketOutcomes = outcomesForMarket(market);

        return {
          key: `${key}|${getMarketIdentityKey(market)}`,
          label: specifierLabel !== null ? getRowLabel(market, specifierLabel) : null,
          cells: columns.map((column) => {
            const outcome = findOutcomeForColumn(marketOutcomes, column);
            return outcome ? createCell(market, outcome) : null;
          }),
        };
      }),
    };
  };

  const outcomeSpecifierLists = marketGroup.markets.map((market) =>
    getOrderedUnique(market.outcomes.map((outcome) => getOutcomeSpecifier(outcome)).filter(Boolean)),
  );
  const sharedOutcomeSpecifiers =
    outcomeSpecifierLists.length > 1 && outcomeSpecifierLists.every((specifiers) => specifiers.length > 1)
      ? outcomeSpecifierLists.reduce(
          (shared, specifiers) => shared.filter((specifier) => specifiers.includes(specifier)),
          outcomeSpecifierLists[0] ?? [],
        )
      : [];

  if (sharedOutcomeSpecifiers.length > 1) {
    const sections = sortSections(
      sharedOutcomeSpecifiers
        .map((specifier) =>
          buildSection({
            key: `${marketGroup.marketID}|matrix|${specifier}`,
            label: getSpecifierDisplayValue(specifier) || humanizeMachineValue(specifier),
            outcomesForMarket: (market) =>
              market.outcomes.filter((outcome) => getOutcomeSpecifier(outcome) === specifier),
          }),
        )
        .filter((section): section is FixtureDetailSection => Boolean(section)),
    );

    if (sections.length > 1) {
      return {
        type: "matrix" as const,
        sections,
      };
    }
  }

  const defaultSection = buildSection({
    key: `${marketGroup.marketID}|matrix`,
    label: null,
    outcomesForMarket: (market) => market.outcomes,
  });

  if (!defaultSection) return null;

  return {
    type: "matrix" as const,
    sections: [defaultSection],
  };
}

function buildMarketLayout(marketGroup: { marketID?: number | string; markets: FixtureDetailMarket[] }) {
  if (!marketGroup.markets?.length) {
    return {
      type: "flat" as const,
      sections: [],
    };
  }

  const compoundLayout = buildCompoundMatrixLayout(marketGroup);
  if (compoundLayout) return compoundLayout;

  const titleMatrixLayout = buildTitleMatrixLayout(marketGroup);
  if (titleMatrixLayout) return titleMatrixLayout;

  return buildFlatLayout(marketGroup);
}

function groupByMarketID(markets: FixtureDetailMarket[]) {
  const groupedMarkets: Record<
    string,
    {
      groupKey: string;
      marketID?: number | string;
      marketName?: string;
      specifier?: string;
      family: FixtureDetailMarketFamily;
      headerBadge?: string | null;
      markets: FixtureDetailMarket[];
    }
  > = {};

  markets.forEach((market) => {
    const normalizedMarket = {
      ...market,
      outcomes: sortHomeOutcomesById(market.outcomes ?? []),
    };
    const { marketID } = market;
    const specifier = getMarketSpecifier(normalizedMarket);
    const cleanedName = getMarketGroupName(normalizedMarket);
    const lineLabel = shouldSplitVariantMarketLine(specifier) ? getMarketLineLabel(normalizedMarket) : "";
    const key = getGroupIdentity(normalizedMarket);
    const identityKey = getMarketIdentityKey(normalizedMarket);

    if (!groupedMarkets[key]) {
      groupedMarkets[key] = {
        groupKey: key,
        marketID,
        marketName: cleanedName,
        specifier,
        family: getMarketFamilyForGroup({ specifier, markets: [normalizedMarket] }),
        headerBadge: lineLabel || null,
        markets: [normalizedMarket],
      };
      return;
    }

    const existingIndex = groupedMarkets[key].markets.findIndex(
      (item) => getMarketIdentityKey(item) === identityKey,
    );

    if (existingIndex === -1) {
      groupedMarkets[key].markets.push(normalizedMarket);
      return;
    }

    groupedMarkets[key].markets[existingIndex] = normalizedMarket;
  });

  return Object.values(groupedMarkets).map((group) => ({
    ...group,
    family: getMarketFamilyForGroup(group),
    layout: buildMarketLayout(group),
  }));
}

function prioritizeDerivedMarkets(groups: FixtureDisplayMarketGroup[], ids: number[] = []) {
  if (!Array.isArray(groups) || groups.length < 3 || !Array.isArray(ids) || ids.length === 0) {
    return groups;
  }

  const derivedSet = new Set(ids.map(Number));
  const baseGroup = groups.find((group) => !derivedSet.has(Number(group.marketID))) || groups[0];
  const xupGroups: Array<FixtureDisplayMarketGroup & { __groupIndex?: number }> = [];
  const derivedGroups: Array<FixtureDisplayMarketGroup & { __groupIndex?: number }> = [];
  const remainingGroups: Array<FixtureDisplayMarketGroup & { __groupIndex?: number }> = [];

  groups.forEach((group, index) => {
    if (group === baseGroup) return;
    if (derivedSet.has(Number(group.marketID))) {
      const taggedGroup = { ...group, __groupIndex: index };
      if (isXupMarketGroup(group)) {
        xupGroups.push(taggedGroup);
      } else {
        derivedGroups.push(taggedGroup);
      }
    } else {
      remainingGroups.push({ ...group, __groupIndex: index });
    }
  });

  const orderedXupGroups = xupGroups
    .slice()
    .sort(
      (left, right) =>
        getXupSortValue(left) - getXupSortValue(right) ||
        Number(left.__groupIndex || 0) - Number(right.__groupIndex || 0),
    );

  const orderedDerivedGroups = ids
    .filter((id) => Number(id) !== Number(X_UP_FEATURE_MARKET_ID))
    .flatMap((id) =>
      derivedGroups
        .filter((group) => Number(group.marketID) === Number(id))
        .sort((left, right) => Number(left.__groupIndex || 0) - Number(right.__groupIndex || 0)),
    );

  return [
    baseGroup,
    ...orderedXupGroups.map((group) => {
      const nextGroup = { ...group };
      delete nextGroup.__groupIndex;
      return nextGroup;
    }),
    ...orderedDerivedGroups.map((group) => {
      const nextGroup = { ...group };
      delete nextGroup.__groupIndex;
      return nextGroup;
    }),
    ...remainingGroups
      .sort((left, right) => Number(left.__groupIndex || 0) - Number(right.__groupIndex || 0))
      .map((group) => {
        const nextGroup = { ...group };
        delete nextGroup.__groupIndex;
        return nextGroup;
      }),
  ];
}

export function useFixtureDetailMarkets({
  eventMarkets,
  marketGroups,
  fixtureDetail,
}: {
  eventMarkets: FixtureDetailMarket[];
  marketGroups: FixtureDetailMarketGroup[];
  fixtureDetail?: FixtureDetailLike | null;
}) {
  const fixtureKey = String(fixtureDetail?.matchID ?? "");
  const [selectedGroupState, setSelectedGroupState] = useState<{
    fixtureKey: string;
    value: string | number | null;
  }>({ fixtureKey, value: null });
  const [activeSectionState, setActiveSectionState] = useState<{
    fixtureKey: string;
    value: Record<string, string>;
  }>({ fixtureKey, value: {} });
  const selectedGroupId =
    selectedGroupState.fixtureKey === fixtureKey ? selectedGroupState.value : null;
  const activeSectionByGroup =
    activeSectionState.fixtureKey === fixtureKey ? activeSectionState.value : {};
  const setSelectedGroupId = (value: string | number | null) => {
    setSelectedGroupState({ fixtureKey, value });
  };

  const derivedMarketIds = useMemo(() => {
    const derived = fixtureDetail?.derived_market_ids ?? fixtureDetail?.derived_market_id;
    const normalizedDerived = Array.isArray(derived) ? derived : derived != null ? [derived] : null;

    if (!normalizedDerived) {
      return DEFAULT_DERIVED_MARKET_IDS;
    }

    const ids = normalizedDerived
      .map(Number)
      .filter((id) => Number.isFinite(id));

    return ids.length
      ? ids
      : [
          ...DEFAULT_DERIVED_MARKET_IDS,
          ...Object.values(DEFAULT_DERIVED_MARKET_CONFIG)
            .flatMap((config) => config.modes)
            .map((mode) => Number(mode.id)),
        ];
  }, [fixtureDetail?.derived_market_id, fixtureDetail?.derived_market_ids]);

  const groupedMarketsByTab = useMemo(() => {
    if (!eventMarkets.length || !marketGroups.length) {
      return {} as Record<string, { id: number | string; name: string; markets: FixtureDetailMarket[]; marketIDs: Array<number | string>; priority: number }>;
    }

    const grouped: Record<string, { id: number | string; name: string; markets: FixtureDetailMarket[]; marketIDs: Array<number | string>; priority: number }> = {};

    marketGroups.forEach((group) => {
      grouped[String(group.id)] = {
        ...group,
        markets: [],
      };
    });

    eventMarkets.forEach((market) => {
      marketGroups.forEach((group) => {
        if (!group.marketIDs.some((marketID) => marketIdMatches(marketID, market.marketID))) return;

        const key = String(group.id);
        if (!grouped[key]) {
          grouped[key] = {
            ...group,
            markets: [],
          };
        }

        grouped[key].markets.push(market);
      });
    });

    return grouped;
  }, [eventMarkets, marketGroups]);

  const filteredMarkets = useMemo(() => {
    if (!eventMarkets.length) return [];
    if (selectedGroupId === null) return eventMarkets;
    return groupedMarketsByTab[String(selectedGroupId)]?.markets ?? [];
  }, [eventMarkets, groupedMarketsByTab, selectedGroupId]);

  const displayGroupedMarkets = useMemo(
    () => prioritizeDerivedMarkets(groupByMarketID(filteredMarkets), derivedMarketIds),
    [derivedMarketIds, filteredMarkets],
  );

  const sortedMarketGroups = useMemo(
    () => [...marketGroups].sort((left, right) => right.priority - left.priority),
    [marketGroups],
  );

  const hasNoMarketsInSelectedGroup = useMemo(() => {
    if (selectedGroupId === null) return false;
    const group = marketGroups.find((item) => String(item.id) === String(selectedGroupId));
    if (!group) return false;
    return group.marketIDs.length === 0 || (group.marketIDs.length === 1 && Number(group.marketIDs[0]) === 0);
  }, [marketGroups, selectedGroupId]);

  const getGroupKey = (marketGroup: FixtureDisplayMarketGroup) => marketGroup.groupKey;

  const getSectionOptions = (marketGroup: FixtureDisplayMarketGroup) => marketGroup.layout.sections ?? [];

  const getActiveSection = (marketGroup: FixtureDisplayMarketGroup) => {
    const options = getSectionOptions(marketGroup);
    if (!options.length) return null;

    const groupKey = getGroupKey(marketGroup);
    const selectedKey = activeSectionByGroup[groupKey];
    return options.find((section) => section.key === selectedKey) ?? options[0];
  };

  const setActiveSection = (marketGroup: FixtureDisplayMarketGroup, sectionKey: string) => {
    const groupKey = getGroupKey(marketGroup);
    setActiveSectionState((current) => ({
      fixtureKey,
      value: {
        ...(current.fixtureKey === fixtureKey ? current.value : {}),
        [groupKey]: sectionKey,
      },
    }));
  };

  const hasSectionTabs = (marketGroup: FixtureDisplayMarketGroup) => getSectionOptions(marketGroup).length > 1;

  return {
    selectedGroupId,
    setSelectedGroupId,
    displayGroupedMarkets,
    sortedMarketGroups,
    hasNoMarketsInSelectedGroup,
    cleanMarketName,
    getSpecifierDisplayValue,
    getActiveSection,
    setActiveSection,
    hasSectionTabs,
  };
}
