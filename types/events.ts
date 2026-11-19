import type { League, Sport } from "./sports";

export type EventStatus = "upcoming" | "live" | "finished" | "suspended";

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
}

export interface Score {
  home: number;
  away: number;
  period?: string;
}

export interface MarketOdds {
  home: number;
  draw?: number;
  away: number;
}

export interface Market {
  id: string;
  name: string;
  type: MarketType;
  odds: Record<string, number>;
  suspended?: boolean;
  specifier?: string;
  marketExtendVOS?: Array<{
    name?: string;
    rootMarketId?: string | number;
    nodeMarketId?: string | number;
    nodeSpecifier?: string;
    notSupport?: boolean;
  }>;
}

export type MarketType =
  | "1x2"
  | "over_under"
  | "double_chance"
  | "handicap"
  | "both_teams_score"
  | "first_half_1x2"
  | "first_half_ou";

export interface SportEvent {
  id: string;
  sport: Sport;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  status: EventStatus;
  startTime: string;
  marketCount?: number;
  score?: Score;
  minute?: number;
  period?: string;
  markets: Market[];
  fixtureMarkets?: Array<{
    marketID?: number | string;
    marketName?: string;
    specifier?: string;
    statusName?: string;
    marketExtendVOS?: Market["marketExtendVOS"];
    outcomes?: Array<{
      outcomeID?: number | string;
      outcomeName?: string;
      displayName?: string;
      odds?: number | string;
      active?: number | boolean;
      specifier?: string;
    }>;
  }>;
  featured?: boolean;
  hot?: boolean;
}

export interface LiveEvent extends SportEvent {
  status: "live";
  score: Score;
  minute: number;
}

export interface UpcomingEvent extends SportEvent {
  status: "upcoming";
}
