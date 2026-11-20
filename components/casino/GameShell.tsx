"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, LogIn, Wallet } from "lucide-react";
import { SimBadge } from "@/components/brand/SimBadge";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { casinoPayout, casinoStake } from "@/lib/engine/account";
import type { CasinoGame } from "@/lib/casino/games";
import { photo } from "@/lib/media";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

export function naira(value: number) {
  return `₦${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Stake/payout plumbing shared by every game, wired to the play-balance ledger. */
export function useCasinoWallet(game: string) {
  const balance = useUserStore((state) => state.currentUser?.availableBalance ?? 0);
  const refresh = useUserStore((state) => state.refreshCurrentUser);
  const [error, setError] = useState<string | null>(null);

  const stake = useCallback(
    (amount: number) => {
      const result = casinoStake(game, amount);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setError(null);
      void refresh().catch(() => undefined);
      return true;
    },
    [game, refresh],
  );

  const payout = useCallback(
    (amount: number) => {
      casinoPayout(game, amount);
      void refresh().catch(() => undefined);
    },
    [game, refresh],
  );

  return { balance, stake, payout, error, setError };
}

const CHIPS = [100, 500, 1000, 5000];

export function StakeControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl bg-[rgba(242,241,236,0.07)] p-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.max(50, Math.round(value / 2)))}
          className="h-10 w-12 rounded-xl bg-[rgba(242,241,236,0.12)] text-sm font-bold text-[var(--chalk)] disabled:opacity-40"
        >
          ½
        </button>
        <label className="flex flex-1 items-center gap-1 px-2">
          <span className="text-sm font-bold text-[var(--chalk)]/60">₦</span>
          <input
            inputMode="numeric"
            disabled={disabled}
            value={String(value)}
            onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "")) || 0)}
            className="w-full bg-transparent text-center font-mono text-lg font-bold text-[var(--chalk)] outline-none disabled:opacity-60"
            aria-label="Stake"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.min(1_000_000, value * 2))}
          className="h-10 w-12 rounded-xl bg-[rgba(242,241,236,0.12)] text-sm font-bold text-[var(--chalk)] disabled:opacity-40"
        >
          2×
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled}
            onClick={() => onChange(chip)}
            className={`h-8 rounded-lg text-xs font-bold transition disabled:opacity-40 ${
              value === chip ? "bg-[var(--lime)] text-[var(--ink)]" : "bg-[rgba(242,241,236,0.07)] text-[var(--chalk)]/80"
            }`}
          >
            {chip.toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameShell({
  game,
  balance,
  error,
  children,
}: {
  game: CasinoGame;
  balance: number;
  error?: string | null;
  children: ReactNode;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { openLogin } = useAuthModal();

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100dvh-60px)] bg-[var(--ink)] pb-28 text-[var(--chalk)]">
      <div className="relative h-36 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(game.photo, 900, 360)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[var(--ink)]/60 to-[var(--ink)]" />
        <div className="relative flex h-full flex-col justify-between p-3">
          <div className="flex items-center justify-between">
            <Link
              href="/casino"
              className="inline-flex items-center gap-1 rounded-full bg-black/40 py-1 pl-1.5 pr-3 text-xs font-semibold backdrop-blur"
            >
              <ChevronLeft size={14} /> Casino
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 font-mono text-xs font-bold backdrop-blur">
              <Wallet size={12} className="text-[var(--lime)]" />
              {naira(balance)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-[28px] font-extrabold leading-none tracking-tight">{game.name}</h1>
              <SimBadge />
            </div>
            <p className="mt-1 text-xs text-[var(--chalk)]/70">
              {game.tagline} · RTP {game.rtp}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-3 pt-2">
        {hasHydrated && !isAuthenticated ? (
          <div className="rounded-3xl bg-[rgba(242,241,236,0.07)] p-5 text-center">
            <p className="font-heading text-lg font-bold">Log in to play</p>
            <p className="mt-1 text-sm text-[var(--chalk)]/60">Use the demo account to play. It comes with a ₦50,000 balance.</p>
            <button
              type="button"
              onClick={() => openLogin(`/casino/${game.slug}`)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--lime)] px-5 py-2.5 text-sm font-bold text-[var(--ink)]"
            >
              <LogIn size={16} /> Log in
            </button>
          </div>
        ) : (
          children
        )}
        {error ? <p className="rounded-xl bg-[var(--flare)]/15 px-3 py-2 text-center text-sm text-[#FF8A8E]">{error}</p> : null}
        <p className="px-1 text-[11px] leading-4 text-[var(--chalk)]/40">{game.blurb}</p>
      </div>
    </div>
  );
}
