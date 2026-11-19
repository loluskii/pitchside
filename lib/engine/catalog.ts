// The simulated sporting world: sports, regions, competitions and clubs.
// Every club and competition here is fictional.

export type SportKey = "football" | "basketball";

export type SportDef = {
  id: number;
  key: SportKey;
  /** Name as the feed reports it (football is "Soccer" upstream). */
  feedName: string;
  /** Real minutes between kick-offs in one competition. */
  slotMinutes: number;
  /** Real minutes a fixture stays in play. */
  liveMinutes: number;
  matchesPerSlot: number;
};

export type LeagueDef = {
  id: number;
  sportId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  /** Minutes added to the slot grid so competitions don't all kick off together. */
  offset: number;
  priority: number;
  /** 0..1, scales scoring. */
  tempo: number;
  teams: string[];
};

export const SPORTS: SportDef[] = [
  { id: 1, key: "football", feedName: "Soccer", slotMinutes: 60, liveMinutes: 105, matchesPerSlot: 3 },
  { id: 2, key: "basketball", feedName: "Basketball", slotMinutes: 120, liveMinutes: 108, matchesPerSlot: 3 },
];

export const LEAGUES: LeagueDef[] = [
  {
    id: 1101, sportId: 1, categoryId: 11, categoryName: "England", name: "Premier Division",
    offset: 0, priority: 100, tempo: 1.0,
    teams: ["Kingsbridge Rovers", "Ashford Vale", "Hollins United", "Marrow Town", "Westgate Albion", "Corby Athletic",
      "Fenwick City", "Redmoor", "Selby Harriers", "Thornbury", "Mayfield Wanderers", "Northam County"],
  },
  {
    id: 1201, sportId: 1, categoryId: 12, categoryName: "Spain", name: "Liga Primera",
    offset: 10, priority: 95, tempo: 0.92,
    teams: ["Real Alcoria", "Atlético Sorra", "CD Villaverde", "Deportivo Marena", "Sporting Teruca", "Unión Calvera",
      "Racing Almonte", "CF Benissa", "Real Ondara", "CD Portela", "Atlético Sur", "UD Ribera"],
  },
  {
    id: 1301, sportId: 1, categoryId: 13, categoryName: "Italy", name: "Serie Uno",
    offset: 20, priority: 90, tempo: 0.88,
    teams: ["AC Valdera", "Lucca Nord", "US Ferrano", "Atletico Brenta", "FC Montelupo", "Virtus Arezzi",
      "Calcio Trevano", "AS Pontina", "Real Sabbia", "US Collina", "Varese Sud", "FC Lago Nero"],
  },
  {
    id: 1401, sportId: 1, categoryId: 14, categoryName: "Germany", name: "Erste Liga",
    offset: 30, priority: 88, tempo: 1.1,
    teams: ["FC Rheinfeld", "SV Ostwald", "Borussia Hagen", "VfB Talheim", "1. FC Lindau", "SC Wernau",
      "TSV Mittelberg", "Eintracht Kalden", "FSV Brückner", "SpVgg Altdorf", "Union Hesel", "SV Grünau"],
  },
  {
    id: 1501, sportId: 1, categoryId: 15, categoryName: "Nigeria", name: "National League",
    offset: 40, priority: 92, tempo: 0.85,
    teams: ["Lagoon City", "Abuja Capitals", "Ibadan Royals", "Ogun Warriors", "Delta Tide", "Calabar Coast",
      "Kaduna Falcons", "Jos Highlanders", "Benin Kings", "Ilorin Stars", "Owerri Spartans", "Port Harcourt Mariners"],
  },
  {
    id: 1601, sportId: 1, categoryId: 16, categoryName: "France", name: "Ligue Élite",
    offset: 50, priority: 84, tempo: 0.95,
    teams: ["AS Morlaix", "Olympique Valence", "FC Arvent", "Stade Ronan", "RC Lorvière", "US Carnac",
      "AC Bellême", "Union Médoc", "FC Sarlat", "Stade Aubrac", "SC Pornic", "Racing Cévennes"],
  },
  {
    id: 2101, sportId: 2, categoryId: 21, categoryName: "USA", name: "Pro League",
    offset: 15, priority: 80, tempo: 1.0,
    teams: ["Bay City Comets", "Desert Hawks", "Harbor Kings", "Mountain Owls", "Prairie Storm", "River Wolves",
      "Summit Titans", "Lakeshore Sharks", "Canyon Riders", "Metro Knights", "Coastal Waves", "Northern Lights"],
  },
  {
    id: 2201, sportId: 2, categoryId: 22, categoryName: "Europe", name: "Continental Cup",
    offset: 75, priority: 76, tempo: 0.92,
    teams: ["Madrid Norte", "Belgrade Iron", "Kaunas Amber", "Athens Owls", "Istanbul Bridges", "Milano Sud",
      "Berlin Spree", "Lyon Lumière", "Riga Pines", "Valencia Mar", "Munich Isar", "Porto Ribeira"],
  },
];

export function getSport(id: number | string): SportDef | undefined {
  return SPORTS.find((sport) => String(sport.id) === String(id));
}

export function getLeague(id: number | string): LeagueDef | undefined {
  return LEAGUES.find((league) => String(league.id) === String(id));
}
