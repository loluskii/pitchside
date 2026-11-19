"use client";

import { useQuery } from "@tanstack/react-query";
import { contentApi } from "@/lib/api/content";
import { queryKeys } from "@/lib/query/keys";

export function usePromotions() {
  return useQuery({
    queryKey: queryKeys.content.promotions,
    queryFn: contentApi.getPromotions,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}

export function useBonusList() {
  return useQuery({
    queryKey: queryKeys.content.bonusList,
    queryFn: contentApi.getBonusList,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useCMSPage(slug: string) {
  return useQuery({
    queryKey: queryKeys.content.cms(slug),
    queryFn: () => contentApi.getCMSPage(slug),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    enabled: slug.trim().length > 0,
  });
}
