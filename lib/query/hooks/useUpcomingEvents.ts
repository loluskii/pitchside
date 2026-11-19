"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { UpcomingEvent } from "@/types";

async function getUpcomingEvents(
  sportId: number | string,
  period: string,
  limit: number,
  signal?: AbortSignal,
): Promise<UpcomingEvent[]> {
  const params = new URLSearchParams({
    sportId: String(sportId),
    period,
    limit: String(limit),
  });
  const response = await fetch(`/api/events/upcoming?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to load upcoming events");
  }

  return response.json() as Promise<UpcomingEvent[]>;
}

export function useUpcomingEvents(
  sportId: number | string = 1,
  period = "upcoming",
  limit = 6
) {
  return useQuery({
    queryKey: queryKeys.events.upcoming(sportId, period, limit),
    queryFn: ({ signal }) => getUpcomingEvents(sportId, period, limit, signal),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}
