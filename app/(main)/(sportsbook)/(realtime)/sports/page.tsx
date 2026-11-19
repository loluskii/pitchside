"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SportIconBadge } from "@/components/ui/SportIconBadge";
import { COUNTRY_CODES_BY_NAME } from "@/lib/helpers/constants";
import {
  useCategories,
  useLiveCounter,
  useSportsMenu,
  useTournaments,
} from "@/lib/query/hooks/useSports";
import { cn } from "@/lib/utils";
import { normalizeSportsMenu } from "@/lib/utils/home-fixtures";
import { getSportDisplayName } from "@/lib/utils/sports";
import type { Sport } from "@/types";

type CategoryItem = {
  category_id?: number | string;
  country_name?: string;
  games?: number | string;
};

type TournamentItem = {
  tournament_id?: number | string;
  name?: string;
  games?: number | string;
};

type LiveCounterResponse = {
  data?: {
    total?: number;
    sports?: Array<{
      sport_id?: number | string;
      sport_name?: string;
      games?: number | string;
    }>;
  };
};

type SelectedTournament = {
  id: string;
  name: string;
  categoryId?: string;
};

function normalizeCountryName(countryName: string) {
  return countryName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCountryCode(countryName: string) {
  const code = COUNTRY_CODES_BY_NAME[normalizeCountryName(countryName)];

  if (!code) return null;

  if (code.startsWith("gb-")) {
    return "GB";
  }

  if (code.includes("-")) {
    return code.split("-")[0].toUpperCase();
  }

  return code.toUpperCase();
}

function SelectionCheckbox({
  checked,
  disabled = false,
}: {
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors",
        checked
          ? "border-border-action bg-active-tab text-text-on-green"
          : "border-white/15 bg-transparent text-transparent",
        disabled && "opacity-55",
      )}
      aria-hidden="true"
    >
      ✓
    </span>
  );
}

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: T[] }).data;
  }

  return [];
}

function asCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDailyItems() {
  const labels = ["Today", "Tomorrow"];
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      date: formatDateValue(date),
      label:
        labels[index] ??
        date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
    };
  });
}

