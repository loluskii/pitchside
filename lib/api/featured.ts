import type { FeaturedTournamentGroup } from "@/types";

export const featuredApi = {
  async getFeaturedEvents(signal?: AbortSignal): Promise<FeaturedTournamentGroup[]> {
    const response = await fetch("/api/events/featured", {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error("Failed to load featured events");
    }

    return response.json() as Promise<FeaturedTournamentGroup[]>;
  },
};
