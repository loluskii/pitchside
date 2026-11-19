"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, useSyncExternalStore } from "react";

const QUERY_CACHE_GC_TIME = 15 * 60_000;
const PERSISTED_CACHE_MAX_AGE = 6 * 60 * 60_000;
const PERSISTED_CACHE_BUSTER = "sportsbook-static-v3";

function shouldPersistQuery(queryKey: readonly unknown[]) {
  const root = String(queryKey[0] ?? "");
  const second = String(queryKey[1] ?? "");

  // Persist only static or near-static reference data. Odds-bearing fixture
  // queries must always cold-start fresh, then be patched by MQTT in-memory.
  if (root === "content") return true;

  if (root !== "sports") return false;

  return second === "menu" || second === "marketsGrouping";
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: QUERY_CACHE_GC_TIME,
        // A failed request should reach the page error state quickly instead of
        // keeping a route skeleton visible through several long retries.
        retry: 1,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Only create the persister in browser environments
function makePersister() {
  if (typeof window === "undefined") return null;
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: "pitchside-query-cache-static",
  });
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(makePersister);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isHydrated || !persister) {
    // Keep the first client render identical to SSR, then enable persistence after hydration.
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        buster: PERSISTED_CACHE_BUSTER,
        maxAge: PERSISTED_CACHE_MAX_AGE,
        // Only persist stable reference queries. Fixture and odds data should
        // always refetch and then stay fresh via MQTT while mounted.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            return query.state.status === "success" && shouldPersistQuery(query.queryKey);
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
