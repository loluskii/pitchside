"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { LiveEvent } from "@/types";

async function getLiveEvents(
  sportId: number | string,
  limit: number,
  signal?: AbortSignal,
): Promise<LiveEvent[]> {
  const params = new URLSearchParams({
    sportId: String(sportId),
    limit: String(limit),
  });
  const response = await fetch(`/api/events/live?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to load live events");
  }

  return response.json() as Promise<LiveEvent[]>;
}

export function useLiveEvents(sportId: number | string = 1, limit = 6) {
  return useQuery({
    queryKey: queryKeys.events.live(sportId, limit),
    queryFn: ({ signal }) => getLiveEvents(sportId, limit, signal),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: 0,
    gcTime: 5 * 60_000,
  });
}
