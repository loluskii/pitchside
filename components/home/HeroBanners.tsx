"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { photo, photoSrcSet, type PhotoKey } from "@/lib/media";
import { useLiveCounter } from "@/lib/query/hooks/useSports";

type LiveCounterResponse = { data?: { total?: number } };

type Banner = {
  key: string;
  href: string;
  photo: PhotoKey;
  /** CSS object-position for the photo, to keep faces in frame. */
  focus?: string;
  cta: string;
  render: (live: number | undefined) => ReactNode;
};

const ADVANCE_MS = 5500;

const BANNERS: Banner[] = [
  {
    key: "live",
    href: "/live",
    photo: "fansCheering",
    focus: "center 35%",
    cta: "Bet live",
    render: (live) => (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--flare)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#fff]" /> Live now
        </span>
        <h2 className="mt-2 font-heading text-[30px] font-extrabold leading-[0.95] tracking-[-0.03em]">
          {live === undefined ? "Matches" : `${live} ${live === 1 ? "match" : "matches"}`}
          <br />
          <span className="text-[var(--lime)]">in play now</span>
        </h2>
      </>
    ),
  },
  {
    key: "basketball",
    href: "/sports/basketball",
    photo: "dunk",
    focus: "center 30%",
    cta: "View games",
    render: () => (
      <>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--amber)]">Basketball</span>
        <h2 className="mt-1.5 font-heading text-[34px] font-extrabold leading-[0.9] tracking-[-0.03em]">
          Bet on
          <br />
          basketball
        </h2>
        <p className="mt-1.5 max-w-[190px] text-[12px] leading-4 text-[#fff]/75">Money line, spreads and totals on every game.</p>
      </>
    ),
  },
  {
    key: "liftoff",
    href: "/casino/liftoff",
    photo: "nightFlight",
    cta: "Play now",
    render: () => (
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--lime)]">Casino</span>
          <h2 className="mt-1.5 font-heading text-[28px] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Liftoff
            <br />
            <span className="text-[20px] font-bold tracking-[-0.01em] text-[#fff]/85">Cash out before it crashes</span>
          </h2>
        </div>
      </div>
    ),
  },
  {
    key: "football",
    href: "/sports/football?period=today",
    photo: "striker",
    focus: "center 40%",
    cta: "See matches",
    render: () => (
      <>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--lime)]">Football</span>
        <h2 className="mt-1.5 font-heading text-[30px] font-extrabold leading-[0.95] tracking-[-0.03em]">
          Today&apos;s
          <br />
          football
        </h2>
        <p className="mt-1.5 max-w-[200px] text-[12px] leading-4 text-[#fff]/75">Premier Division, Liga Primera, Serie Uno and more.</p>
      </>
    ),
  },
  {
    key: "codes",
    href: "/load-code",
    photo: "watchParty",
    focus: "center 45%",
    cta: "Load code",
    render: () => (
      <>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--amber)]">Booking code</span>
        <h2 className="mt-1.5 font-heading text-[28px] font-extrabold leading-[0.95] tracking-[-0.03em]">
          Got a
          <br />
          booking code?
        </h2>
      </>
    ),
  },
];

/** Decorative graphics layered over each photo. */
function BannerArt({ name }: { name: string }) {
  if (name === "live") {
    return (
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -right-10 -top-12 h-56 w-56 text-[var(--lime)]/25" fill="none">
        {[30, 55, 80].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeWidth="1.5" />
        ))}
        <circle cx="100" cy="100" r="8" fill="currentColor" />
      </svg>
    );
  }
  if (name === "basketball") {
    return (
      <>
        <div aria-hidden="true" className="absolute -right-6 top-0 h-full w-10 -skew-x-12 bg-[var(--amber)]" />
        <div aria-hidden="true" className="absolute right-8 top-0 h-full w-2 -skew-x-12 bg-[var(--amber)]/70" />
      </>
    );
  }
  if (name === "liftoff") {
    return (
      <>
        <svg aria-hidden="true" viewBox="0 0 300 160" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3/4 w-full">
          <path d="M0 150 C 120 148, 200 120, 300 10 L300 160 L0 160 Z" fill="rgba(203,234,78,0.18)" />
          <path d="M0 150 C 120 148, 200 120, 300 10" stroke="#CBEA4E" strokeWidth="3" fill="none" />
        </svg>
        <span className="absolute bottom-11 right-4 font-heading text-[44px] font-extrabold leading-none tracking-[-0.04em] text-[var(--lime)]">
          2.41×
        </span>
      </>
    );
  }
  if (name === "football") {
    return (
      <svg aria-hidden="true" viewBox="0 0 200 120" className="absolute -right-6 top-3 h-32 w-56 text-[#fff]/20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="10" y="10" width="180" height="100" rx="3" />
        <path d="M100 10v100" />
        <circle cx="100" cy="60" r="20" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="absolute right-4 top-4 rotate-6 rounded-xl border-2 border-dashed border-[var(--amber)] bg-[var(--ink)]/70 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.2em] text-[var(--amber)]"
    >
      PX7K-29Q
    </span>
  );
}

export function HeroBanners() {
  const { data: counter } = useLiveCounter();
  const live = (counter as LiveCounterResponse | undefined)?.data?.total;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  const goTo = useCallback((next: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = (next + BANNERS.length) % BANNERS.length;
    // Horizontal scroll of the carousel only — never the page.
    scroller.scrollTo({ left: target * scroller.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => setIndex(Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth)));
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const current = Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth));
      goTo(current + 1);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [goTo]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative">
      <div
        ref={scrollerRef}
        onPointerDown={pause}
        onPointerUp={resume}
        onPointerLeave={resume}
        onMouseEnter={pause}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[22px] no-scrollbar"
      >
        {BANNERS.map((banner, i) => (
          <Link
            key={banner.key}
            href={banner.href}
            className="relative h-[200px] w-full shrink-0 snap-start overflow-hidden bg-[var(--ink)] text-[#fff]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo(banner.photo, 960, 480)}
              srcSet={photoSrcSet(banner.photo)}
              sizes="(max-width: 480px) 100vw, 456px"
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: banner.focus ?? "center" }}
            />
            <span className="absolute inset-0 bg-gradient-to-r from-[var(--ink)]/92 via-[var(--ink)]/55 to-[var(--ink)]/5" />
            <BannerArt name={banner.key} />
            <span className="absolute inset-x-4 bottom-4 top-4 flex flex-col justify-between">
              <span>{banner.render(live)}</span>
              <span className="inline-flex w-max items-center gap-1 rounded-full bg-[var(--lime)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink)]">
                {banner.cta} <ArrowUpRight className="size-3.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 flex">
        {BANNERS.map((banner, i) => (
          <button
            key={banner.key}
            type="button"
            aria-label={`Show banner ${i + 1}`}
            aria-current={i === index}
            onClick={() => goTo(i)}
            className="flex h-6 min-w-6 items-center justify-center"
          >
            <span className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[var(--lime)]" : "w-1.5 bg-[#fff]/45"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
