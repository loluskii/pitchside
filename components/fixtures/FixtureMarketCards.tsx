"use client";

import type { ReactNode } from "react";
import { ArrowDown01Icon } from "hugeicons-react";
import { MdPushPin } from "react-icons/md";
import {
  EARLY_WIN_MODE_LABELS,
  getEarlyWinModeFromMarketId,
  stripEarlyWinSuffix,
} from "@/lib/helpers/early-win";
import type {
  FixtureDetailMarket,
  FixtureDetailSection,
  FixtureDisplayMarketGroup,
} from "@/lib/hooks/useFixtureDetailMarkets";
import { getOutcomeDisplayLabel } from "@/lib/utils/market-display-resolver";
import type { RawFixture } from "@/lib/utils/normalize";
import { cn } from "@/lib/utils";
import { OddsButton } from "@/components/betting/OddsButton";

type DetailFixture = RawFixture & {
  tournamentName?: string;
};

type FixtureMarketCardsProps = {
  collapsedMarkets: Record<string, boolean>;
  collapsedStateKey: string;
  detail: DetailFixture;
  displayGroupedMarkets: FixtureDisplayMarketGroup[];
  getActiveSection: (marketGroup: FixtureDisplayMarketGroup) => FixtureDetailSection | null;
  hasSectionTabs: (marketGroup: FixtureDisplayMarketGroup) => boolean;
  onToggleMarket: (accordionKey: string, isCollapsed: boolean) => void;
  renderCell?: (args: {
    defaultLabel: string;
    layout: "centered" | "split";
    market: FixtureDetailMarket;
    outcome: FixtureDetailMarket["outcomes"][number];
  }) => ReactNode;
  selectionType: "prematch" | "live";
  setActiveSection: (marketGroup: FixtureDisplayMarketGroup, sectionKey: string) => void;
};

function getMarketModeLabel(marketId?: string | number, specifier = "") {
  const modeKey = getEarlyWinModeFromMarketId(Number(marketId ?? 0), specifier);
  return modeKey === "base" ? null : EARLY_WIN_MODE_LABELS[modeKey] ?? null;
}

function usesSelectorChips(marketGroup: FixtureDisplayMarketGroup) {
  return (
    marketGroup.family === "line-selector" ||
    marketGroup.family === "compound-line-selector"
  );
}

function formatMarketTitle(value: string) {
  return value
    .split(/(\s+|\/|-|\(|\))/)
    .map((part) => {
      const normalized = part.trim().toLowerCase();

      if (!normalized) return part;
      if (normalized === "1x2") return "1X2";
      if (normalized === "dc") return "DC";
      if (normalized === "btts") return "BTTS";
      if (normalized === "ht") return "HT";
      if (normalized === "ft") return "FT";
      if (/^[a-z]/.test(part)) return part.charAt(0).toUpperCase() + part.slice(1);

      return part;
    })
    .join("");
}

function DefaultMarketCell({
  detail,
  label,
  layout,
  market,
  outcome,
  selectionType,
}: {
  detail: DetailFixture;
  label: string;
  layout: "centered" | "split";
  market: FixtureDetailMarket;
  outcome: FixtureDetailMarket["outcomes"][number];
  selectionType: "prematch" | "live";
}) {
  return (
    <OddsButton
      mode="fixture"
      fixture={detail}
      market={market}
      outcome={outcome}
      selectionType={selectionType}
      label={label}
      layout={layout}
      fluid
      showLockWhenDisabled
    />
  );
}

