import type { Metadata } from "next";
import { CasinoLobby } from "@/components/casino/CasinoLobby";

export const metadata: Metadata = { title: "Casino · Pitchside" };

export default function CasinoPage() {
  return <CasinoLobby />;
}
