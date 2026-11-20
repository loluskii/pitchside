"use client";
import { SimBadge } from "@/components/brand/SimBadge";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Search01Icon } from "hugeicons-react";
import { FaChartBar } from "react-icons/fa";
import {
  MdArrowBackIosNew,
  MdHome,
  MdTv,
} from "react-icons/md";
import { BetBuilderIcon } from "@/components/icons/BetBuilderIcon";
import { CustomBetPanel } from "@/components/fixtures/CustomBetPanel";
import { FixtureMarketCards } from "@/components/fixtures/FixtureMarketCards";
import { SportradarWidget } from "@/components/fixtures/SportradarWidget";
import { parseApiDateForBrowser } from "@/lib/utils/format";
import type {
  FixtureDetailMarketGroup,
  FixtureDetailSection,
  FixtureDisplayMarketGroup,
} from "@/lib/hooks/useFixtureDetailMarkets";
import { formatHomeSportName } from "@/lib/utils/home-fixtures";
import { getLiveScoreboard } from "@/lib/utils/live-scores";
import type { RawFixture } from "@/lib/utils/normalize";
import { getTeamFallbackLogo, getTeamLogoUrl } from "@/lib/utils/sports";
import { cn } from "@/lib/utils";

type DetailFixture = RawFixture & {
  categoryName?: string;
  country?: string;
  tournamentName?: string;
};

type FixtureDetailScreenProps = {
  detail: DetailFixture | null;
  displayTime?: string;
  emptyMessage: string;
  hasNoMarketsInSelectedGroup: boolean;
  homeHref: string;
  isBettingClosed?: boolean;
  isLive: boolean;
  isLoading: boolean;
  onBack: () => void;
  selectionType: "prematch" | "live";
  selectedGroupId: string | number | null;
  setSelectedGroupId: (value: string | number | null) => void;
  sortedMarketGroups: FixtureDetailMarketGroup[];
  sportSlug: string;
  displayGroupedMarkets: FixtureDisplayMarketGroup[];
  getActiveSection: (marketGroup: FixtureDisplayMarketGroup) => FixtureDetailSection | null;
  setActiveSection: (marketGroup: FixtureDisplayMarketGroup, sectionKey: string) => void;
  hasSectionTabs: (marketGroup: FixtureDisplayMarketGroup) => boolean;
};

type FixtureDetailTab = "codes" | "custombet" | "markets" | "stats";

function parseFixtureDate(value?: string) {
  return parseApiDateForBrowser(value);
}

function normalizePhaseLabel(value?: string) {
  const text = String(value ?? "").trim();
  const lowered = text.toLowerCase();

  if (!text) return "";
  if (lowered.includes("1st") || lowered === "h1") return "H1";
  if (lowered.includes("2nd") || lowered === "h2") return "H2";
  if (lowered.includes("half") && lowered.includes("time")) return "HT";
  if (lowered.includes("extra")) return "ET";
  if (lowered.includes("pen")) return "PEN";

  return text;
}

function formatLiveClock(displayTime?: string, status?: string) {
  const phase = normalizePhaseLabel(status);
  return [String(displayTime ?? "00:00").trim() || "00:00", phase].filter(Boolean).join(" ");
}

function formatPrematchCenter(value?: string) {
  const date = parseFixtureDate(value);

  if (!date) {
    return {
      dateLine: "--",
      weekday: "--",
      timeLabel: "--:--",
    };
  }

  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const paddedDay = date.toLocaleDateString("en-GB", { day: "2-digit" });
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const timeLabel = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    dateLine: `${paddedDay} ${month}`,
    weekday,
    timeLabel,
  };
}

function getLeagueLabel(detail: DetailFixture, sportSlug: string, isLive: boolean) {
  const sportName = formatHomeSportName(String(detail.sportName ?? sportSlug ?? "Football"));
  const countryName = String(detail.categoryName ?? detail.country ?? "").trim();
  const tournamentName = String(detail.tournamentName ?? detail.tournament ?? "").trim();
  const prematchBody = [countryName, tournamentName].filter(Boolean).join(" - ");
  const liveBody = tournamentName || countryName;

  return `${sportName} / ${isLive ? liveBody : prematchBody || liveBody || "Fixture details"}`;
}

const FIXTURE_TEAM_LOGO_SIZE = 48;

function TeamLogo({ side, teamName }: { side: "home" | "away"; teamName: string }) {
  const [failedTeamName, setFailedTeamName] = useState<string | null>(null);
  const showFallback = failedTeamName === teamName;

  if (showFallback || !teamName.trim()) {
    return (
      <Image
        alt={teamName || side}
        className="fixture-detail-team-logo"
        height={FIXTURE_TEAM_LOGO_SIZE}
        src={getTeamFallbackLogo(side)}
        unoptimized
        width={FIXTURE_TEAM_LOGO_SIZE}
      />
    );
  }

  return (
    <Image
      alt={teamName}
      className="fixture-detail-team-logo"
      height={FIXTURE_TEAM_LOGO_SIZE}
      onError={() => setFailedTeamName(teamName)}
      src={getTeamLogoUrl(teamName)}
      unoptimized
      width={FIXTURE_TEAM_LOGO_SIZE}
    />
  );
}

