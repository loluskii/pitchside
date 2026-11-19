"use client";

import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api/wallet";
import { queryKeys } from "@/lib/query/keys";

function getWalletStatusCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const directCode = Number(record.status_code ?? record.statusCode);
  if (Number.isFinite(directCode)) return directCode;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  const nestedCode = Number(nested?.status_code ?? nested?.statusCode);
  return Number.isFinite(nestedCode) ? nestedCode : null;
}

function getWalletStatusDescription(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  return String(
    record.status_description ??
      record.message ??
      nested?.status_description ??
      nested?.message ??
      "",
  ).trim();
}

async function getTransactionsOrThrow(params: Record<string, unknown>) {
  const response = await walletApi.getTransactions(params);
  const statusCode = getWalletStatusCode(response);
  if (statusCode !== null && statusCode !== 200) {
    throw new Error(getWalletStatusDescription(response) || "Unable to load transactions.");
  }
  return response;
}

async function getWalletPayloadOrThrow<T>(request: () => Promise<T>, fallbackMessage: string) {
  const response = await request();
  const statusCode = getWalletStatusCode(response);
  if (statusCode !== null && statusCode !== 200) {
    throw new Error(getWalletStatusDescription(response) || fallbackMessage);
  }
  return response;
}

export function useTransactions(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet.transactions(params),
    queryFn: () => getTransactionsOrThrow(params),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    enabled,
  });
}

export function usePendingWithdrawals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet.pendingWithdrawals,
    queryFn: () => getWalletPayloadOrThrow(walletApi.getPendingWithdrawals, "Unable to load pending withdrawals."),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    enabled,
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet.paymentMethods,
    queryFn: () => getWalletPayloadOrThrow(walletApi.getPaymentMethods, "Unable to load payment methods."),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    enabled,
  });
}

export function useBanks(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet.banks,
    queryFn: () => getWalletPayloadOrThrow(walletApi.getBanks, "Unable to load banks."),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    enabled,
  });
}

export function useBankAssets(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet.bankAssets,
    queryFn: () => getWalletPayloadOrThrow(walletApi.getBankAssets, "Unable to load bank accounts."),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    enabled,
  });
}
