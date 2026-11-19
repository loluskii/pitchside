"use client";

import { Check, Clock3, X } from "lucide-react";
import type {
  CouponSelection,
  CouponSimulationEvent,
  CouponSimulationSelectionResult,
  CouponSimulationState,
} from "@/store/couponStore";
import { SimulationPitch } from "@/components/betting/SimulationPitch";
import { getSimulationMatchMinute } from "@/components/betting/simulation-clock";

interface SimulationEventCardProps {
  event?: CouponSimulationEvent;
  result?: CouponSimulationSelectionResult;
  selection: CouponSelection;
  showPitch: boolean;
  simulation: CouponSimulationState;
}

function splitTeams(selection: CouponSelection) {
  if (selection.homeTeam || selection.awayTeam) {
    return { home: selection.homeTeam || "Home", away: selection.awayTeam || "Away" };
  }
  for (const separator of [" vs ", " vs. ", " v ", " - ", " @ "]) {
    if (selection.eventName.includes(separator)) {
      const [home, away] = selection.eventName.split(separator).map((value) => value.trim());
      return { home: home || "Home", away: away || "Away" };
    }
  }
  return { home: "Home", away: "Away" };
}

function getScore(event: CouponSimulationEvent | undefined, phase: number, ended: boolean) {
  if (!event) return { home: 0, away: 0 };
  if (ended) return { home: event.homeGoals, away: event.awayGoals };
  const goals = event.goalEvents || [];
  const h1Home = goals.filter((goal) => goal.team === "home" && goal.minute <= 45).length;
  const h1Away = goals.filter((goal) => goal.team === "away" && goal.minute <= 45).length;
  const h2Home = goals.filter((goal) => goal.team === "home" && goal.minute > 45).length;
  const h2Away = goals.filter((goal) => goal.team === "away" && goal.minute > 45).length;
  if (phase <= 0) return { home: 0, away: 0 };
  if (phase === 1) return { home: h1Home, away: 0 };
  if (phase === 2) return { home: h1Home, away: h1Away };
  if (phase === 3) return { home: h1Home + h2Home, away: h1Away };
  return { home: h1Home + h2Home, away: h1Away + h2Away };
}

export function SimulationEventCard({
  event,
  result,
  selection,
  showPitch,
  simulation,
}: SimulationEventCardProps) {
  const teams = splitTeams(selection);
  const completed = simulation.status === "complete" || simulation.timerEnded;
  const score = getScore(event, simulation.scorePhase, completed);
  const hasResult = completed && result?.won != null;
  const resultIsWin = result?.won === true;
  const matchMinute = getSimulationMatchMinute(simulation);

  return (
    <article className="rounded-xl border border-white/8 bg-surface-simulation p-2.5 shadow-sm">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <p className="min-w-0 truncate text-left text-sm font-bold text-white">{teams.home}</p>
        <div className="text-center">
          <p className="text-2xl font-black text-white">{score.home} - {score.away}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted-4">
            {completed ? "FT" : `${matchMinute}'`}
          </p>
        </div>
        <p className="min-w-0 truncate text-right text-sm font-bold text-white">{teams.away}</p>
      </div>

      {showPitch ? (
        <SimulationPitch selection={selection} event={event} simulation={simulation} />
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/8 pt-2.5 text-sm">
        <div className="min-w-0">
          <p className="truncate font-bold text-[#2D2E28]">{selection.marketName}</p>
          <p className="mt-1 truncate text-[#6B6E60]">{selection.outcomeName} @ {Number(selection.odds || 0).toFixed(2)}</p>
        </div>
        {hasResult ? (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${resultIsWin ? "bg-[#E2F5E9] text-text-green-bright" : "bg-[#FDECEC] text-text-error-light"}`}>
            {resultIsWin ? <Check size={12} /> : <X size={12} />}
            {resultIsWin ? "Won" : "Lost"}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-text-muted-4">
            <Clock3 size={12} /> Pending
          </span>
        )}
      </div>
    </article>
  );
}