function SectionRows({
  activeSection,
  detail,
  hasSectionTabs,
  marketGroup,
  renderCell,
  selectionType,
  setActiveSection,
}: {
  activeSection: FixtureDetailSection | null;
  detail: DetailFixture;
  hasSectionTabs: boolean;
  marketGroup: FixtureDisplayMarketGroup;
  renderCell?: FixtureMarketCardsProps["renderCell"];
  selectionType: "prematch" | "live";
  setActiveSection: (marketGroup: FixtureDisplayMarketGroup, sectionKey: string) => void;
}) {
  if (!activeSection) return null;

  const selectorFamily = usesSelectorChips(marketGroup);
  const showInlineSectionLabel =
    !hasSectionTabs && activeSection.label && marketGroup.family !== "variant-line";

  const renderOddsCell = ({
    layout,
    market,
    outcome,
  }: {
    layout: "centered" | "split";
    market: FixtureDetailMarket;
    outcome: FixtureDetailMarket["outcomes"][number];
  }) => {
    const defaultLabel = getOutcomeDisplayLabel(market, outcome);
    return renderCell ? (
      renderCell({ defaultLabel, layout, market, outcome })
    ) : (
      <DefaultMarketCell
        detail={detail}
        label={defaultLabel}
        layout={layout}
        market={market}
        outcome={outcome}
        selectionType={selectionType}
      />
    );
  };

  return (
    <>
      {hasSectionTabs ? (
        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {marketGroup.layout.sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(marketGroup, section.key)}
              className={cn(
                "shrink-0 rounded-full font-bold transition-colors",
                selectorFamily
                  ? "min-w-[54px] px-3 py-1.5 text-base"
                  : "px-3 py-1.5 text-base",
                activeSection.key === section.key
                  ? "bg-[var(--lime)] text-black"
                  : "bg-white/5 text-[var(--text-dim)]",
              )}
            >
              {section.label || "Default"}
            </button>
          ))}
        </div>
      ) : null}

      {marketGroup.layout.type === "matrix" ? (
        <div className="space-y-2">
          {showInlineSectionLabel ? (
            <div className="inline-flex rounded-full bg-white/5 px-3 py-1 text-sm font-bold text-[var(--text-dim)]">
              {activeSection.label}
            </div>
          ) : null}

          {activeSection.columns?.length ? (
            <div
              className="grid gap-2 text-center text-sm font-bold text-[var(--text-dim)]"
              style={{
                gridTemplateColumns: `repeat(${activeSection.totalCols}, minmax(0, 1fr))`,
              }}
            >
              {activeSection.rows[0]?.label !== null ? <span /> : null}
              {(activeSection.displayColumns ?? activeSection.columns).map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
          ) : null}

          {activeSection.rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${activeSection.totalCols}, minmax(0, 1fr))`,
              }}
            >
              {row.label !== null ? (
                <div className="flex min-h-[48px] items-center justify-center rounded-md bg-[rgba(18, 26, 22, 0.05)] px-2 text-center text-base font-bold text-white/75">
                  {row.label}
                </div>
              ) : null}
              {row.cells.map((cell, index) =>
                cell ? (
                  <span key={cell.key}>
                    {renderOddsCell({
                      layout: "centered",
                      market: cell.market,
                      outcome: cell.outcome,
                    })}
                  </span>
                ) : (
                  <div
                    key={`${row.key}-empty-${index}`}
                    className="min-h-[48px] rounded-md border border-dashed border-white/6 bg-white/[0.02]"
                  />
                ),
              )}
            </div>
          ))}

          {activeSection.leftoverRows?.map((row) => (
            <div
              key={row.key}
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))`,
              }}
            >
              {row.cells.map((cell) => (
                <span key={cell.key}>
                  {renderOddsCell({
                    layout: "split",
                    market: cell.market,
                    outcome: cell.outcome,
                  })}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {showInlineSectionLabel ? (
            <div className="inline-flex rounded-full bg-white/5 px-3 py-1 text-sm font-bold text-[var(--text-dim)]">
              {activeSection.label}
            </div>
          ) : null}

          {activeSection.rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))`,
              }}
            >
              {row.cells.map((cell) =>
                cell ? (
                  <span key={cell.key}>
                    {renderOddsCell({
                      layout: "split",
                      market: cell.market,
                      outcome: cell.outcome,
                    })}
                  </span>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function FixtureMarketCards({
  collapsedMarkets,
  collapsedStateKey,
  detail,
  displayGroupedMarkets,
  getActiveSection,
  hasSectionTabs,
  onToggleMarket,
  renderCell,
  selectionType,
  setActiveSection,
}: FixtureMarketCardsProps) {
  return displayGroupedMarkets.map((marketGroup, marketIndex) => {
    const activeSection = getActiveSection(marketGroup);
    const modeLabel = getMarketModeLabel(marketGroup.marketID, marketGroup.specifier);
    const titleLabel = formatMarketTitle(
      modeLabel
        ? stripEarlyWinSuffix(String(marketGroup.marketName ?? "Market"))
        : String(marketGroup.marketName ?? "Market"),
    );
    const accordionKey = marketGroup.groupKey;
    const isCollapsed = collapsedMarkets[accordionKey] ?? marketIndex >= 5;

    return (
      <div
        key={`${collapsedStateKey}-${marketGroup.groupKey}`}
        className="mb-3 overflow-hidden rounded-xl bg-[var(--bg-card)]"
      >
        <button
          type="button"
          onClick={() => onToggleMarket(accordionKey, isCollapsed)}
          className={cn(
            "flex w-full items-center justify-between px-4 py-3 text-left",
            !isCollapsed && "border-b border-white/[0.05]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <ArrowDown01Icon
              size={16}
              color="var(--primary-orange)"
              className={cn(
                "shrink-0 transition-transform duration-200",
                isCollapsed ? "-rotate-90" : "rotate-0",
              )}
            />
            <span className="text-md font-bold leading-tight text-white">
              {titleLabel}
            </span>
            {marketGroup.headerBadge ? (
              <span className="shrink-0 rounded-lg bg-[var(--lime)] px-2 py-0.5 text-xs font-extrabold text-black">
                {marketGroup.headerBadge}
              </span>
            ) : null}
            {modeLabel ? (
              <span className="shrink-0 rounded-xl border border-[var(--primary-orange)] px-1.5 text-xs font-extrabold italic text-[var(--primary-orange)]">
                {modeLabel}
              </span>
            ) : null}
            <div className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-white/20">
              <span className="text-xs italic text-white">i</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <MdPushPin size={16} color="var(--text-dim)" className="rotate-45" />
          </div>
        </button>

        {isCollapsed ? null : (
          <div className="px-4 py-3">
            <SectionRows
              activeSection={activeSection}
              detail={detail}
              hasSectionTabs={hasSectionTabs(marketGroup)}
              marketGroup={marketGroup}
              renderCell={renderCell}
              selectionType={selectionType}
              setActiveSection={setActiveSection}
            />
          </div>
        )}
      </div>
    );
  });
}
