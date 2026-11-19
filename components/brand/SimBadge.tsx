import { cn } from "@/lib/utils";

/** Marks a fixture as played out by the Pitchside match simulation. */
export function SimBadge({ className }: { className?: string }) {
  return (
    <span
      title="Simulated fixture"
      className={cn(
        "inline-flex h-[16px] shrink-0 items-center rounded-[5px] border border-[var(--ink)]/15 bg-[var(--lime)]/70 px-1 font-mono text-[9px] font-bold leading-none tracking-[0.08em] text-[var(--ink)]",
        className,
      )}
    >
      SIM
    </span>
  );
}