function PrematchDetailHeader({
  awayTeam,
  center,
  homeTeam,
}: {
  awayTeam: string;
  center: ReturnType<typeof formatPrematchCenter>;
  homeTeam: string;
}) {
  return (
    <div className="fixture-detail-prematch-hero">
      <div className="fixture-detail-prematch-backdrop fixture-detail-prematch-backdrop-home">
        <TeamLogo side="home" teamName={homeTeam} />
      </div>
      <div className="fixture-detail-prematch-backdrop fixture-detail-prematch-backdrop-away">
        <TeamLogo side="away" teamName={awayTeam} />
      </div>

      <div className="fixture-detail-prematch-team fixture-detail-prematch-team-home">
        <TeamLogo side="home" teamName={homeTeam} />
        <span>{homeTeam}</span>
      </div>

      <div className="fixture-detail-prematch-center">
        <span>{center.dateLine}</span>
        <span>{center.weekday}</span>
        <strong>{center.timeLabel}</strong>
      </div>

      <div className="fixture-detail-prematch-team fixture-detail-prematch-team-away">
        <TeamLogo side="away" teamName={awayTeam} />
        <span>{awayTeam}</span>
      </div>
    </div>
  );
}

function DetailMetaRow({ leagueLabel }: { leagueLabel: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 text-sm text-[var(--text-dim)]">
      <span className="min-w-0 flex-1 leading-tight">{leagueLabel}</span>
      <div className="flex shrink-0 items-center gap-2">
        <SimBadge />
      </div>
    </div>
  );
}

function FixtureDetailTabs({
  activeTab,
  onChange,
  showCustomBet,
}: {
  activeTab: FixtureDetailTab;
  onChange: (tab: FixtureDetailTab) => void;
  showCustomBet: boolean;
}) {
  const tabs: Array<{ id: FixtureDetailTab; label: string; icon?: "betBuilder" }> = [
    ...(showCustomBet ? [{ id: "custombet" as const, label: "BetBuilder", icon: "betBuilder" as const }] : []),
    { id: "markets", label: "Markets" },
  ];
  if (tabs.length < 2) return null;

  return (
    <div className="mb-4 flex items-center pb-1">
      <div className="flex w-full min-w-0 overflow-hidden rounded-lg border border-white/8 bg-[#F3F4F2] p-1">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-base font-bold transition",
                selected
                  ? "bg-surface-active text-white shadow-sm"
                  : "text-white/52",
              )}
              aria-label={tab.label}
            >
              {tab.icon === "betBuilder" ? (
                <>
                  <BetBuilderIcon size={30} />
                  <span className="sr-only">{tab.label}</span>
                </>
              ) : (
                tab.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FixtureCodesEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
      <p className="text-xl font-semibold text-white">No codes for this match</p>
    </div>
  );
}

function MarketGroupTabs({
  groups,
  onChange,
  selectedGroupId,
}: {
  groups: FixtureDetailMarketGroup[];
  onChange: (value: string | number | null) => void;
  selectedGroupId: string | number | null;
}) {
  return (
    <div className="-mx-4 mb-4 mt-3 border-y border-white/6 bg-[#F6F6F5] px-4 py-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-md font-extrabold",
          selectedGroupId === null
            ? "bg-[var(--lime)] text-black"
            : "bg-[var(--bg-card)] text-white",
        )}
      >
        All
      </button>
      {groups.map((group) => (
        <button
          key={String(group.id)}
          type="button"
          onClick={() => onChange(group.id)}
          className={cn(
            "flex shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-4 text-md font-extrabold",
            String(selectedGroupId) === String(group.id)
              ? "bg-[var(--lime)] text-black"
              : "bg-[var(--bg-card)] text-white",
          )}
        >
          {group.name}
        </button>
      ))}
      <div className="ml-auto flex h-[36px] min-w-[36px] shrink-0 items-center justify-center">
        <Search01Icon size={20} color="currentColor" />
      </div>
      </div>
    </div>
  );
}

