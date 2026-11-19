"use client";

import { useQuery } from "@tanstack/react-query";
import { BASE_API, CLIENT_ID } from "@/lib/api/config";
import { queryKeys } from "@/lib/query/keys";

async function fetchBanners() {
  const response = await fetch(`${BASE_API}/content-management/banner?clientId=${CLIENT_ID}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Unable to load banners (${response.status}).`);
  }

  return response.json();
}

export function useBanners() {
  return useQuery({
    queryKey: queryKeys.content.banners,
    queryFn: fetchBanners,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
