// Routes requests for the engine's service hosts to the in-process engine.
// Imported by lib/api/config.ts, so it is active on the server and in the browser
// before any API call is made.

import { handleEngineRequest } from "./upstream";

type PatchedFetch = typeof fetch & { __pitchsideEngine?: true };

export function installEngine() {
  const current = globalThis.fetch as PatchedFetch | undefined;
  if (!current || current.__pitchsideEngine) return;

  const patched: PatchedFetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await handleEngineRequest(input, init);
      if (response) {
        // A short, variable delay keeps loading states honest.
        await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 140));
        return response;
      }
      return current(input, init);
    },
    { __pitchsideEngine: true as const },
  );

  globalThis.fetch = patched;
}

installEngine();

/** Explicit engine-aware fetch for server routes, independent of global patching order. */
export async function engineFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await handleEngineRequest(input, init);
  return response ?? fetch(input, init);
}
