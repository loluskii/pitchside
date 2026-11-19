import type { CouponSimulationState } from "@/store/couponStore";

const FIRST_HALF_END_SEC = 13;
const SECOND_HALF_START_SEC = 15;

export function getSimulationMatchMinute(simulation: CouponSimulationState) {
  if (simulation.status === "complete" || simulation.timerEnded) return 90;

  const currentTimeSec = Math.max(0, Number(simulation.currentTimeSec || 0));
  const durationSec = Math.max(Number(simulation.durationSec || 1), 1);
  const stage = simulation.currentStage;

  if (stage === "halftime_intro" || stage === "halftime_swap") return 45;

  if (stage.startsWith("h2_")) {
    const secondHalfDurationSec = Math.max(durationSec - SECOND_HALF_START_SEC, 1);
    const secondHalfElapsedSec = Math.max(0, currentTimeSec - SECOND_HALF_START_SEC);
    return Math.min(90, 45 + Math.round((secondHalfElapsedSec / secondHalfDurationSec) * 45));
  }

  return Math.min(
    45,
    Math.round((Math.min(currentTimeSec, FIRST_HALF_END_SEC) / FIRST_HALF_END_SEC) * 45),
  );
}

export function getSimulationProgressPercent(simulation: CouponSimulationState) {
  return Math.min((getSimulationMatchMinute(simulation) / 90) * 100, 100);
}
