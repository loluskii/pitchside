"use client";

import { useEffect, type MouseEvent } from "react";
import { SimBadge } from "@/components/brand/SimBadge";
import { useRouter } from "next/navigation";
import { OddsButton } from "@/components/betting/OddsButton";
import { SpecifierSelector } from "@/components/fixtures/SpecifierSelector";
import { useFixtureMarket } from "@/lib/hooks/useFixtureMarket";
import { useLiveTimer } from "@/lib/hooks/useLiveTimer";
import { getLiveFixtureHref } from "@/lib/utils/fixture-routes";
import {
  getLiveScoreMetaLabels,
  getLiveScoreboard,
} from "@/lib/utils/live-scores";
import { cn } from "@/lib/utils";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";

type LiveFixtureProps = {
  fixture: RawFixture;
  market: RawMarket | null;
};

export function LiveFixture({ fixture, market }: LiveFixtureProps) {
  const router = useRouter();
  const { displayTime, stopTimer } = useLiveTimer(fixture.eventTime ?? "00:00");
  const {
    activeSpecifier,
    activeSpecifierLabel,
    hasSpecifier,
    outcomes,
    setActiveSpecifier,
    specifierOptions,
  } = useFixtureMarket({ fixture, market });
  const placeholderCount = Math.max(market?.outcomes?.length ?? 0, 2);
  const liveScoreboard = getLiveScoreboard(fixture, "list");
  const liveMetaLabels = getLiveScoreMetaLabels({
    displayTime,
    matchStatus: String(fixture.matchStatus ?? ""),
    phaseLabel: liveScoreboard.phaseLabel,
  });
  const scoreStripWidth =
    liveScoreboard.columns.reduce(
      (total, column) => total + (column.kind === "game" ? 22 : 15),
      0,
    ) +
    Math.max(liveScoreboard.columns.length - 1, 0) * 4;
  const leagueLabel = [fixture.categoryName, fixture.tournament].filter(Boolean).join(" - ");
  const detailHref = getLiveFixtureHref(fixture);
  function shouldOpenFixture(event: MouseEvent<HTMLDivElement>) {
    if (document.body.dataset.fixtureSpecifierOpen === "true") return false;
    const target = event.target instanceof Element ? event.target : null;
    return !target?.closest("button, a, input, select, textarea, [role='button']");
  }

  useEffect(() => {
    if (String(fixture.matchStatus ?? "").trim().toLowerCase() === "ended") {
      stopTimer();
    }
  }, [fixture.matchStatus, stopTimer]);

  return (
    <div
      className="fc-match-card lm-live-card cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (shouldOpenFixture(event)) {
          router.push(detailHref);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(detailHref);
        }
      }}
      >
      <div className="lm-header lm-live-meta">
        <span className="lm-time-live">{liveMetaLabels.primary}</span>
        {liveMetaLabels.secondary ? <span className="lm-status">{liveMetaLabels.secondary}</span> : null}
        <span className="lm-league">{leagueLabel}</span>
        <SimBadge className="ml-auto" />
      </div>

      <div className="lm-body">
        <div className="lm-teams">
          <div className="lm-team-row">
            <span className="lm-team-name">{fixture.homeTeam}</span>
            <div className="lm-score-strip" style={{ flex: `0 0 ${scoreStripWidth}px`, width: scoreStripWidth }}>
              {liveScoreboard.columns.map((column) => (
                <span
                  key={`${column.key}-home`}
                  className={cn(
                    "lm-score-cell",
                    column.kind === "total" && "is-total",
                    column.kind === "period" && "is-period",
                    column.kind === "game" && "is-game",
                  )}
                >
                  {column.home}
                </span>
              ))}
            </div>
          </div>
          <div className="lm-team-row">
            <span className="lm-team-name">{fixture.awayTeam}</span>
            <div className="lm-score-strip" style={{ flex: `0 0 ${scoreStripWidth}px`, width: scoreStripWidth }}>
              {liveScoreboard.columns.map((column) => (
                <span
                  key={`${column.key}-away`}
                  className={cn(
                    "lm-score-cell",
                    column.kind === "total" && "is-total",
                    column.kind === "period" && "is-period",
                    column.kind === "game" && "is-game",
                  )}
                >
                  {column.away}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn("lm-odds", "lm-fluid-odds", "lm-live-odds", hasSpecifier && "has-specifier")}
        >
          {hasSpecifier ? (
            <SpecifierSelector
              activeSpecifier={activeSpecifier}
              label={activeSpecifierLabel}
              onSelect={setActiveSpecifier}
              options={specifierOptions}
            />
          ) : null}
          {market && outcomes.length ? (
            outcomes.map((outcome) => (
              <OddsButton
                key={`${fixture.matchID}-${market.marketID}-${activeSpecifier}-${outcome.outcomeID}`}
                mode="fixture"
                fixture={fixture}
                market={market}
                outcome={outcome}
                selectionType="live"
                fluid
              />
            ))
          ) : (
            Array.from({ length: placeholderCount }).map((_, index) => (
              <div
                key={index}
                className="app-odd-btn app-odd-btn-fluid app-odd-btn-centered opacity-45"
              >
                --
              </div>
            ))
          )}
        </div>
      </div>

      <div className="lm-live-footer">
        <div className="lm-live-market-size">+{Number(fixture.activeMarkets) || 0}&gt;</div>
      </div>
    </div>
  );
}
