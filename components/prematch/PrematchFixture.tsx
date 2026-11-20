"use client";

import type { MouseEvent } from "react";
import { SimBadge } from "@/components/brand/SimBadge";
import { useRouter } from "next/navigation";
import { Activity01Icon } from "hugeicons-react";
import { OddsButton } from "@/components/betting/OddsButton";
import { SpecifierSelector } from "@/components/fixtures/SpecifierSelector";
import { useFixtureMarket } from "@/lib/hooks/useFixtureMarket";
import { getPrematchFixtureHref } from "@/lib/utils/fixture-routes";
import { formatHomeStartTime } from "@/lib/utils/home-fixtures";
import type { RawFixture, RawMarket } from "@/lib/utils/normalize";

type PrematchFixtureProps = {
  fixture: RawFixture;
  market: RawMarket | null;
  selectedSpecifier?: string;
};

export function PrematchFixture({
  fixture,
  market,
  selectedSpecifier,
}: PrematchFixtureProps) {
  const router = useRouter();
  const detailHref = getPrematchFixtureHref(fixture);

  const {
    activeSpecifier,
    activeSpecifierLabel,
    hasSpecifier,
    outcomes,
    setActiveSpecifier,
    specifierOptions,
  } = useFixtureMarket({
    fixture,
    market,
    selectedSpecifier,
  });
  const placeholderCount = Math.max(market?.outcomes?.length ?? 0, 2);
  function shouldOpenFixture(event: MouseEvent<HTMLDivElement>) {
    if (document.body.dataset.fixtureSpecifierOpen === "true") return false;
    const target = event.target instanceof Element ? event.target : null;
    return !target?.closest("button, a, input, select, textarea, [role='button']");
  }

  return (
    <div
      className="live-match-row cursor-pointer"
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
      <div className="lm-header">
        <span className="lm-time-prematch">{formatHomeStartTime(String(fixture.date ?? ""))}</span>
        <span className="lm-league">{fixture.tournament}</span>
        <SimBadge className="ml-auto" />
      </div>

      <div className="lm-body">
        <div className="lm-teams">
          <div className="lm-team-row">
            <span className="lm-team-name">{fixture.homeTeam}</span>
          </div>
          <div className="lm-team-row">
            <span className="lm-team-name">{fixture.awayTeam}</span>
          </div>
        </div>

        <div className={`lm-odds lm-fluid-odds${hasSpecifier ? " has-specifier" : ""}`}>
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
                selectionType="prematch"
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

      <div className="lm-footer">
        <div className="lm-footer-left">
          <span>+{Number(fixture.activeMarkets) || 0} markets</span>
        </div>
        <div className="lm-footer-right">
          <Activity01Icon size={14} color="var(--text-dim)" />
        </div>
      </div>
    </div>
  );
}
