"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { SimBadge } from "@/components/brand/SimBadge";
import { PageFooter } from "@/components/layout/PageFooter";
import { CASINO_GAMES, LOBBY_EXTRAS } from "@/lib/casino/games";
import { photo } from "@/lib/media";

export function CasinoLobby() {
  const [featured, ...rest] = CASINO_GAMES;

  return (
    <div className="-mx-3 -mt-3 flex flex-col">
      {/* Hero band */}
      <section className="bg-[var(--ink)] px-3 pb-5 pt-4 text-[var(--chalk)]">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-[32px] font-extrabold leading-none tracking-tight">Casino</h1>
            <p className="mt-1.5 text-sm text-[var(--chalk)]/65">Instant games, played with your balance.</p>
          </div>
          <Sparkles className="mb-1 text-[var(--lime)]" size={22} />
        </div>

        <Link
          href={`/casino/${featured.slug}`}
          className="group relative mt-4 block h-52 overflow-hidden rounded-3xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo(featured.photo, 900, 520)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-[var(--ink)]/40 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
              Featured
            </span>
            <SimBadge className="h-[22px] px-1.5" />
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-3xl font-extrabold">{featured.name}</h2>
              <p className="text-sm text-[var(--chalk)]/75">{featured.tagline}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--lime)] text-[var(--ink)]">
              <ArrowUpRight size={20} />
            </span>
          </div>
        </Link>
      </section>

      {/* Games grid */}
      <section className="bg-[var(--chalk)] px-3 py-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-heading text-xl font-extrabold text-[var(--ink)]">All games</h2>
          <span className="text-xs text-[var(--ink)]/70">{CASINO_GAMES.length} games</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {rest.map((game, index) => (
            <Link
              key={game.slug}
              href={`/casino/${game.slug}`}
              className={`group relative overflow-hidden rounded-3xl bg-[var(--ink)] ${index === 0 ? "col-span-2 h-40" : "h-48"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo(game.photo, index === 0 ? 900 : 480, index === 0 ? 360 : 480)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-[var(--ink)]/30 to-transparent" />
              <SimBadge className="absolute right-3 top-3" />
              <div className="absolute inset-x-3 bottom-3 text-[var(--chalk)]">
                <span className="mb-1.5 block h-1 w-8 rounded-full" style={{ background: game.accent }} />
                <h3 className="font-heading text-xl font-extrabold leading-tight">{game.name}</h3>
                <p className="text-[11px] leading-4 text-[var(--chalk)]/70">{game.tagline}</p>
                <p className="mt-1 font-mono text-[10px] text-[var(--chalk)]/50">
                  RTP {game.rtp} · Max {game.maxWin}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Coming soon band */}
      <section className="bg-[var(--pitch-deep)] px-3 py-5 text-[var(--chalk)]">
        <h2 className="font-heading text-lg font-extrabold">Coming soon</h2>
        <div className="-mx-3 mt-3 flex gap-2.5 overflow-x-auto px-3 no-scrollbar">
          {LOBBY_EXTRAS.map((extra) => (
            <div key={extra.title} className="relative h-32 w-40 shrink-0 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(extra.photo, 400, 320)} alt="" className="absolute inset-0 h-full w-full object-cover grayscale-[40%]" />
              <div className="absolute inset-0 bg-[var(--ink)]/55" />
              <div className="absolute inset-x-2.5 bottom-2.5">
                <p className="font-heading text-sm font-bold">{extra.title}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--lime)]">Coming soon</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="px-3 pt-3">
        <PageFooter />
      </div>
    </div>
  );
}
