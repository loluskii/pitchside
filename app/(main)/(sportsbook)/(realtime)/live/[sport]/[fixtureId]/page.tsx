import { LiveFixtureDetailView } from "@/components/fixtures/LiveFixtureDetailView";

interface Props {
  params: Promise<{ sport: string; fixtureId: string }>;
}

export default async function LiveFixtureDetailPage({ params }: Props) {
  const { sport, fixtureId } = await params;

  return <LiveFixtureDetailView sportSlug={sport} fixtureId={fixtureId} />;
}
