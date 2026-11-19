"use client";

import { useQuery } from "@tanstack/react-query";
import { featuredApi } from "@/lib/api/featured";
import { queryKeys } from "@/lib/query/keys";

export function useFeaturedEvents() {
  return useQuery({
    queryKey: queryKeys.events.featured(),
    queryFn: ({ signal }) => featuredApi.getFeaturedEvents(signal),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}
