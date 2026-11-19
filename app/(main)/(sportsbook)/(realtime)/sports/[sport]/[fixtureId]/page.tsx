import { PrematchFixtureDetailView } from "@/components/fixtures/PrematchFixtureDetailView";

interface Props {
  params: Promise<{ sport: string; fixtureId: string }>;
}

export default async function PrematchFixtureDetailPage({ params }: Props) {
  const { sport, fixtureId } = await params;

  return <PrematchFixtureDetailView sportSlug={sport} fixtureId={fixtureId} />;
}
