import { notFound } from "next/navigation";
import { CasinoGameView } from "@/components/casino/CasinoGameView";
import { CASINO_GAMES, gameBySlug } from "@/lib/casino/games";

export function generateStaticParams() {
  return CASINO_GAMES.map((game) => ({ game: game.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  return { title: `${gameBySlug(game)?.name ?? "Casino"} · Pitchside` };
}

export default async function CasinoGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!gameBySlug(game)) notFound();
  return <CasinoGameView slug={game} />;
}
