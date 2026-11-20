"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell, StakeControl, naira, useCasinoWallet } from "@/components/casino/GameShell";
import { gameBySlug, liftoffCrashPoint, liftoffMultiplier } from "@/lib/casino/games";

type Phase = "idle" | "flying" | "cashed" | "crashed";

const GAME = gameBySlug("liftoff")!;

export function Liftoff() {
  const { balance, stake, payout, error } = useCasinoWallet("Liftoff");
  const [amount, setAmount] = useState(500);
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const crashRef = useRef(1);
  const startRef = useRef(0);
  const frameRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const finish = (crash: number) => {
    setMultiplier(crash);
    setHistory((h) => [crash, ...h].slice(0, 12));
    setRunning(false);
    if (phaseRef.current === "flying") {
      phaseRef.current = "crashed";
      setPhase("crashed");
    }
  };

  const tick = () => {
    const elapsed = performance.now() - startRef.current;
    const value = liftoffMultiplier(elapsed);
    if (value >= crashRef.current) {
      finish(crashRef.current);
      return;
    }
    setMultiplier(value);
    setPoints((p) => [...p, [elapsed / 1000, value] as [number, number]].slice(-240));
    frameRef.current = requestAnimationFrame(tick);
  };

  const launch = () => {
    if (!stake(amount)) return;
    crashRef.current = liftoffCrashPoint();
    startRef.current = performance.now();
    phaseRef.current = "flying";
    setPhase("flying");
    setRunning(true);
    setCashedAt(null);
    setMultiplier(1);
    setPoints([[0, 1]]);
    frameRef.current = requestAnimationFrame(tick);
  };

  const cashOut = () => {
    if (phaseRef.current !== "flying") return;
    phaseRef.current = "cashed";
    setPhase("cashed");
    setCashedAt(multiplier);
    payout(amount * multiplier);
    // The flight keeps going so the player sees where it would have ended.
  };

  const flying = phase === "flying";

  // Curve geometry
  const maxT = Math.max(8, points.at(-1)?.[0] ?? 0);
  const maxM = Math.max(2, multiplier * 1.15);
  const path = points
    .map(([t, m], i) => `${i ? "L" : "M"}${(t / maxT) * 300},${150 - ((m - 1) / (maxM - 1)) * 140}`)
    .join(" ");
  const tip = points.at(-1);

  return (
    <GameShell game={GAME} balance={balance} error={error}>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {history.length ? (
          history.map((h, i) => (
            <span
              key={`${h}-${i}`}
              className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
                h >= 2 ? "bg-[var(--lime)]/20 text-[var(--lime)]" : "bg-[rgba(242,241,236,0.08)] text-[var(--chalk)]/70"
              }`}
            >
              {h.toFixed(2)}×
            </span>
          ))
        ) : (
          <span className="text-[11px] text-[var(--chalk)]/40">Previous rounds show here</span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[rgba(242,241,236,0.08)] bg-[#0B110E]">
        <svg viewBox="0 0 300 160" className="block h-56 w-full" preserveAspectRatio="none">
          {[40, 80, 120].map((y) => (
            <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(242,241,236,0.06)" />
          ))}
          {path ? (
            <>
              <path d={`${path} L${tip ? (tip[0] / maxT) * 300 : 0},160 L0,160 Z`} fill="rgba(203,234,78,0.12)" />
              <path d={path} fill="none" stroke={phase === "crashed" ? "#E0393E" : "#CBEA4E"} strokeWidth="2.5" />
            </>
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-heading text-6xl font-extrabold tabular-nums tracking-tight ${
              phase === "crashed" ? "text-[var(--flare)]" : "text-[var(--chalk)]"
            }`}
          >
            {multiplier.toFixed(2)}×
          </span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chalk)]/50">
            {phase === "idle" && "Place a bet to start"}
            {phase === "flying" && "Round in progress"}
            {phase === "crashed" && "Crashed"}
            {phase === "cashed" && !running && cashedAt ? `Crashed. You cashed out at ${cashedAt.toFixed(2)}×` : null}
            {phase === "cashed" && running && cashedAt ? `You won ${naira(amount * cashedAt)}` : null}
          </span>
        </div>
      </div>

      <StakeControl value={amount} onChange={setAmount} disabled={flying} />

      {flying ? (
        <button
          type="button"
          onClick={cashOut}
          className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)] shadow-[0_8px_30px_rgba(203,234,78,0.35)]"
        >
          Cash out {naira(amount * multiplier)}
        </button>
      ) : (
        <button
          type="button"
          onClick={launch}
          disabled={running}
          className="h-14 w-full rounded-2xl bg-[var(--chalk)] font-heading text-lg font-extrabold text-[var(--ink)] disabled:opacity-50"
        >
          {running ? "Waiting for the round to end" : `Bet ${naira(amount)}`}
        </button>
      )}
    </GameShell>
  );
}
