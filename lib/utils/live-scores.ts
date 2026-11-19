import { formatHomeLiveStatus } from "@/lib/utils/home-fixtures";
import type { RawFixture, RawPeriodScore, RawScorePair } from "@/lib/utils/normalize";

export type LiveScoreColumn = {
  key: string;
  kind: "total" | "period" | "game";
  label: string;
  home: string;
  away: string;
};

export type LiveScoreboard = {
  columns: LiveScoreColumn[];
  phaseLabel: string;
  hasBreakdown: boolean;
};

type LiveScoreboardVariant = "detail" | "list";

const SCORE_BREAKDOWN_SPORT_IDS = new Set(["5", "15"]);
const SET_BREAKDOWN_SPORTS = new Set(["tennis", "table tennis", "badminton", "volleyball"]);
const QUARTER_BREAKDOWN_SPORTS = new Set(["basketball"]);
const PERIOD_BREAKDOWN_SPORTS = new Set(["ice hockey", "handball"]);

function normalizeSportName(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

function formatScoreValue(value: unknown, fallback = "") {
  if (value === 0 || value === "0") return "0";
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatPhaseLabel(value: string) {
  const text = value.trim();
  if (!text) return "";

  let match = text.match(/^(\d+)(?:st|nd|rd|th)\s+set$/i);
  if (match) return `Set ${match[1]}`;

  match = text.match(/^(\d+)(?:st|nd|rd|th)\s+half$/i);
  if (match) return `H${match[1]}`;

  match = text.match(/^(\d+)(?:st|nd|rd|th)\s+quarter$/i);
  if (match) return `Q${match[1]}`;

  match = text.match(/^(\d+)(?:st|nd|rd|th)\s+period$/i);
  if (match) return `P${match[1]}`;

  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeScorePair(scorePair: RawScorePair | null | undefined): RawScorePair | undefined {
  if (!scorePair) return undefined;

  const home =
    scorePair.home ??
    scorePair.home_score ??
    scorePair.homeScore ??
    null;
  const away =
    scorePair.away ??
    scorePair.away_score ??
    scorePair.awayScore ??
    null;

  if (home === null && away === null) return undefined;

  return { home, away };
}

export function normalizeRawScorePair(scorePair: RawScorePair | null | undefined) {
  return normalizeScorePair(scorePair);
}

function normalizePeriodScore(periodScore: RawPeriodScore, index: number): RawPeriodScore | null {
  const home =
    periodScore.home_score ??
    periodScore.homeScore ??
    null;
  const away =
    periodScore.away_score ??
    periodScore.awayScore ??
    null;
  const description = String(periodScore.description ?? "").trim();
  const number = periodScore.number ?? index + 1;

  if (home === null && away === null && !description && number === undefined) {
    return null;
  }

  return {
    number,
    home_score: home,
    away_score: away,
    description,
    match_status_code: periodScore.match_status_code,
    type: periodScore.type,
  };
}

export function normalizeRawPeriodScores(periodScores: RawPeriodScore[] | null | undefined) {
  if (!Array.isArray(periodScores)) return [];

  return periodScores
    .map((periodScore, index) => normalizePeriodScore(periodScore, index))
    .filter((periodScore): periodScore is RawPeriodScore => Boolean(periodScore))
    .sort((left, right) => Number(left.number ?? 0) - Number(right.number ?? 0));
}

function getPeriodLabel(periodScore: RawPeriodScore, index: number) {
  const description = String(periodScore.description ?? "").trim();
  const number = String(periodScore.number ?? index + 1).trim();

  if (/set/i.test(description)) return `S${number || index + 1}`;
  if (/half/i.test(description)) return `H${number || index + 1}`;
  if (/quarter/i.test(description)) return `Q${number || index + 1}`;
  if (/period/i.test(description)) return `P${number || index + 1}`;

  return number ? `P${number}` : `P${index + 1}`;
}

function getBreakdownTotalLabel(fixture: Pick<RawFixture, "sportName">) {
  const sportName = normalizeSportName(fixture.sportName);

  if (SET_BREAKDOWN_SPORTS.has(sportName)) return "S";
  if (QUARTER_BREAKDOWN_SPORTS.has(sportName)) return "T";
  if (PERIOD_BREAKDOWN_SPORTS.has(sportName)) return "T";

  return "FT";
}

function getPhaseLabel(periodScores: RawPeriodScore[], matchStatus?: string) {
  const describedPeriod = [...periodScores]
    .reverse()
    .find((periodScore) => String(periodScore.description ?? "").trim());

  const periodLabel = formatPhaseLabel(String(describedPeriod?.description ?? ""));
  if (periodLabel) return periodLabel;

  return formatPhaseLabel(formatHomeLiveStatus(String(matchStatus ?? "").trim()));
}

export function supportsLiveScoreBreakdown(fixture: Pick<RawFixture, "sportID">) {
  const sportId = String(fixture.sportID ?? "").trim();
  const sportName = normalizeSportName((fixture as RawFixture).sportName);

  if (SCORE_BREAKDOWN_SPORT_IDS.has(sportId)) return true;
  if (SET_BREAKDOWN_SPORTS.has(sportName)) return true;
  if (QUARTER_BREAKDOWN_SPORTS.has(sportName)) return true;
  if (PERIOD_BREAKDOWN_SPORTS.has(sportName)) return true;

  return false;
}

export function getLiveScoreMetaLabels({
  displayTime,
  matchStatus,
  phaseLabel,
}: {
  displayTime?: string;
  matchStatus?: string;
  phaseLabel?: string;
}) {
  const timeLabel = String(displayTime ?? "").trim();
  const statusLabel = formatPhaseLabel(formatHomeLiveStatus(String(matchStatus ?? "").trim()));
  const phase = String(phaseLabel ?? "").trim();
  const hasClock = Boolean(timeLabel && timeLabel !== "--:--");
  const secondary = phase || statusLabel;

  if (hasClock) {
    return {
      primary: timeLabel,
      secondary: secondary && secondary !== timeLabel ? secondary : "",
    };
  }

  return {
    primary: secondary || "LIVE",
    secondary: secondary ? "LIVE" : "",
  };
}

export function getLiveScoreboard(
  fixture: RawFixture,
  variant: LiveScoreboardVariant = "detail",
): LiveScoreboard {
  const totalHome = formatScoreValue(
    fixture.homeScore ??
      fixture.eventInfo?.score?.home ??
      fixture.eventInfo?.score?.home_score ??
      fixture.eventInfo?.scores?.home ??
      fixture.eventInfo?.scores?.home_score,
    "0",
  );
  const totalAway = formatScoreValue(
    fixture.awayScore ??
      fixture.eventInfo?.score?.away ??
      fixture.eventInfo?.score?.away_score ??
      fixture.eventInfo?.scores?.away ??
      fixture.eventInfo?.scores?.away_score,
    "0",
  );
  const periodScores = normalizeRawPeriodScores(fixture.eventInfo?.period_scores);
  const showBreakdown = supportsLiveScoreBreakdown(fixture);
  const columns: LiveScoreColumn[] = [];
  const totalColumn: LiveScoreColumn = {
    key: "total",
    kind: "total",
    label: variant === "list" ? "P" : showBreakdown && periodScores.length ? getBreakdownTotalLabel(fixture) : "FT",
    home: totalHome,
    away: totalAway,
  };

  if (variant === "list") {
    if (showBreakdown) {
      const latestPeriodScore = periodScores[periodScores.length - 1];

      if (latestPeriodScore) {
        columns.push({
          key: `period-${String(latestPeriodScore.number ?? periodScores.length)}`,
          kind: "period",
          label: getPeriodLabel(latestPeriodScore, periodScores.length - 1),
          home: formatScoreValue(latestPeriodScore.home_score, "-"),
          away: formatScoreValue(latestPeriodScore.away_score, "-"),
        });
      }
    }

    if (!showBreakdown || periodScores.length !== 1) {
      columns.push(totalColumn);
    }
  } else {
    if (showBreakdown) {
      periodScores.forEach((periodScore, index) => {
        columns.push({
          key: `period-${String(periodScore.number ?? index + 1)}`,
          kind: "period",
          label: getPeriodLabel(periodScore, index),
          home: formatScoreValue(periodScore.home_score, "-"),
          away: formatScoreValue(periodScore.away_score, "-"),
        });
      });
    }

    columns.push(totalColumn);
  }

  return {
    columns,
    phaseLabel: getPhaseLabel(periodScores, String(fixture.matchStatus ?? "")),
    hasBreakdown: columns.length > 1,
  };
}
