"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HALF_TIME_MARKS = new Set([45 * 60, 90 * 60]);

function normalizeDisplayTime(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "00:00";
}

function parseTimeToSeconds(timeValue: string): number | null {
  if (timeValue === "--:--") return null;
  const parts = timeValue.split(":").map(Number);
  if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) return null;
  return parts[0] * 60 + parts[1];
}

function formatSecondsToTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function useLiveTimer(initialTime: string | null | undefined) {
  const timerRef = useRef<number | null>(null);
  const currentSecondsRef = useRef<number | null>(parseTimeToSeconds(normalizeDisplayTime(initialTime)));
  const [displayTime, setDisplayTime] = useState(() => normalizeDisplayTime(initialTime));

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncDisplayTime = useCallback(
    (nextValue: string | null | undefined) => {
      const nextDisplayTime = normalizeDisplayTime(nextValue);
      const nextSeconds = parseTimeToSeconds(nextDisplayTime);
      const currentSeconds = currentSecondsRef.current;

      if (nextSeconds !== null && currentSeconds !== null && nextSeconds < currentSeconds) {
        return;
      }

      stopTimer();
      currentSecondsRef.current = nextSeconds;
      setDisplayTime(nextDisplayTime);

      if (nextSeconds === null || HALF_TIME_MARKS.has(nextSeconds)) {
        return;
      }

      timerRef.current = window.setInterval(() => {
        const currentValue = currentSecondsRef.current;
        if (currentValue === null) {
          stopTimer();
          return;
        }

        const updatedSeconds = currentValue + 1;
        currentSecondsRef.current = updatedSeconds;
        setDisplayTime(formatSecondsToTime(updatedSeconds));

        if (HALF_TIME_MARKS.has(updatedSeconds)) {
          stopTimer();
        }
      }, 1000);
    },
    [stopTimer]
  );

  useEffect(() => {
    syncDisplayTime(initialTime);
  }, [initialTime, syncDisplayTime]);

  useEffect(() => stopTimer, [stopTimer]);

  return { displayTime, stopTimer, syncDisplayTime };
}
