"use client";

import { useState } from "react";
import { GameShell, StakeControl, naira, useCasinoWallet } from "@/components/casino/GameShell";
import { SPOT_KICK_ROUNDS, gameBySlug, randomInt, spotKickMultiplier } from "@/lib/casino/games";
import { photo } from "@/lib/media";

const GAME = gameBySlug("spot-kick")!;
const ZONES = ["Left", "Centre", "Right"] as const;

type Phase = "idle" | "shooting" | "missed" | "banked";
type Kick = { aim: number; dive: number; goal: boolean };

export function SpotKick() {
  const { balance, stake, payout, error } = useCasinoWallet("Spot Kick");
  const [amount, setAmount] = useState(500);
  const [phase, setPhase] = useState<Phase>("idle");
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [busy, setBusy] = useState(false);

  const goals = kicks.filter((k) => k.goal).length;
  const last = kicks.at(-1);
  const current = spotKickMultiplier(goals);
  const next = spotKickMultiplier(goals + 1);

  const start = () => {
    if (!stake(amount)) return;
    setKicks([]);
    setPhase("shooting");
  };

  const shoot = (aim: number) => {
    if (phase !== "shooting" || busy) return;
    setBusy(true);
    const dive = randomInt(3);
    const kick = { aim, dive, goal: dive !== aim };
    window.setTimeout(() => {
      const all = [...kicks, kick];
      setKicks(all);
      setBusy(false);
      if (!kick.goal) {
        setPhase("missed");
      } else if (all.length >= SPOT_KICK_ROUNDS) {
        payout(amount * spotKickMultiplier(all.length));
        setPhase("banked");
      }
    }, 450);
  };

  const bank = () => {
    if (phase !== "shooting" || !goals) return;
    payout(amount * current);
    setPhase("banked");
  };

  const keeperX = last ? ["18%", "50%", "82%"][last.dive] : "50%";

  return (
    <GameShell game={GAME} balance={balance} error={error}>
      <div className="relative overflow-hidden rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo("goalNet", 900, 520)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pitch-deep)] via-[var(--ink)]/50 to-[var(--ink)]/70" />
        <div className="relative px-4 pb-4 pt-5">
          {/* Goal frame */}
          <div className="relative mx-auto h-36 max-w-[300px] rounded-t-md border-x-4 border-t-4 border-[var(--chalk)]/90">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_11px,rgba(242,241,236,0.12)_11px_12px),repeating-linear-gradient(90deg,transparent_0_11px,rgba(242,241,236,0.12)_11px_12px)]" />
            <div className="absolute inset-0 grid grid-cols-3">
              {ZONES.map((zone, i) => (
                <button
                  key={zone}
                  type="button"
                  aria-label={`Shoot ${zone.toLowerCase()}`}
                  disabled={phase !== "shooting" || busy}
                  onClick={() => shoot(i)}
                  className="group relative flex items-center justify-center disabled:cursor-default"
                >
                  {phase === "shooting" && !busy ? (
                    <span className="h-10 w-10 rounded-full border-2 border-dashed border-[var(--lime)]/70 transition group-hover:scale-110 group-hover:bg-[var(--lime)]/25" />
                  ) : null}
                  {last && last.aim === i && phase !== "idle" ? (
                    <span className={`absolute text-3xl ${last.goal ? "" : "opacity-60"}`}>⚽</span>
                  ) : null}
                </button>
              ))}
            </div>
            {/* Keeper */}
            <div
              className="absolute bottom-0 h-20 w-14 -translate-x-1/2 transition-all duration-300"
              style={{ left: keeperX }}
              aria-hidden="true"
            >
              <div className="mx-auto h-5 w-5 rounded-full bg-[var(--amber)]" />
              <div className="mx-auto mt-0.5 h-10 w-12 rounded-t-xl bg-[var(--flare)]" />
              <div className="mx-auto flex w-9 justify-between">
                <span className="h-4 w-3 rounded-b bg-[var(--ink)]" />
                <span className="h-4 w-3 rounded-b bg-[var(--ink)]" />
              </div>
            </div>
          </div>
          <div className="mx-auto h-1 max-w-[340px] rounded bg-[var(--chalk)]/60" />

          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: SPOT_KICK_ROUNDS }).map((_, i) => {
              const k = kicks[i];
              return (
                <span
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    !k
                      ? "border border-[var(--chalk)]/25 text-[var(--chalk)]/40"
                      : k.goal
                        ? "bg-[var(--lime)] text-[var(--ink)]"
                        : "bg-[var(--flare)] text-[var(--chalk)]"
                  }`}
                >
                  {k ? (k.goal ? "✓" : "✕") : i + 1}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-[var(--chalk)]">
            {phase === "idle" && "Place a bet, then pick a corner."}
            {phase === "shooting" && (busy ? "…" : goals ? `${current.toFixed(2)}× now. Next goal pays ${next.toFixed(2)}×.` : "Pick a corner. A goal pays 1.45×.")}
            {phase === "missed" && "Saved. Round over."}
            {phase === "banked" && `You won ${naira(amount * current)}`}
          </p>
        </div>
      </div>

      <StakeControl value={amount} onChange={setAmount} disabled={phase === "shooting"} />

      {phase === "shooting" ? (
        <button
          type="button"
          onClick={bank}
          disabled={!goals || busy}
          className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)] disabled:opacity-40"
        >
          {goals ? `Cash out ${naira(amount * current)}` : "Score to cash out"}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="h-14 w-full rounded-2xl bg-[var(--chalk)] font-heading text-lg font-extrabold text-[var(--ink)]"
        >
          Bet {naira(amount)}
        </button>
      )}
    </GameShell>
  );
}
