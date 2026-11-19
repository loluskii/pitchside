import { LivePageView } from "@/components/live/LivePageView";

type SearchParamValue = string | string[] | undefined;

type Props = {
  searchParams: Promise<{ sportId?: SearchParamValue }>;
};

function readSearchParam(value: SearchParamValue) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LivePage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const initialSportId = readSearchParam(resolvedSearchParams.sportId).trim() || "1";

  return <LivePageView key={initialSportId} initialSportId={initialSportId} />;
}
