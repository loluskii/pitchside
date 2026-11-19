import Link from "next/link";
import { Clock3, Search, Trophy } from "lucide-react";

export default function ResultsPage() {
  return (
    <div className="space-y-4 px-3 py-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-border-dark bg-surface-input p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black text-white">Results</h1>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-icon text-text-blue shadow-lg">
            <Trophy size={20} />
          </span>
        </div>
      </section>

      <div className="grid gap-3">
        <Link
          href="/live"
          className="rounded-2xl border border-white/6 bg-surface-elevated p-4 transition-colors hover:bg-[#F1F1EF]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-icon text-text-blue">
              <Clock3 size={18} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Live scores</h2>
              <p className="mt-2 text-base leading-6 text-[var(--text-dim)]">
                Open the live section to follow active matches and realtime score updates.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/search"
          className="rounded-2xl border border-white/6 bg-surface-elevated p-4 transition-colors hover:bg-[#F1F1EF]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-icon text-text-blue">
              <Search size={18} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Search fixtures</h2>
              <p className="mt-2 text-base leading-6 text-[var(--text-dim)]">
                Search by team, player, league, or game ID to jump directly to a match.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
