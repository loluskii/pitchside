"use client";

import Link from "next/link";
import { PitchsideLogo } from "@/components/brand/Logo";

export function PageFooter() {
  return (
    <footer className="mx-3 mb-28 mt-8 rounded-[22px] border border-[var(--border)] bg-[var(--paper)] px-5 py-6 text-[var(--ink-2)]">
      <PitchsideLogo size={26} />
      <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-[var(--ink-3)]">
        Every fixture on Pitchside is played out by a live match simulation. Kick-offs every hour,
        prices that move with the game, tickets that settle the moment the whistle goes.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--ink)]">
          SIM
        </span>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px]">Play balance only</span>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px]">No payments</span>
      </div>
      <nav className="mt-6 grid grid-cols-2 gap-y-2 text-[13px]">
        <Link href="/sports" className="hover:text-[var(--pitch)]">Sports</Link>
        <Link href="/live" className="hover:text-[var(--pitch)]">In play</Link>
        <Link href="/results" className="hover:text-[var(--pitch)]">Results</Link>
        <Link href="/my-bets" className="hover:text-[var(--pitch)]">My tickets</Link>
      </nav>
      <p className="mt-6 border-t border-[var(--border)] pt-4 font-mono text-[11px] text-[var(--ink-3)]">
        © {new Date().getFullYear()} Pitchside · Built by Isaac Adelore
      </p>
    </footer>
  );
}
