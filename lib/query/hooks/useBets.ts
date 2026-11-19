"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { betsApi } from "@/lib/api/bets";
import { queryKeys } from "@/lib/query/keys";
import type { BetHistoryResponse } from "@/lib/utils/bet-history";

type BetHistoryParams = {
  bet_type?: string;
  event_type?: string;
  id?: number | string;
  is_booked?: number;
  page?: number;
  perPage?: number;
  share_code?: string;
  source?: string;
  stake_type?: string;
  status?: number | number[];
  user_id?: number | string;
  username?: string;
  from?: string;
  to?: string;
};

function getBetServiceStatusCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const directCode = Number(record.status_code);
  if (Number.isFinite(directCode)) return directCode;
  return null;
}

function getBetServiceStatusDescription(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  return String(record.status_description ?? "").trim();
}

async function getBetsOrThrow(params: BetHistoryParams) {
  const response = await betsApi.getBets(params);
  const statusCode = getBetServiceStatusCode(response);
  if (statusCode !== null && statusCode !== 200) {
    throw new Error(getBetServiceStatusDescription(response) || "Unable to load bets.");
  }
  return response;
}

function getBetPageList(payload: unknown) {
  const response = payload as BetHistoryResponse | undefined;
  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

function getBetPageMeta(payload: unknown) {
  const response = payload as BetHistoryResponse | undefined;
  return response?.data ?? null;
}

export function useBetHistory(
  params: BetHistoryParams = {},
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: queryKeys.bets.list(params),
    queryFn: () => getBetsOrThrow(params),
    staleTime: 30_000,
  });
}

export function useInfiniteBetHistory(
  params: Omit<BetHistoryParams, "id" | "page"> = {},
  enabled = true,
) {
  const perPage = params.perPage ?? 20;

  return useInfiniteQuery({
    enabled,
    initialPageParam: 1,
    queryKey: queryKeys.bets.list({ ...params, mode: "infinite" }),
    queryFn: ({ pageParam }) =>
      getBetsOrThrow({
        ...params,
        page: Number(pageParam || 1),
        perPage,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const meta = getBetPageMeta(lastPage);
      const nextPage = Number(meta?.nextPage ?? 0);
      const lastKnownPage = Number(meta?.lastPage ?? 0);
      const currentPage = Number(meta?.currentPage ?? allPages.length);
      if (nextPage > 0) {
        return nextPage;
      }
      if (lastKnownPage > 0 && currentPage < lastKnownPage) {
        return currentPage + 1;
      }

      const list = getBetPageList(lastPage);
      return list.length < perPage ? undefined : allPages.length + 1;
    },
    staleTime: 30_000,
  });
}

export function useCodeHub(params: {
  page?: number;
  perPage?: number;
  sort?: string;
  start?: string;
  end?: string;
  minOdd?: number | string;
  maxOdd?: number | string;
  minFold?: number | string;
  maxFold?: number | string;
  betType?: string;
  search?: string;
} = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: queryKeys.bets.codeHub(params),
    queryFn: () => betsApi.getCodeHub(params),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
