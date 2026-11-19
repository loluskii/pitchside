// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  useBetHistory: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: hookMocks.usePathname,
}));

vi.mock("@/lib/query/hooks/useBets", () => ({
  useBetHistory: hookMocks.useBetHistory,
}));

import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { useAuthStore } from "@/store/authStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function renderNavigation() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MobileNavigation />);
  });

  return { container, root };
}

describe("MobileNavigation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    hookMocks.usePathname.mockReset();
    hookMocks.useBetHistory.mockReset();
    hookMocks.usePathname.mockReturnValue("/");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a bets badge when the authenticated user has open bets", () => {
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    hookMocks.useBetHistory.mockReturnValue({
      data: {
        data: {
          count: 1,
          currentPage: 1,
          data: [{ id: "bet-1" }],
          lastPage: 1,
          nextPage: 0,
          prevPage: 0,
        },
        status_code: 200,
        status_description: "success",
      },
    });

    const { container, root } = renderNavigation();

    expect(hookMocks.useBetHistory).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 1, status: [-1, 5] }),
      true,
    );
    expect(container.querySelector(".nav-bets-badge")).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });

  it("does not show a bets badge when the user has no open bets", () => {
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    hookMocks.useBetHistory.mockReturnValue({
      data: {
        data: {
          count: 0,
          currentPage: 1,
          data: [],
          lastPage: 1,
          nextPage: 0,
          prevPage: 0,
        },
        status_code: 200,
        status_description: "success",
      },
    });

    const { container, root } = renderNavigation();

    expect(container.querySelector(".nav-bets-badge")).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("shows a bets badge when open bets come from the bet-service page envelope", () => {
    useAuthStore.setState((state) => ({ ...state, isAuthenticated: true }));
    hookMocks.useBetHistory.mockReturnValue({
      data: {
        data: {
          count: 1,
          currentPage: 1,
          data: [{ id: "bet-1" }],
          lastPage: 1,
          nextPage: 0,
          prevPage: 0,
        },
        status_code: 200,
        status_description: "success",
      },
    });

    const { container, root } = renderNavigation();

    expect(container.querySelector(".nav-bets-badge")).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });
});
