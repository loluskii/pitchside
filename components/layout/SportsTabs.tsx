"use client";

import { useState } from "react";
import { CircleDot, Dice5, Gamepad2, Gift, Grid2x2, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportIconBadge } from "@/components/ui/SportIconBadge";
import { MAIN_NAV_TABS } from "@/constants/sports";

const TAB_ICONS = {
  football: CircleDot,
  live: Tv,
  virtuals: Gamepad2,
  promos: Gift,
  casino: Dice5,
  more: Grid2x2,
};

export function SportsTabs() {
  const [active, setActive] = useState("football");

  return (
    <section className="px-2 pt-1">
      <div className="flex gap-4 overflow-x-auto rounded-xl bg-[#EEEFEC] px-4 py-4 no-scrollbar">
        {MAIN_NAV_TABS.map((tab) => {
          const icon = TAB_ICONS[tab.id as keyof typeof TAB_ICONS];
          const Icon = icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative flex min-w-[44px] shrink-0 flex-col items-center justify-center gap-1.5 text-xs font-medium text-white transition-opacity",
                active === tab.id ? "opacity-100" : "opacity-85"
              )}
            >
              {tab.id === "football" ? (
                <SportIconBadge sport={tab.icon} size="sm" active={active === tab.id} />
              ) : tab.id === "virtuals" ? (
                <SportIconBadge sport={tab.icon} size="sm" active={active === tab.id} />
              ) : (
                <Icon
                  size={18}
                  strokeWidth={2.1}
                  className={cn(active === tab.id ? "text-white" : "text-white/90")}
                />
              )}
              <span className="leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