function LiveDetailHeader({
  awayScore,
  detail,
  displayTime,
  homeScore,
  liveClockLabel,
}: {
  awayScore: string;
  detail: DetailFixture;
  displayTime?: string;
  homeScore: string;
  liveClockLabel: string;
}) {
  const liveScoreboard = getLiveScoreboard(detail);
  const matchStatus = String(detail.matchStatus ?? "").trim().toLowerCase();
  const isEnded = matchStatus === "ended";
  const livePhaseLabel = liveScoreboard.phaseLabel || normalizePhaseLabel(String(detail.matchStatus ?? "")) || "Live";
  const hasClock = Boolean(String(displayTime ?? "").trim() && String(displayTime ?? "").trim() !== "--:--");
  const liveFooterLabel = isEnded ? "Full Time" : hasClock ? liveClockLabel : "";
  const breakdownColumns = liveScoreboard.columns;
  const breakdownCellWidth = breakdownColumns.length >= 5 ? 42 : 25;

  if (liveScoreboard.hasBreakdown) {
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl">
          <div
            className="grid items-center gap-1"
            style={{
              gridTemplateColumns: `minmax(0,1fr) repeat(${breakdownColumns.length}, ${breakdownCellWidth}px)`,
            }}
          >
            <div />
            {breakdownColumns.map((column) => (
              <span
                key={`${column.key}-label`}
                className="text-center text-sm font-bold text-[var(--text-dim)]"
                style={{ width: breakdownCellWidth }}
              >
                {column.label}
              </span>
            ))}

            <span className="min-w-0 truncate text-xl font-extrabold text-white">
              {String(detail.homeTeam ?? "Home")}
            </span>
            {breakdownColumns.map((column) => (
              <span
                key={`${column.key}-home`}
                className={cn(
                  "flex h-[28px] items-center justify-center rounded-lg text-3xl font-black leading-none",
                  column.kind === "total"
                    ? "text-[var(--primary-orange)]"
                    : "",
                )}
                style={{ width: breakdownCellWidth }}
              >
                {column.home}
              </span>
            ))}

            <span className="min-w-0 truncate text-xl font-extrabold text-white">
              {String(detail.awayTeam ?? "Away")}
            </span>
            {breakdownColumns.map((column) => (
              <span
                key={`${column.key}-away`}
                className={cn(
                  "flex h-[28px] items-center justify-center rounded-lg text-3xl font-black leading-none",
                  column.kind === "total"
                    ? "text-[var(--primary-orange)]"
                    : "",
                )}
                style={{ width: breakdownCellWidth }}
              >
                {column.away}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex min-w-[48px] items-center justify-center rounded-full bg-white/[0.08] px-[10px] py-[6px] text-sm font-extrabold tracking-[0.04em] text-white">
            {livePhaseLabel}
          </span>
          {liveFooterLabel ? (
            <span className="text-base font-bold text-[var(--text-dim)]">{liveFooterLabel}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_58px] items-stretch gap-2">
          <span className="flex min-w-0 items-center text-xl font-extrabold leading-[1.2] text-white">
            {String(detail.homeTeam ?? "Home")}
          </span>
          <span className="flex items-center justify-end text-4xl font-black leading-none text-[var(--primary-orange)]">
            {homeScore || "0"}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_58px] items-stretch gap-2">
          <span className="flex min-w-0 items-center text-xl font-extrabold leading-[1.2] text-white">
            {String(detail.awayTeam ?? "Away")}
          </span>
          <span className="flex items-center justify-end text-4xl font-black leading-none text-[var(--primary-orange)]">
            {awayScore || "0"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-[48px] items-center justify-center rounded-full bg-white/[0.08] px-[10px] py-[6px] text-sm font-extrabold tracking-[0.04em] text-white">
          {livePhaseLabel}
        </span>
        {liveFooterLabel ? (
          <span className="text-base font-bold text-[var(--text-dim)]">{liveFooterLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function FixtureDetailScreen({
  detail,
  displayGroupedMarkets,
  displayTime,
  emptyMessage,
  getActiveSection,
  hasNoMarketsInSelectedGroup,
  hasSectionTabs,
  homeHref,
  isBettingClosed = false,
  isLive,
  isLoading,
  onBack,
  selectionType,
  selectedGroupId,
  setActiveSection,
  setSelectedGroupId,
  sortedMarketGroups,
  sportSlug,
}: FixtureDetailScreenProps) {
  const collapsedStateKey = `${String(detail?.matchID ?? "")}:${String(selectedGroupId ?? "all")}`;
  const matchId = String(detail?.matchID ?? "").trim();
  const [tabState, setTabState] = useState<{ activeTab: FixtureDetailTab; matchId: string }>({
    activeTab: "markets",
    matchId: "",
  });
  const [collapsedState, setCollapsedState] = useState<{
    key: string;
    markets: Record<string, boolean>;
  }>({ key: collapsedStateKey, markets: {} });
  const collapsedMarkets = collapsedState.key === collapsedStateKey ? collapsedState.markets : {};
  const activeTab = tabState.matchId === matchId ? tabState.activeTab : "markets";
  const visibleActiveTab = isLive && activeTab === "custombet" ? "markets" : activeTab;
  const statsWidgetName = isLive ? "match.Statistics" : "headToHead.standalone";

  const liveTitle = `${String(detail?.homeTeam ?? "").trim()} vs ${String(detail?.awayTeam ?? "").trim()}`;
  const title = detail ? liveTitle : "Match";
  const leagueLabel = detail ? getLeagueLabel(detail, sportSlug, isLive) : "Fixture details";
  const homeScore = String(
    detail?.homeScore ?? detail?.eventInfo?.score?.home ?? detail?.eventInfo?.scores?.home ?? "0",
  ).trim();
  const awayScore = String(
    detail?.awayScore ?? detail?.eventInfo?.score?.away ?? detail?.eventInfo?.scores?.away ?? "0",
  ).trim();
  const prematchCenter = formatPrematchCenter(detail?.date);
  const liveClockLabel = formatLiveClock(displayTime, String(detail?.matchStatus ?? ""));
  const detailMessageClassName =
    "rounded-xl bg-[var(--bg-card)] px-5 py-8 text-center text-md text-[var(--text-dim)]";

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-white">
      <div className="flex items-center justify-between bg-[var(--bg-header)] py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex cursor-pointer items-center"
          >
            <MdArrowBackIosNew size={20} color="currentColor" />
          </button>
          <div className="flex min-w-0 flex-col">
            <span className="truncate whitespace-nowrap text-2xl font-bold text-white">
              {title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href={homeHref} aria-label="Home">
            <MdHome size={22} color="currentColor" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 py-4">
          <div className="h-[220px] animate-pulse rounded-2xl bg-[rgba(18, 26, 22, 0.05)]" />
          <div className="h-[52px] animate-pulse rounded-xl bg-[var(--bg-card)]" />
          <div className="h-[420px] animate-pulse rounded-2xl bg-[rgba(18, 26, 22, 0.05)]" />
        </div>
      ) : !detail ? (
        <div className="py-16 text-center text-md text-[var(--text-dim)]">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="pt-4">
            {isLive ? (
              <>
                <DetailMetaRow leagueLabel={leagueLabel} />
                <div className="mb-6">
                  <LiveDetailHeader
                    awayScore={awayScore}
                    detail={detail}
                    displayTime={displayTime}
                    homeScore={homeScore}
                    liveClockLabel={liveClockLabel}
                  />
                </div>
              </>
            ) : (
              <>
                <DetailMetaRow leagueLabel={leagueLabel} />
                <PrematchDetailHeader
                  awayTeam={String(detail.awayTeam ?? "Away")}
                  center={prematchCenter}
                  homeTeam={String(detail.homeTeam ?? "Home")}
                />
              </>
            )}
          </div>          

          <FixtureDetailTabs
            activeTab={visibleActiveTab}
            onChange={(nextTab) => setTabState({ activeTab: nextTab, matchId })}
            showCustomBet={false}
          />

          <div className="pb-[120px]">
            {visibleActiveTab === "custombet" ? (
              <CustomBetPanel active={visibleActiveTab === "custombet"} detail={detail} />
            ) : visibleActiveTab === "stats" ? (
              <SportradarWidget
                matchId={matchId}
                title={isLive ? "Match statistics" : "Head-to-head stats"}
                widgetName={statsWidgetName}
              />
            ) : visibleActiveTab === "codes" ? (
              <FixtureCodesEmptyState />
            ) : (
              <>
                <MarketGroupTabs
                  groups={sortedMarketGroups}
                  onChange={setSelectedGroupId}
                  selectedGroupId={selectedGroupId}
                />

                {isBettingClosed ? (
                  <div className={detailMessageClassName}>
                    {isLive
                      ? "Sorry, this game is no longer available. Betting has closed."
                      : "Betting has closed for this fixture."}
                  </div>
                ) : hasNoMarketsInSelectedGroup || (!displayGroupedMarkets.length && selectedGroupId !== null) ? (
                  <div className={detailMessageClassName}>
                    Sorry, there are no markets available in this category.
                  </div>
                ) : !displayGroupedMarkets.length ? (
                  <div className={detailMessageClassName}>
                    No markets are currently available for this fixture.
                  </div>
                ) : (
                  <FixtureMarketCards
                    collapsedMarkets={collapsedMarkets}
                    collapsedStateKey={collapsedStateKey}
                    detail={detail}
                    displayGroupedMarkets={displayGroupedMarkets}
                    getActiveSection={getActiveSection}
                    hasSectionTabs={hasSectionTabs}
                    onToggleMarket={(accordionKey, isCollapsed) =>
                      setCollapsedState((current) => ({
                        key: collapsedStateKey,
                        markets: {
                          ...(current.key === collapsedStateKey ? current.markets : {}),
                          [accordionKey]: !isCollapsed,
                        },
                      }))
                    }
                    selectionType={selectionType}
                    setActiveSection={setActiveSection}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
