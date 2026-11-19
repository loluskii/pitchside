"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search01Icon } from "hugeicons-react";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { useSearch } from "@/lib/query/hooks/useSports";
import { getLiveFixtureHref, getPrematchFixtureHref } from "@/lib/utils/fixture-routes";
import type { RawFixture } from "@/lib/utils/normalize";

type SearchResponse = {
  data?: {
    fixtures?: RawFixture[];
  };
  fixtures?: RawFixture[];
};

function FixtureSearchCard({ fixture }: { fixture: RawFixture }) {
  const isLive =
    String(fixture.matchStatus ?? "").trim().toLowerCase() !== "not started" &&
    String(fixture.matchStatus ?? "").trim().toLowerCase() !== "ended";
  const href = isLive ? getLiveFixtureHref(fixture) : getPrematchFixtureHref(fixture);

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/6 bg-surface-elevated p-4 transition-colors hover:bg-[#F1F1EF]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold uppercase tracking-[0.14em] text-text-label">
            {fixture.sportName ?? "Sport"} · {fixture.tournament ?? "Competition"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {fixture.homeTeam} vs {fixture.awayTeam}
          </h2>
          <p className="mt-2 text-base leading-5 text-[var(--text-dim)]">
            {isLive
              ? `${fixture.matchStatus ?? "Live"} · ${fixture.homeScore ?? 0}-${fixture.awayScore ?? 0}`
              : fixture.date
                ? new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(fixture.date))
                : "Scheduled"}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-sm font-semibold text-white/65">
          +{Number(fixture.activeMarkets ?? 0)}
        </span>
      </div>
    </Link>
  );
}

function SearchPageContent({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const normalizedQuery = query.trim();
  const { data, isLoading } = useSearch(normalizedQuery);

  const fixtures = useMemo(
    () => {
      const response = data as SearchResponse | undefined;
      return (response?.data?.fixtures ?? response?.fixtures ?? []).filter(Boolean);
    },
    [data],
  );
  const liveFixtures = fixtures.filter((fixture) => {
    const status = String(fixture.matchStatus ?? "").trim().toLowerCase();
    return status && status !== "not started" && status !== "ended";
  });
  const prematchFixtures = fixtures.filter((fixture) => {
    const status = String(fixture.matchStatus ?? "").trim().toLowerCase();
    return !status || status === "not started";
  });

  function updateUrl(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    } else {
      params.delete("q");
    }

    const href = params.size ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="">
        <h1 className="text-4xl font-black text-white">Search</h1>

        <form
          className="mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-surface-elevated px-4 py-1"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            updateUrl(query);
          }}
        >
          <Search01Icon size={18} color="var(--text-dim)" />
          <input
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Teams, players, leagues, Game ID"
            className="h-10 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-[var(--text-dim)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--lime)] px-4 py-2 text-md font-semibold text-white disabled:opacity-60"
            disabled={isPending}
          >
            Search
          </button>
        </form>
      </section>

      {normalizedQuery.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
          <p className="text-xl font-semibold text-white">Start typing to search</p>
          <p className="mt-2 text-md leading-6 text-[var(--text-dim)]">
            Enter at least two characters to search the sportsbook fixture feed.
          </p>
        </div>
      ) : isLoading || isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <FixtureSkeleton key={`search-skeleton-${index}`} />
          ))}
        </div>
      ) : fixtures.length ? (
        <div className="space-y-5">
          {liveFixtures.length ? (
            <section className="space-y-3">
              <h2 className="text-base font-bold uppercase tracking-[0.16em] text-text-label">
                Live
              </h2>
              {liveFixtures.map((fixture) => (
                <FixtureSearchCard key={`live-${fixture.matchID}`} fixture={fixture} />
              ))}
            </section>
          ) : null}

          {prematchFixtures.length ? (
            <section className="space-y-3">
              <h2 className="text-base font-bold uppercase tracking-[0.16em] text-text-label">
                Prematch
              </h2>
              {prematchFixtures.map((fixture) => (
                <FixtureSearchCard key={`prematch-${fixture.matchID}`} fixture={fixture} />
              ))}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
          <p className="text-xl font-semibold text-white">No results found</p>
          <p className="mt-2 text-md leading-6 text-[var(--text-dim)]">
            Try a different team, player, league, or fixture ID.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  return <SearchPageContent key={initialQuery} initialQuery={initialQuery} />;
}
