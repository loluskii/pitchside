"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, Clock3, Dices, Trophy } from "lucide-react";
import { photo } from "@/lib/media";
import { useLiveCounter, useLiveHighlights } from "@/lib/query/hooks/useSports";
import type { RawFixture } from "@/lib/utils/normalize";
import { getLiveFixtureHref } from "@/lib/utils/fixture-routes";

type LiveCounterResponse = { data?: { total?: number; sports?: Array<{ sport_id?: number | string; games?: number | string }> } };
type LiveResponse = { data?: { fixtures?: RawFixture[] } };

function TickerItem({ fixture }: { fixture: RawFixture }) {
  return (
    <Link
      href={getLiveFixtureHref(fixture)}
      className="flex shrink-0 items-center gap-2 rounded-full border border-paper/10 bg-paper/[0.06] py-1.5 pl-2.5 pr-3 text-[12px] text-paper/85 transition-colors hover:bg-paper/[0.12]"
    >
      <span className="font-mono text-[11px] text-[var(--lime)]">{String(fixture.eventTime ?? "").split(":")[0]}&apos;</span>
      <span className="max-w-[86px] truncate">{fixture.homeTeam}</span>
      <span className="font-mono font-semibold tabular-nums text-paper">
        {fixture.homeScore ?? 0}–{fixture.awayScore ?? 0}
      </span>
      <span className="max-w-[86px] truncate">{fixture.awayTeam}</span>
    </Link>
  );
}

export function HomeHero() {
  const { data: counter } = useLiveCounter();
  const liveBySport = new Map(
    ((counter as LiveCounterResponse | undefined)?.data?.sports ?? []).map((s) => [String(s.sport_id), Number(s.games ?? 0)]),
  );
  const SPORT_TILES = [
    { label: "Football", href: "/sports/football", photo: "stadiumDusk" as const, live: liveBySport.get("1") },
    { label: "Basketball", href: "/sports/basketball", photo: "basketballGame" as const, live: liveBySport.get("2") },
    { label: "Ice Hockey", href: "/sports/ice-hockey", photo: "hockey" as const, live: liveBySport.get("4") },
    { label: "Tennis", href: "/sports/tennis", photo: "tennis" as const, live: liveBySport.get("5") },
  ];
  const { data: live } = useLiveHighlights();
  const total = (counter as LiveCounterResponse | undefined)?.data?.total;
  const fixtures = ((live as LiveResponse | undefined)?.data?.fixtures ?? []).slice(0, 10);

  return (
    <section>
      <div className="relative overflow-hidden rounded-[22px] bg-[var(--ink)] p-4 pb-3 text-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo("stadiumNight", 900, 520)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--ink)]/90 via-[var(--ink)]/55 to-[var(--pitch-deep)]/70" />
        {/* pitch markings */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 200"
          className="pointer-events-none absolute -right-16 -top-10 h-[230px] w-[460px] text-paper/[0.07]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="20" y="20" width="360" height="160" rx="4" />
          <path d="M200 20v160" />
          <circle cx="200" cy="100" r="34" />
          <rect x="20" y="62" width="44" height="76" />
          <rect x="336" y="62" width="44" height="76" />
        </svg>

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper/60">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--flare)] opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--flare)]" />
              </span>
              In play right now
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-[52px] font-extrabold leading-none tracking-[-0.05em] tabular-nums">
                {total ?? "—"}
              </span>
              <span className="text-[14px] text-paper/70">matches live</span>
            </div>
          </div>
          <Link
            href="/live"
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)] transition-transform hover:-translate-y-px"
          >
            Watch live <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="relative -mx-4 mt-4 overflow-hidden">
          <div className="flex w-max gap-2 px-4 [animation:ps-ticker_48s_linear_infinite] hover:[animation-play-state:paused]">
            {[...fixtures, ...fixtures].map((fixture, index) => (
              <TickerItem key={`${fixture.matchID}-${index}`} fixture={fixture} />
            ))}
          </div>
        </div>
      </div>

      <nav className="-mx-2.5 mt-3 flex gap-2 overflow-x-auto px-2.5 pb-1 no-scrollbar" aria-label="Sports">
        {SPORT_TILES.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group relative h-[92px] w-[132px] shrink-0 overflow-hidden rounded-2xl bg-[var(--ink)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo(tile.photo, 300, 220)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/85 via-[var(--ink)]/20 to-transparent" />
            <span className="absolute bottom-2 left-2.5 right-2 flex items-end justify-between text-[#fff]">
              <span className="font-heading text-[15px] font-bold leading-none tracking-[-0.02em]">{tile.label}</span>
              {tile.live ? (
                <span className="rounded-full bg-[var(--flare)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">{tile.live}</span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
      <div className="mt-2 flex gap-2">
        {[
          { href: "/sports/football?period=today", label: "Today", icon: <CalendarClock className="size-4" /> },
          { href: "/results", label: "Results", icon: <Trophy className="size-4" /> },
          { href: "/casino", label: "Casino", icon: <Dices className="size-4" /> },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--paper)] py-2 text-[12.5px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--pitch)] hover:text-[var(--pitch)]"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-[var(--ink-3)]">
        <Clock3 className="size-3.5" /> New fixtures kick off every hour, around the clock.
      </p>
    </section>
  );
}
