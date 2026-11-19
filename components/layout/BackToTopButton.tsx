"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type BackToTopButtonProps = {
  blocked?: boolean;
  threshold?: number;
};

export function BackToTopButton({ blocked = false, threshold = 480 }: BackToTopButtonProps) {
  const [pastThreshold, setPastThreshold] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    let rafId = 0;

    const updateVisibility = () => {
      setPastThreshold(window.scrollY > threshold);
    };

    const handleScroll = () => {
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateVisibility();
      });
    };

    updateVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [threshold]);

  const isVisible = pastThreshold && !blocked;

  if (!mounted) return null;

  return createPortal(
    <button
      type="button"
      aria-label="Back to top"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={cn(
        "back-to-top-button fixed left-1/2 z-nav flex h-auto w-auto min-h-0 min-w-0 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-emerald-400/25 bg-[#F6F6F5]/95 px-4 py-3 text-sm font-extrabold tracking-[0.02em] text-white shadow-md backdrop-blur-md transition-all duration-200 active:scale-[0.98]",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
      >
        <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="text-emerald-400"
      >
        <path
          d="M8 13.5V2.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.5 7.5L8 3L12.5 7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Top</span>
    </button>
    ,
    document.body,
  );
}
