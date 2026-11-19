"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, Clock3, Trophy } from "lucide-react";
import { useLiveCounter, useLiveHighlights } from "@/lib/query/hooks/useSports";
import type { RawFixture } from "@/lib/utils/normalize";
import { getLiveFixtureHref } from "@/lib/utils/fixture-routes";
import { SportIconBadge } from "@/components/ui/SportIconBadge";

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
  const { data: live } = useLiveHighlights();
  const total = (counter as LiveCounterResponse | undefined)?.data?.total;
  const fixtures = ((live as LiveResponse | undefined)?.data?.fixtures ?? []).slice(0, 10);

  return (
    <section className="px-3 pt-3">
      <div className="relative overflow-hidden rounded-[22px] bg-[var(--ink)] p-4 pb-3 text-paper">
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

      <nav className="mt-3 grid grid-cols-4 gap-2" aria-label="Shortcuts">
        {[
          { href: "/sports/football", label: "Football", icon: <SportIconBadge sport="football" size="md" className="size-6" /> },
          { href: "/sports/basketball", label: "Basketball", icon: <SportIconBadge sport="basketball" size="md" className="size-6" /> },
          { href: "/sports/football?period=today", label: "Today", icon: <CalendarClock className="size-5" /> },
          { href: "/results", label: "Results", icon: <Trophy className="size-5" /> },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)] py-3 text-[12px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--pitch)] hover:text-[var(--pitch)]"
          >
            <span className="grid size-7 place-items-center text-[var(--ink)]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-[var(--ink-3)]">
        <Clock3 className="size-3.5" /> New fixtures kick off every hour, around the clock.
      </p>
    </section>
  );
}
