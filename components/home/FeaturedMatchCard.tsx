"use client";

import Image from "next/image";
import { SimBadge } from "@/components/brand/SimBadge";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OddsButton } from "@/components/betting/OddsButton";
import { parseApiDateForBrowser } from "@/lib/utils/format";
import { getLiveFixtureHref, getPrematchFixtureHref } from "@/lib/utils/fixture-routes";
import { sortHomeOutcomesById } from "@/lib/utils/home-fixtures";
import { getMarketDisplayName } from "@/lib/utils/market-display-resolver";
import { getTeamFallbackLogo } from "@/lib/utils/sports";
import type { FeaturedEvent } from "@/types";

function formatStartTime(value: string): string {
  const target = new Date(value);
  const today = new Date();

  // Check if target date is today (ignores time)
  const isToday = target.getDate() === today.getDate() &&
                  target.getMonth() === today.getMonth() &&
                  target.getFullYear() === today.getFullYear();

  // 1. Get the time part (h a format, e.g., "3 PM")
  const timeString = target.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }); // e.g., "3 PM"

  // 2. Determine the date prefix
  if (isToday) {
    return `${timeString} | Today`;
  } else {
    // Get dd/mm padding manually or using locales
    const dd = String(target.getDate()).padStart(2, '0');
    const mm = String(target.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    return `${timeString} | ${dd}/${mm} `;
  }
}

function formatLiveClock(event: FeaturedEvent): string {
  const minute = String(event.minute ?? 0).padStart(2, "0");
  return `${minute}:00 ${event.period ?? "H2"}`;
}

type FeaturedMatchCardProps = {
  event: FeaturedEvent;
  tournamentId?: string;
};

function TeamCrest({
  logo,
  name,
  side,
}: {
  logo?: string;
  name: string;
  side: "home" | "away";
}) {
  const [failed, setFailed] = useState(false);
  const src = !failed && logo ? logo : getTeamFallbackLogo(side);

  return (
    <div className="fc-team-logo">
      <Image
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        width={48}
        height={48}
        unoptimized
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function FeaturedMatchCard({ event, tournamentId }: FeaturedMatchCardProps) {
  const router = useRouter();
  const eventMarket = event.markets.find((item) => item.type === "1x2") ?? event.markets[0];
  const fixtureMarket =
    event.fixtureMarkets?.find(
      (item) =>
        String(item.marketID ?? "") === "1" ||
        String(item.marketName ?? "").trim().toLowerCase() === "1x2",
    ) ?? event.fixtureMarkets?.[0];
  const fixture = {
    activeMarkets: event.marketCount,
    awayTeam: event.awayTeam.name,
    categoryName: event.categoryName,
    date: event.startTime,
    homeScore: event.score?.home,
    awayScore: event.score?.away,
    homeTeam: event.homeTeam.name,
    matchID: event.id,
    matchStatus: event.period,
    sportID: event.sport.id,
    sportName: event.sport.name,
    tournament: event.league.name,
    tournamentID: event.league.id,
  };
  const outcomes = sortHomeOutcomesById(fixtureMarket?.outcomes ?? []).slice(0, 3);
  const detailHref =
    event.status === "live" ? getLiveFixtureHref(fixture) : getPrematchFixtureHref(fixture);

  return (
    <div
      className="featured-card cursor-pointer"
      data-featured-tournament-id={tournamentId ?? event.league.id}
      role="link"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          router.push(detailHref);
        }
      }}
    >
      <div className="fc-header fc-header-flat">
        <div className="fc-header-meta">
          <span className="fc-header-title fc-header-caption truncate">
            {event.categoryName ?? event.league.name} · {event.league.name}
          </span>
          <SimBadge />
        </div>
      </div>

      <div className="fc-body">
        <div className="fc-team">
          <TeamCrest logo={event.homeTeam.logo} name={event.homeTeam.name} side="home" />
          <span className="fc-team-name">{event.homeTeam.name}</span>
        </div>

        <div className="fc-score">
          {event.status === "live" ? (
            <div className="fc-score-status">
              <span>{formatLiveClock(event)} |</span>
              <span className="fc-score-status-live">Live</span>
            </div>
          ) : (
            <div className="fc-score-start-time">
              {formatStartTime(event.startTime)}
            </div>
          )}

          <div className="fc-score-market">
            {fixtureMarket ? getMarketDisplayName(fixtureMarket) : eventMarket?.name ?? "1X2"}
          </div>
          <div
            className={`fc-score-text ${event.status === "live" ? "fc-score-live-value" : "fc-score-vs"}`}
          >
            {event.status === "live" && event.score
              ? `${event.score.home} - ${event.score.away}`
              : ""}
          </div>
        </div>

        <div className="fc-team">
          <TeamCrest logo={event.awayTeam.logo} name={event.awayTeam.name} side="away" />
          <span className="fc-team-name">{event.awayTeam.name}</span>
        </div>
      </div>

      {fixtureMarket && outcomes.length ? (
        <div className="fc-odds" onClick={(event) => event.stopPropagation()}>
          {outcomes.map((outcome) => (
            <OddsButton
              key={`${event.id}-${String(fixtureMarket.marketID ?? fixtureMarket.marketName ?? "market")}-${String(outcome.outcomeID ?? outcome.displayName ?? outcome.outcomeName ?? "")}-${String(outcome.specifier ?? "")}`}
              mode="fixture"
              fixture={fixture}
              market={fixtureMarket}
              outcome={outcome}
              selectionType={event.status === "live" ? "live" : "prematch"}
              layout="centered"
              fluid
            />
          ))}
        </div>
      ) : eventMarket ? (
        <div className="fc-odds" onClick={(event) => event.stopPropagation()}>
          <OddsButton event={event} market={eventMarket} selectionKey="home" label="1" layout="centered" fluid />
          <OddsButton event={event} market={eventMarket} selectionKey="draw" label="X" layout="centered" fluid />
          <OddsButton event={event} market={eventMarket} selectionKey="away" label="2" layout="centered" fluid />
        </div>
      ) : null}
    </div>
  );
}
