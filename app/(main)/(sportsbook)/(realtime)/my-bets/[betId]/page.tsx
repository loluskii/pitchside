import { BetHistoryDetailView } from "@/components/bets/BetHistoryDetailView";

export default async function BetHistoryDetailPage({
  params,
}: {
  params: Promise<{ betId: string }>;
}) {
  const { betId } = await params;

  return <BetHistoryDetailView betId={decodeURIComponent(betId)} />;
}
