"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CouponSelection,
  CouponSimulationEvent,
  CouponSimulationState,
} from "@/store/couponStore";
import { getTeamFallbackLogo, getTeamLogoUrl } from "@/lib/utils/sports";
import { getSimulationProgressPercent } from "@/components/betting/simulation-clock";

interface SimulationPitchProps {
  selection: CouponSelection;
  event?: CouponSimulationEvent;
  simulation: CouponSimulationState;
  shared?: boolean;
}

const MEDIA = {
  away: {
    goal: { 1: "/images/SIM/Away_Goal_H1.gif", 2: "/images/SIM/Away_Goal_H2.gif" },
    noGoal: { 1: "/images/SIM/Away_NoGoal_H1.gif", 2: "/images/SIM/Away_NoGoal_H2.gif" },
  },
  home: {
    goal: { 1: "/images/SIM/Home_Goal_H1.gif", 2: "/images/SIM/Home_Goal_H2.gif" },
    noGoal: { 1: "/images/SIM/Home_NoGoal_H1.gif", 2: "/images/SIM/Home_NoGoal_H2.gif" },
  },
  start: "/images/SIM/SIM_START.gif",
} as const;

function splitTeams(selection: CouponSelection) {
  if (selection.homeTeam || selection.awayTeam) {
    return {
      home: selection.homeTeam || "Home",
      away: selection.awayTeam || "Away",
    };
  }

  for (const separator of [" vs ", " vs. ", " v ", " - ", " @ "]) {
    if (selection.eventName.includes(separator)) {
      const [home, away] = selection.eventName.split(separator).map((value) => value.trim());
      return { home: home || "Home", away: away || "Away" };
    }
  }

  return { home: "Home", away: "Away" };
}

function getHalfGoals(event: CouponSimulationEvent | undefined, team: "home" | "away", half: 1 | 2) {
  return (event?.goalEvents || []).filter(
    (goal) => goal.team === team && (half === 1 ? goal.minute <= 45 : goal.minute > 45),
  );
}

function getScore(event: CouponSimulationEvent | undefined, phase: number, ended: boolean) {
  if (!event) return { home: 0, away: 0 };
  if (ended) return { home: event.homeGoals, away: event.awayGoals };

  const h1Home = getHalfGoals(event, "home", 1).length;
  const h1Away = getHalfGoals(event, "away", 1).length;
  const h2Home = getHalfGoals(event, "home", 2).length;
  const h2Away = getHalfGoals(event, "away", 2).length;

  if (phase <= 0) return { home: 0, away: 0 };
  if (phase === 1) return { home: h1Home, away: 0 };
  if (phase === 2) return { home: h1Home, away: h1Away };
  if (phase === 3) return { home: h1Home + h2Home, away: h1Away };
  return { home: h1Home + h2Home, away: h1Away + h2Away };
}

function getMedia(event: CouponSimulationEvent | undefined, stage: CouponSimulationState["currentStage"]) {
  if (stage === "start") return MEDIA.start;
  // Keep the last clip visible under the halftime/fulltime overlays, matching
  // the reference flow instead of replacing it with a second static field.
  const half = stage.startsWith("h1_") || stage.startsWith("halftime_") ? 1 : 2;
  const team = stage.includes("_away_") || stage.startsWith("halftime_") || stage === "fulltime" ? "away" : "home";
  const hasGoal = getHalfGoals(event, team, half).length > 0;
  return MEDIA[team][hasGoal ? "goal" : "noGoal"][half];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TeamLogo({ name, side }: { name: string; side: "home" | "away" }) {
  const [failed, setFailed] = useState(false);
  const logo = getTeamLogoUrl(name);

  return failed ? (
    <img src={getTeamFallbackLogo(side)} alt={`${name} placeholder`} className="h-10 w-10 object-contain" />
  ) : (
    <img
      src={logo}
      alt={`${name} logo`}
      className="h-10 w-10 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function SimulationPitch({ selection, event, simulation, shared = false }: SimulationPitchProps) {
  const teams = useMemo(() => splitTeams(selection), [selection]);
  const stage = simulation.currentStage;
  const completed = simulation.status === "complete" || simulation.timerEnded;
  const displayStage = completed ? "fulltime" : stage;
  const media = getMedia(event, displayStage);
  const score = getScore(event, simulation.scorePhase, completed);
  const progressPercent = getSimulationProgressPercent(simulation);
  const isBannerStage = !completed && stage.endsWith("_banner");
  const isHalftime = !completed && (stage === "halftime_intro" || stage === "halftime_swap");
  const isStart = !completed && stage === "start";
  const isFulltime = completed || stage === "fulltime";

  useEffect(() => {
    const sources = [
      MEDIA.start,
      MEDIA.home.goal[1],
      MEDIA.home.goal[2],
      MEDIA.home.noGoal[1],
      MEDIA.home.noGoal[2],
      MEDIA.away.goal[1],
      MEDIA.away.goal[2],
      MEDIA.away.noGoal[1],
      MEDIA.away.noGoal[2],
    ];
    sources.forEach((source) => {
      const image = new Image();
      image.src = source;
    });
  }, []);

  const half = stage.startsWith("h1_") ? 1 : 2;
  const team = stage.includes("_away_") ? "away" : "home";
  const teamName = team === "home" ? teams.home : teams.away;
  const goalsInHalf = getHalfGoals(event, team, half).length;
  const totalGoals =
    team === "home"
      ? getHalfGoals(event, "home", 1).length + getHalfGoals(event, "home", 2).length
      : getHalfGoals(event, "away", 1).length + getHalfGoals(event, "away", 2).length;

  return (
    <div className={`w-full ${shared ? "" : "mt-3"}`}>
      <div className="relative h-[168px] overflow-hidden rounded-xl border border-white/10 bg-surface-simulation">
        <img key={media} src={media} alt="Simulation pitch" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(246, 246, 245, 0.08),_rgba(248, 248, 247, 0.68))]" />

        {isStart ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-4">
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-surface-simulation/85 px-3 py-3 text-center shadow-lg">
              <TeamLogo name={teams.home} side="home" />
              <p className="min-w-0 flex-1 text-sm font-bold leading-5 text-white">{selection.eventName}</p>
              <TeamLogo name={teams.away} side="away" />
            </div>
          </div>
        ) : isHalftime ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-4">
            <div className="rounded-xl border border-[#2563EB]/30 bg-surface-simulation/88 px-4 py-3 text-center">
              <p className="text-3xl font-black uppercase text-white">Half time</p>
              <p className="mt-1 text-3xl font-black text-[#0C7A4D]">{getScore(event, 2, false).home} - {getScore(event, 2, false).away}</p>
            </div>
          </div>
        ) : isFulltime ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-4">
            <div className="w-full rounded-xl border border-[#0C7A4D]/30 bg-surface-simulation/90 px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <TeamLogo name={teams.home} side="home" />
                <p className="text-3xl font-black text-white">{score.home} - {score.away}</p>
                <TeamLogo name={teams.away} side="away" />
              </div>
              <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2C2D27]">FULL TIME</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[#4F5046]">{selection.eventName}</p>
            </div>
          </div>
        ) : isBannerStage ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-4">
            <div className="rounded-xl border border-white/12 bg-surface-simulation/88 px-4 py-3 text-center shadow-lg">
              <p className="text-3xl font-black uppercase text-white">
                {goalsInHalf > 0 ? `Goal! x${totalGoals}` : "No Goal"}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#2C2D27]">{teamName}</p>
            </div>
          </div>
        ) : null}

      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#E8F0FE] to-[#2563EB] transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
