import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CASINO_GAMES } from "@/lib/casino/games";
import { photo } from "@/lib/media";

export function CasinoBand() {
  return (
    <section className="-mx-2.5 bg-[var(--ink)] px-2.5 py-5 text-[var(--chalk)]">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--lime)]">Casino originals</p>
          <h2 className="font-heading text-xl font-extrabold">Something between halves</h2>
        </div>
        <Link href="/casino" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--lime)]">
          All games <ArrowRight size={14} />
        </Link>
      </div>
      <div className="-mx-2.5 flex gap-2.5 overflow-x-auto px-2.5 no-scrollbar">
        {CASINO_GAMES.map((game) => (
          <Link
            key={game.slug}
            href={`/casino/${game.slug}`}
            className="relative h-44 w-36 shrink-0 overflow-hidden rounded-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo(game.photo, 320, 400)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-[var(--ink)]/20 to-transparent" />
            <div className="absolute inset-x-2.5 bottom-2.5">
              <span className="mb-1 block h-1 w-6 rounded-full" style={{ background: game.accent }} />
              <p className="font-heading text-base font-extrabold leading-tight">{game.name}</p>
              <p className="text-[10px] leading-3 text-[var(--chalk)]/65">{game.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
