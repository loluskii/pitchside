"use client";

import { useState } from "react";
import {
  formatHomeSpecifierValue,
  getMarketSpecifierOptions,
  getOddsColumnWidth,
  getOddsContainerWidth,
  isHomeSelectableSpecifier,
  resolveMarketOutcomes,
} from "@/lib/utils/home-fixtures";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";

type UseFixtureMarketInput = {
  fixture: RawFixture;
  market: RawMarket | null;
  selectedSpecifier?: string;
  specifierOptionsOverride?: ReturnType<typeof getMarketSpecifierOptions>;
};

export function useFixtureMarket({
  fixture,
  market,
  selectedSpecifier,
  specifierOptionsOverride,
}: UseFixtureMarketInput) {
  const specifierOptions = specifierOptionsOverride?.length
    ? specifierOptionsOverride
    : getMarketSpecifierOptions(fixture, market);
  const selectedSpecifierKey = selectedSpecifier ?? "";
  const [localPreferredSpecifier, setLocalPreferredSpecifier] = useState<{
    source: string;
    value: string;
  } | null>(null);
  const preferredSpecifier =
    localPreferredSpecifier?.source === selectedSpecifierKey
      ? localPreferredSpecifier.value
      : selectedSpecifierKey;
  const activeSpecifier = specifierOptions.some((option) => option.specifier === preferredSpecifier)
    ? preferredSpecifier
    : (specifierOptions[0]?.specifier ?? "");
  const marketSpecifier = String(market?.specifier ?? "").trim();
  const formattedMarketSpecifier = formatHomeSpecifierValue(marketSpecifier);
  const fallbackSpecifierLabel =
    formattedMarketSpecifier && formattedMarketSpecifier !== marketSpecifier
      ? formattedMarketSpecifier
      : "";

  const activeSpecifierLabel =
    specifierOptions.find((option) => option.specifier === activeSpecifier)?.value ??
    specifierOptions[0]?.value ??
    fallbackSpecifierLabel;
  const hasSpecifier =
    specifierOptions.length > 0 ||
    Boolean(marketSpecifier && isHomeSelectableSpecifier(marketSpecifier));
  const outcomes = resolveMarketOutcomes(fixture, market, activeSpecifier);

  return {
    activeSpecifier,
    activeSpecifierLabel,
    columnWidth: getOddsColumnWidth(Math.max(outcomes.length, 1), hasSpecifier),
    containerWidth: getOddsContainerWidth(hasSpecifier),
    hasSpecifier,
    outcomes,
    setActiveSpecifier: (specifier: string) =>
      setLocalPreferredSpecifier({ source: selectedSpecifierKey, value: specifier }),
    specifierOptions,
  };
}
