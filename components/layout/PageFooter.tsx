"use client";

import Link from "next/link";
import { PitchsideLogo } from "@/components/brand/Logo";

export function PageFooter() {
  return (
    <footer className="page-footer -mx-2.5 mt-6 rounded-t-[28px] bg-[var(--pitch-deep)] px-5 pb-32 pt-7 text-[#ffffff]/80">
      <PitchsideLogo size={26} tone="light" />
      <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-[#ffffff]/70">
        All matches on Pitchside are simulated and all bets use play money. No real money can be
        deposited or won.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--ink)]">
          SIM
        </span>
        <span className="rounded-full border border-[#ffffff]/20 px-2.5 py-1 text-[11px]">Play money</span>
        <span className="rounded-full border border-[#ffffff]/20 px-2.5 py-1 text-[11px]">18+ · Play responsibly</span>
      </div>
      <nav className="mt-6 grid grid-cols-2 gap-y-2 text-[13px]">
        <Link href="/sports" className="hover:text-[var(--lime)]">Sports</Link>
        <Link href="/live" className="hover:text-[var(--lime)]">In play</Link>
        <Link href="/results" className="hover:text-[var(--lime)]">Results</Link>
        <Link href="/my-bets" className="hover:text-[var(--lime)]">My tickets</Link>
        <Link href="/casino" className="hover:text-[var(--lime)]">Casino</Link>
        <Link href="/deposit" className="hover:text-[var(--lime)]">Add funds</Link>
      </nav>
      <p className="mt-6 border-t border-[#ffffff]/15 pt-4 font-mono text-[11px] text-[#ffffff]/75">
        © {new Date().getFullYear()} Pitchside · Built by Isaac Adelore
      </p>
      <p className="mt-1 font-mono text-[11px] text-[#ffffff]/75">
        Photos from <a href="https://unsplash.com/license" className="underline">Unsplash</a>
      </p>
    </footer>
  );
}
