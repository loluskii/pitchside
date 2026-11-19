import type { SportEvent } from "./events";

export interface FeaturedEvent extends SportEvent {
  categoryName?: string;
}

export interface FeaturedTournamentGroup {
  tournamentId: string;
  sportId: string;
  categoryId: string;
  tournamentName: string;
  categoryName: string;
  logoUrl?: string;
  fixtures: FeaturedEvent[];
}
