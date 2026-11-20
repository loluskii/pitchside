"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity01Icon } from "hugeicons-react";
import { FeaturedMatchCard } from "@/components/home/FeaturedMatchCard";
import { FeaturedMatchCardSkeleton } from "@/components/home/FeaturedMatchCardSkeleton";
import { cn } from "@/lib/utils";
import { useFeaturedEvents } from "@/lib/query/hooks/useFeaturedEvents";

const FEATURED_FILTERS = ["Matches", "Codes", "Games"] as const;

function TournamentPillIcon({
  logoUrl,
  tournamentName,
}: {
  logoUrl?: string;
  tournamentName: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallbackLabel = tournamentName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="league-item-icon-wrapper">
      {logoUrl && !failed ? (
        <Image
          src={logoUrl}
          alt={tournamentName}
          width={22}
          height={22}
          unoptimized
          className="league-item-logo"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="league-item-fallback">{fallbackLabel || "SP"}</span>
      )}
    </div>
  );
}

export function FeaturedGamesContainer() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof FEATURED_FILTERS)[number]>("Matches");
  const [preferredTournamentId, setPreferredTournamentId] = useState<string | null>(
    null,
  );
  const leagueTabsRef = useRef<HTMLDivElement | null>(null);
  const featuredScrollRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: tournaments = [], isLoading } = useFeaturedEvents();
  const showLeagueSkeletons = isLoading && !tournaments.length;
  const activeTournamentId =
    preferredTournamentId && tournaments.some((tournament) => tournament.tournamentId === preferredTournamentId)
      ? preferredTournamentId
      : (tournaments[0]?.tournamentId ?? null);

  const currentTournament =
    tournaments.find(
      (tournament) => tournament.tournamentId === activeTournamentId,
    ) ?? tournaments[0];

  const fixtureItems = useMemo(
    () =>
      tournaments.flatMap((tournament) =>
        tournament.fixtures.map((event) => ({
          event,
          tournament,
        })),
      ),
    [tournaments],
  );

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);
  }, []);

  const scrollTournamentFixturesIntoView = useCallback(
    (tournamentId: string) => {
      const scroller = featuredScrollRef.current;
      if (!scroller) return;

      const target = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-featured-tournament-id]"),
      ).find((element) => element.dataset.featuredTournamentId === tournamentId);

      if (!target) return;

      markProgrammaticScroll();
      // Scroll only the horizontal row. scrollIntoView would also move the page.
      scroller.scrollTo({
        left: scroller.scrollLeft + target.getBoundingClientRect().left - scroller.getBoundingClientRect().left,
        behavior: "smooth",
      });
    },
    [markProgrammaticScroll],
  );

  const selectTournament = useCallback(
    (tournamentId: string) => {
      setPreferredTournamentId(tournamentId);
      requestAnimationFrame(() => scrollTournamentFixturesIntoView(tournamentId));
    },
    [scrollTournamentFixturesIntoView],
  );

  const handleFeaturedScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;

    const scroller = featuredScrollRef.current;
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
    let visibleTournamentId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    scroller
      .querySelectorAll<HTMLElement>("[data-featured-tournament-id]")
      .forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.right <= scrollerRect.left || rect.left >= scrollerRect.right) {
          return;
        }

        const elementCenter = rect.left + rect.width / 2;
        const distance = Math.abs(elementCenter - scrollerCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          visibleTournamentId = element.dataset.featuredTournamentId ?? null;
        }
      });

    if (visibleTournamentId && visibleTournamentId !== activeTournamentId) {
      setPreferredTournamentId(visibleTournamentId);
    }
  }, [activeTournamentId]);

  const currentTournamentKey = currentTournament ? String(activeTournamentId ?? "") : "";
  const firstPillKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const row = leagueTabsRef.current;
    if (!row || !currentTournamentKey) return;
    // The first pill is already in view on load; measuring here would force a full layout.
    if (firstPillKeyRef.current === null) {
      firstPillKeyRef.current = currentTournamentKey;
      return;
    }
    const frame = requestAnimationFrame(() => {
      const activePill = row.querySelector<HTMLElement>(".league-item.active");
      if (!activePill) return;
      // Centre the active pill inside its own row without touching the page scroll.
      const rowRect = row.getBoundingClientRect();
      const pillRect = activePill.getBoundingClientRect();
      row.scrollTo({
        left: row.scrollLeft + pillRect.left - rowRect.left - (rowRect.width - pillRect.width) / 2,
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentTournamentKey]);

  useEffect(
    () => () => {
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
    },
    [],
  );

  return (
    <section className="hot">
      <div className="fc-upcoming-header">
        <div className="fc-uh-title">Big games</div>
      </div>

      {activeFilter !== "Matches" ? (
        <div className="featured-empty-state">
          <Activity01Icon
            size={32}
            color="var(--text-dim)"
            className="featured-empty-icon"
          />
          <div>No {activeFilter} available at the moment.</div>
          <div className="featured-empty-caption">
            Check back later for updates.
          </div>
        </div>
      ) : (
        <>
          <div className="league-tabs" ref={leagueTabsRef}>
            {showLeagueSkeletons
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`league-skeleton-${index}`}
                    className={cn("league-item", "featured-league-skeleton")}
                    aria-hidden="true"
                  >
                    <span className="ps-skeleton featured-league-skeleton-logo" />
                  </div>
                ))
              : tournaments.map((tournament, index) => {
                  const isActive = (currentTournament?.tournamentId === tournament.tournamentId) || undefined;

                  return (
                    <button
                      key={tournament.tournamentId}
                      type="button"
                      className={cn("league-item", isActive && "active")}
                      onClick={() => selectTournament(tournament.tournamentId)}
                    >
                      <TournamentPillIcon
                        logoUrl={tournament.logoUrl}
                        tournamentName={tournament.tournamentName}
                      />
                      {isActive || (index === 0 && isActive !== undefined) ? (
                          <span className="league-item-name">
                            {tournament.tournamentName}
                          </span>
                        ):null}
                    </button>
                  );
                })}
          </div>

          {isLoading ? (
            <div className="featured-scroll">
              {Array.from({ length: 3 }).map((_, index) => (
                <FeaturedMatchCardSkeleton key={index} />
              ))}
            </div>
          ) : fixtureItems.length ? (
            <div
              className="featured-scroll"
              ref={featuredScrollRef}
              onScroll={handleFeaturedScroll}
            >
              {fixtureItems.map(({ event, tournament }) => (
                <FeaturedMatchCard
                  key={`${tournament.tournamentId}-${event.id}`}
                  event={event}
                  tournamentId={tournament.tournamentId}
                />
              ))}
            </div>
          ) : (
            <div className="featured-empty-state featured-empty-state-compact">
              No featured fixtures available right now.
            </div>
          )}
        </>
      )}
    </section>
  );
}
