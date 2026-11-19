"use client";

import { useState } from "react";
import { GameShell, StakeControl, naira, useCasinoWallet } from "@/components/casino/GameShell";
import { diceRoll, dicePayout, gameBySlug } from "@/lib/casino/games";

const GAME = gameBySlug("dice")!;

export function Dice() {
  const { balance, stake, payout, error } = useCasinoWallet("Dice Duel");
  const [amount, setAmount] = useState(500);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<"over" | "under">("over");
  const [roll, setRoll] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ value: number; won: boolean }[]>([]);

  const multiplier = dicePayout(target, mode);
  const chance = mode === "over" ? 100 - target : target;

  const play = () => {
    if (rolling || !stake(amount)) return;
    setRolling(true);
    const value = diceRoll();
    const win = mode === "over" ? value > target : value < target;
    let frames = 0;
    const spin = window.setInterval(() => {
      setRoll(Math.floor(Math.random() * 10000) / 100);
      frames += 1;
      if (frames >= 8) {
        window.clearInterval(spin);
        setRoll(value);
        setWon(win);
        setRolling(false);
        setHistory((h) => [{ value, won: win }, ...h].slice(0, 10));
        if (win) payout(amount * multiplier);
      }
    }, 55);
  };

  return (
    <GameShell game={GAME} balance={balance} error={error}>
      <div className="rounded-3xl bg-[rgba(242,241,236,0.06)] p-4">
        <div className="text-center">
          <span
            className={`font-heading text-6xl font-extrabold tabular-nums ${
              won === null || rolling ? "text-[var(--chalk)]" : won ? "text-[var(--lime)]" : "text-[var(--flare)]"
            }`}
          >
            {roll === null ? "--.--" : roll.toFixed(2)}
          </span>
          <p className="mt-1 h-4 text-xs font-semibold text-[var(--chalk)]/60">
            {!rolling && won !== null ? (won ? `Won ${naira(amount * multiplier)}` : "No luck this roll") : ""}
          </p>
        </div>

        {/* Track */}
        <div className="relative mt-5 h-3 rounded-full bg-[var(--flare)]/70">
          <div
            className="absolute inset-y-0 rounded-full bg-[var(--lime)]"
            style={mode === "over" ? { left: `${target}%`, right: 0 } : { left: 0, width: `${target}%` }}
          />
          {roll !== null ? (
            <span
              className="absolute -top-2 h-7 w-1.5 -translate-x-1/2 rounded bg-[var(--chalk)] shadow transition-all duration-75"
              style={{ left: `${roll}%` }}
            />
          ) : null}
        </div>
        <input
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={rolling}
          onChange={(event) => setTarget(Number(event.target.value))}
          className="mt-3 w-full accent-[var(--lime)]"
          aria-label="Target"
        />
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ["Target", target.toFixed(0)],
            ["Win chance", `${chance}%`],
            ["Payout", `${multiplier.toFixed(2)}×`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[rgba(242,241,236,0.06)] py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--chalk)]/45">{label}</p>
              <p className="font-mono text-sm font-bold text-[var(--chalk)]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[rgba(242,241,236,0.06)] p-1">
          {(["under", "over"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={rolling}
              onClick={() => setMode(m)}
              className={`h-9 rounded-lg text-sm font-bold capitalize ${
                mode === m ? "bg-[var(--chalk)] text-[var(--ink)]" : "text-[var(--chalk)]/70"
              }`}
            >
              Roll {m}
            </button>
          ))}
        </div>
      </div>

      <StakeControl value={amount} onChange={setAmount} disabled={rolling} />

      <button
        type="button"
        onClick={play}
        disabled={rolling}
        className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)] disabled:opacity-60"
      >
        {rolling ? "Rolling…" : `Roll · ${naira(amount)}`}
      </button>

      {history.length ? (
        <div className="flex flex-wrap gap-1.5">
          {history.map((h, i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
                h.won ? "bg-[var(--lime)]/20 text-[var(--lime)]" : "bg-[var(--flare)]/20 text-[#FF8A8E]"
              }`}
            >
              {h.value.toFixed(2)}
            </span>
          ))}
        </div>
      ) : null}
    </GameShell>
  );
}
