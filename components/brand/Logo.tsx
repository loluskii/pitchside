import { cn } from "@/lib/utils";

/** Pitchside mark: the halfway line and centre circle, with the ball on the spot. */
export function PitchsideMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0C7A4D" />
      <path d="M32 10v44" stroke="#F2F1EC" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="#F2F1EC" strokeWidth="4" />
      <circle cx="32" cy="32" r="5.5" fill="#CBEA4E" />
    </svg>
  );
}

export function PitchsideLogo({ className, size = 28, tone = "dark" }: { className?: string; size?: number; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PitchsideMark size={size} />
      <span
        className={cn("font-heading text-[22px] font-extrabold leading-none tracking-[-0.04em]", tone === "light" ? "text-[#fff]" : "text-[var(--ink)]")}
        style={{ fontVariationSettings: '"wdth" 88' }}
      >
        pitchside
      </span>
    </span>
  );
}