export default function SportsPage() {
  const router = useRouter();
  const [preferredSportId, setPreferredSportId] = useState("1");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [selectedTournaments, setSelectedTournaments] = useState<SelectedTournament[]>([]);
  const { data: sports = [], isLoading: isSportsLoading } = useSportsMenu();
  const { data: liveCounterData } = useLiveCounter();
  const activeSportId =
    sports.find((sport) => sport.id === preferredSportId)?.id ??
    sports[0]?.id ??
    "1";

  const activeSport =
    sports.find((sport) => sport.id === activeSportId) ??
    sports[0] ??
    ({ id: "1", name: "Football", slug: "football" } as Sport);

  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories(activeSport.id);
  const { data: tournamentsData, isLoading: isTournamentsLoading } = useTournaments(
    activeSport.id,
    expandedCategoryId ?? "",
    null,
  );

  const liveCounterSports = useMemo(
    () => normalizeSportsMenu((liveCounterData as LiveCounterResponse | undefined)?.data?.sports ?? []),
    [liveCounterData],
  );
  const liveCount =
    liveCounterSports.find((sport) => sport.id === activeSport.id)?.matchCount ?? 0;

  const dailyItems = useMemo(() => getDailyItems(), []);

  const categories = extractItems<CategoryItem>(categoriesData).filter(
    (item) => String(item.category_id ?? "").trim() && asCount(item.games) > 0,
  );
  const tournaments = extractItems<TournamentItem>(tournamentsData).filter(
    (item) => String(item.tournament_id ?? "").trim() && asCount(item.games) > 0,
  );

  const selectedTournamentIds = selectedTournaments.map((item) => item.id);
  const reachedSelectionCap = selectedTournamentIds.length >= 10;

  function toggleTournamentSelection(tournament: SelectedTournament) {
    setSelectedTournaments((current) => {
      const exists = current.some((item) => item.id === tournament.id);

      if (exists) {
        return current.filter((item) => item.id !== tournament.id);
      }

      if (current.length >= 10) {
        return current;
      }

      return [...current, tournament];
    });
  }

  function applySelection() {
    if (!selectedTournaments.length) return;

    const params = new URLSearchParams();
    params.set("tournamentIds", selectedTournaments.map((item) => item.id).join(","));

    const categoryIds = [...new Set(selectedTournaments.map((item) => item.categoryId).filter(Boolean))];
    if (categoryIds.length) {
      params.set("categoryIds", categoryIds.join(","));
    }

    router.push(`/sports/${activeSport.slug}?${params.toString()}`);
  }

  return (
    <div className="space-y-3 pb-28">
      <section>
        {isSportsLoading ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`sport-pill-loading-${index}`}
                className="h-[88px] min-w-[96px] animate-pulse rounded-2xl bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {sports.map((sport) => {
              const isActive = sport.id === activeSport.id;

              return (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => {
                    if (sport.id === activeSportId) return;
                    setPreferredSportId(sport.id);
                    setExpandedCategoryId(null);
                    setSelectedTournaments([]);
                  }}
                  className={cn(
                    "flex shrink-0 min-w-16 flex-col items-center gap-x-2 text-center transition-colors",
                    isActive
                      ? "text-active-tab"
                      : "text-white/70",
                  )}
                >
                  <SportIconBadge sport={sport.name} size="lg" active={isActive} />
                  <span className="text-base font-semibold leading-4">
                    {getSportDisplayName(sport.name)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

            <section className="grid grid-cols-3 gap-2">
        <Link
          href={`/live?sportId=${activeSport.id}`}
          className="rounded-md border border-white/6 bg-surface-elevated px-3 py-3 text-left shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold text-white">Live</span>
            <span className="rounded-full bg-[#F2F3F1] px-2 py-0.5 text-sm font-semibold text-nav-active">
              {liveCount}
            </span>
          </div>
        </Link>

        <Link
          href={`/sports/${activeSport.slug}?period=today`}
          className="rounded-md border border-white/6 bg-surface-elevated px-3 py-3 text-left shadow-md"
        >
          <span className="text-lg font-semibold text-white">Today</span>
        </Link>

        <Link
          href={`/sports/${activeSport.slug}`}
          className="rounded-md border border-white/6 bg-surface-elevated px-3 py-3 text-left shadow-md"
        >
          <span className="text-lg font-semibold text-white">
            All {getSportDisplayName(activeSport.name)}
          </span>
        </Link>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-2">
          {dailyItems.map((item) => (
            <Link
              key={item.date}
              href={`/sports/${activeSport.slug}?period=custom&startDate=${item.date}&endDate=${item.date}`}
              className="rounded-md border border-white/6 bg-[#F4F4F3] px-3 py-3 text-left transition-colors hover:bg-[#F1F1EF]"
            >
              <span className="text-lg font-semibold text-white">{item.label}</span>
              <p className="mt-1 text-base text-text-muted-2">{item.date}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-white">Countries</h2>
            {reachedSelectionCap ? (
              <span className="text-base font-semibold text-[#0C7A4D]">
                Selection cap reached
              </span>
            ) : null}
          </div>

          {isCategoriesLoading ? (
            <div className="space-y-2 pb-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`categories-loading-${index}`}
                  className="h-12 animate-pulse rounded-xl bg-white/5"
                />
              ))}
            </div>
          ) : categories.length ? (
            <div className="space-y-2 pb-1">
              {categories.map((category) => {
                const categoryId = String(category.category_id ?? "");
                const isExpanded = categoryId === expandedCategoryId;
                const countryName = String(category.country_name ?? "Country");
                const countryCode = getCountryCode(countryName);

                return (
                  <div
                    key={`category-${categoryId || category.country_name}`}
                    className="overflow-hidden border-b border-white/6"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategoryId((current) => current === categoryId ? null : categoryId)
                      }
                      className="flex w-full items-center justify-between gap-3 py-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center text-3xl leading-none">
                          <span aria-hidden="true">🪐</span>
                          {countryCode ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://flagsapi.com/${countryCode}/flat/64.png`}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                        </span>
                        <span className="block truncate text-lg font-semibold text-white">
                          {countryName}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-white/6 px-2 py-0.5 text-sm font-semibold text-white/75">
                          {asCount(category.games)}
                        </span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            "text-white/45 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-white/6 bg-surface-elevated px-3">
                        {isTournamentsLoading ? (
                          <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, index) => (
                              <div
                                key={`country-tournaments-loading-${index}`}
                                className="h-11 animate-pulse border-b bg-white/5"
                              />
                            ))}
                          </div>
                        ) : tournaments.length ? (
                          <div className="space-y-2">
                            {tournaments.map((tournament) => {
                              const tournamentId = String(tournament.tournament_id ?? "");
                              const isSelected = selectedTournamentIds.includes(tournamentId);
                              const isDisabled = reachedSelectionCap && !isSelected;

                              return (
                                <button
                                  key={`tournament-${tournamentId}`}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  onClick={() =>
                                    toggleTournamentSelection({
                                      id: tournamentId,
                                      name: String(tournament.name ?? "Tournament"),
                                      categoryId,
                                    })
                                  }
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 border-b py-3 text-left transition-colors",
                                    isDisabled && "opacity-55",
                                  )}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <SelectionCheckbox checked={isSelected} disabled={isDisabled} />
                                    <span className="min-w-0">
                                      <span className="block truncate text-lg font-semibold text-white">
                                        {String(tournament.name ?? "Tournament")}
                                      </span>
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="rounded-full bg-white/6 px-2 py-0.5 text-sm font-semibold text-white/75">
                                      {asCount(tournament.games)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ):null }
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-md text-white/55">
              No countries are available for this sport right now.
            </div>
          )}
        </div>
      </section>
      
      {selectedTournaments.length > 0 && (
        <div className="sticky bottom-20 z-20">
          <div className="rounded-3xl border border-white/8 bg-surface-elevated/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">
                  {selectedTournaments.length} tournament{selectedTournaments.length > 1 ? "s" : ""} selected
                </p>
                <p className="mt-1 text-base text-text-muted-2">
                  Apply opens the filtered prematch fixtures page.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedTournaments([])}
                disabled={!selectedTournaments.length}
                className="rounded-lg border border-[#0C7A4D]/60 px-4 py-3 text-xl font-semibold text-[#0C7A4D] transition-opacity disabled:opacity-45"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applySelection}
                disabled={!selectedTournaments.length}
                className="rounded-lg bg-[linear-gradient(135deg,#ff8a00_0%,#ff6600_100%)] px-4 py-3 text-xl font-semibold text-text-on-green transition-opacity disabled:opacity-45"
              >
                Apply ({selectedTournaments.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
