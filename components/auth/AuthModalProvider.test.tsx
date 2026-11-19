// @vitest-environment jsdom

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockAuthModal({ requestedReturnUrl }: { requestedReturnUrl: string }) {
      return <div data-testid="auth-modal" data-return-url={requestedReturnUrl} />;
    },
}));

function renderProvider(queryClient: QueryClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AuthModalProvider>
          <div>App content</div>
        </AuthModalProvider>
      </QueryClientProvider>,
    );
  });

  return { container, root };
}

describe("AuthModalProvider", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  it("opens login modal and clears query cache when the session expires", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user", "notifications"], [{ id: 1 }]);
    window.history.replaceState(null, "", "/my-bets?page=2");
    const { container, root } = renderProvider(queryClient);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { returnUrl: `${window.location.pathname}${window.location.search}` },
        }),
      );
    });

    const modal = container.querySelector("[data-testid='auth-modal']");
    expect(modal).toBeTruthy();
    expect(modal?.getAttribute("data-return-url")).toBe("/my-bets?page=2");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    act(() => {
      root.unmount();
    });
  });
});
