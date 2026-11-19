import { SPORT_ICON_REGISTRY } from "@/components/icons/sports/registry";
import { cn } from "@/lib/utils";
import {
  getSportDisplayName,
  getSportIconKey,
  getSportSectionWrapperClass,
} from "@/lib/utils/sports";

type SportIconBadgeProps = {
  sport?: string | number;
  className?: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
};

const SIZE_CLASSES = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

const ICON_BOX_CLASSES = {
  sm: "h-[68%] w-[68%]",
  md: "h-[70%] w-[70%]",
  lg: "h-[72%] w-[72%]",
} as const;

export function SportIconBadge({
  sport,
  className,
  size = "md",
  active = false,
}: SportIconBadgeProps) {
  const label = getSportDisplayName(sport);
  const iconKey = getSportIconKey(sport);
  const Glyph = SPORT_ICON_REGISTRY[iconKey] ?? SPORT_ICON_REGISTRY.generic;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-sport-icon={iconKey}
      className={cn(
        "inline-flex items-center justify-center overflow-hidden text-white",
        active && "text-active-tab",
        SIZE_CLASSES[size],
        getSportSectionWrapperClass(sport),
        className,
      )}
      style={{ padding: 0 }}
    >
      <Glyph className={ICON_BOX_CLASSES[size]} />
    </span>
  );
}
