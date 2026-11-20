"use client";

import Link from "next/link";
import { CalendarClock, Clock3, Dices, Trophy } from "lucide-react";
import { photo } from "@/lib/media";
import { useLiveCounter } from "@/lib/query/hooks/useSports";
import { HeroBanners } from "@/components/home/HeroBanners";

type LiveCounterResponse = { data?: { total?: number; sports?: Array<{ sport_id?: number | string; games?: number | string }> } };

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

  return (
    <section>
      <HeroBanners />

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
