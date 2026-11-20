"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Moves smaller than 2% don't flash. */
const MIN_RELATIVE_MOVE = 0.02;

export type OddsChangeDirection = "up" | "down" | null;

type UseOddsChangePulseOptions = {
  durationMs?: number;
  enabled?: boolean;
  resetKey?: string;
};

export function useOddsChangePulse(
  value: number | null | undefined,
  { durationMs = 1800, enabled = true, resetKey = "" }: UseOddsChangePulseOptions = {}
) {
  const [direction, setDirection] = useState<OddsChangeDirection>(null);
  const previousValueRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const scheduleDirection = useCallback((nextDirection: OddsChangeDirection) => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setDirection(nextDirection);

      if (nextDirection !== null) {
        timeoutRef.current = window.setTimeout(() => {
          setDirection(null);
          timeoutRef.current = null;
        }, durationMs);
      }
    });
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    previousValueRef.current = null;
    scheduleDirection(null);
  }, [resetKey, scheduleDirection]);

  useEffect(() => {
    const nextValue = Number(value);

    if (!enabled || !Number.isFinite(nextValue) || nextValue <= 1) {
      previousValueRef.current = Number.isFinite(nextValue) && nextValue > 1 ? nextValue : null;
      scheduleDirection(null);
      return;
    }

    const previousValue = previousValueRef.current;
    previousValueRef.current = nextValue;

    if (previousValue === null || previousValue === nextValue) {
      return;
    }

    // In-play prices tick on every update; only flag moves a bettor would notice.
    if (Math.abs(nextValue - previousValue) / previousValue < MIN_RELATIVE_MOVE) {
      previousValueRef.current = previousValue;
      return;
    }

    const nextDirection: OddsChangeDirection = nextValue > previousValue ? "up" : "down";

    scheduleDirection(nextDirection);
  }, [enabled, scheduleDirection, value]);

  return direction;
}
