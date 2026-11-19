"use client";

import { Dice } from "@/components/casino/games/Dice";
import { HiLo } from "@/components/casino/games/HiLo";
import { Liftoff } from "@/components/casino/games/Liftoff";
import { SpotKick } from "@/components/casino/games/SpotKick";

export function CasinoGameView({ slug }: { slug: string }) {
  if (slug === "liftoff") return <Liftoff />;
  if (slug === "spot-kick") return <SpotKick />;
  if (slug === "dice") return <Dice />;
  if (slug === "hi-lo") return <HiLo />;
  return null;
}
