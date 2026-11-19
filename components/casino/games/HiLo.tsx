"use client";

import { useState } from "react";
import { GameShell, StakeControl, naira, useCasinoWallet } from "@/components/casino/GameShell";
import { RANKS, drawCard, gameBySlug, hiLoStep, type Card } from "@/lib/casino/games";

const GAME = gameBySlug("hi-lo")!;

function PlayingCard({ card, faded }: { card: Card; faded?: boolean }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className={`relative flex shrink-0 flex-col justify-between bg-[var(--paper)] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
        faded ? "h-20 w-14 rounded-xl p-1.5 opacity-70" : "h-36 w-24 rounded-2xl p-2.5"
      }`}
      style={{ color: red ? "#C8262B" : "#121A16" }}
    >
      <span className={`font-heading font-extrabold leading-none ${faded ? "text-sm" : "text-2xl"}`}>{RANKS[card.rank]}</span>
      <span className={`self-center ${faded ? "text-lg" : "text-5xl"}`}>{card.suit}</span>
      <span className={`self-end rotate-180 font-heading font-extrabold leading-none ${faded ? "text-sm" : "text-2xl"}`}>
        {RANKS[card.rank]}
      </span>
    </div>
  );
}

export function HiLo() {
  const { balance, stake, payout, error } = useCasinoWallet("Hi-Lo");
  const [amount, setAmount] = useState(500);
  const [card, setCard] = useState<Card>(() => ({ rank: 6, suit: "♠" }));
  const [trail, setTrail] = useState<Card[]>([]);
  const [multiplier, setMultiplier] = useState(1);
  const [phase, setPhase] = useState<"idle" | "playing" | "lost" | "banked">("idle");

  const higher = hiLoStep(card.rank, "higher");
  const lower = hiLoStep(card.rank, "lower");

  const deal = () => {
    if (!stake(amount)) return;
    setCard(drawCard());
    setTrail([]);
    setMultiplier(1);
    setPhase("playing");
  };

  const call = (direction: "higher" | "lower") => {
    const step = direction === "higher" ? higher : lower;
    if (phase !== "playing" || !step) return;
    const next = drawCard();
    const correct = direction === "higher" ? next.rank > card.rank : next.rank < card.rank;
    setTrail((t) => [card, ...t].slice(0, 6));
    setCard(next);
    if (correct) setMultiplier((m) => Math.round(m * step * 100) / 100);
    else setPhase("lost");
  };

  const bank = () => {
    if (phase !== "playing" || multiplier <= 1) return;
    payout(amount * multiplier);
    setPhase("banked");
  };

  return (
    <GameShell game={GAME} balance={balance} error={error}>
      <div className="rounded-3xl bg-[var(--pitch-deep)] p-4">
        <div className="flex items-center justify-center gap-4">
          <PlayingCard card={card} />
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--chalk)]/55">Current</p>
            <p className="font-heading text-4xl font-extrabold tabular-nums text-[var(--chalk)]">{multiplier.toFixed(2)}×</p>
            <p className="text-xs font-semibold text-[var(--chalk)]/70">
              {phase === "idle" && "Deal to start"}
              {phase === "playing" && (multiplier > 1 ? `Worth ${naira(amount * multiplier)}` : "Make your first call")}
              {phase === "lost" && <span className="text-[#FF8A8E]">Wrong call — round over</span>}
              {phase === "banked" && <span className="text-[var(--lime)]">Banked {naira(amount * multiplier)}</span>}
            </p>
          </div>
        </div>
        <div className="mt-4 flex h-20 items-center gap-1.5 overflow-hidden">
          {trail.map((c, i) => (
            <PlayingCard key={i} card={c} faded />
          ))}
        </div>
      </div>

      {phase === "playing" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!higher}
              onClick={() => call("higher")}
              className="rounded-2xl bg-[var(--chalk)] py-3 text-[var(--ink)] disabled:opacity-30"
            >
              <span className="block font-heading text-lg font-extrabold">Higher ↑</span>
              <span className="font-mono text-xs font-bold">{higher ? `${higher.toFixed(2)}×` : "—"}</span>
            </button>
            <button
              type="button"
              disabled={!lower}
              onClick={() => call("lower")}
              className="rounded-2xl bg-[var(--chalk)] py-3 text-[var(--ink)] disabled:opacity-30"
            >
              <span className="block font-heading text-lg font-extrabold">Lower ↓</span>
              <span className="font-mono text-xs font-bold">{lower ? `${lower.toFixed(2)}×` : "—"}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={bank}
            disabled={multiplier <= 1}
            className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)] disabled:opacity-40"
          >
            {multiplier > 1 ? `Bank ${naira(amount * multiplier)}` : "Win a call to bank"}
          </button>
        </>
      ) : (
        <>
          <StakeControl value={amount} onChange={setAmount} />
          <button
            type="button"
            onClick={deal}
            className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)]"
          >
            Deal · {naira(amount)}
          </button>
        </>
      )}
      <p className="px-1 text-[11px] text-[var(--chalk)]/40">Ties lose. Aces are low, Kings are high.</p>
    </GameShell>
  );
}
