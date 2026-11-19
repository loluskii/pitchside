// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpecifierSelector } from "@/components/fixtures/SpecifierSelector";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });

  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = "";
});

describe("SpecifierSelector", () => {
  it("selects a dropdown option without triggering fixture row navigation", () => {
    const onSelect = vi.fn();
    const onFixtureClick = vi.fn();

    const host = render(
      <div onClick={onFixtureClick}>
        <SpecifierSelector
          activeSpecifier="total=1.5"
          label="1.5"
          onSelect={onSelect}
          options={[
            { specifier: "total=1.5", value: "1.5" },
            { specifier: "total=2.5", value: "2.5" },
          ]}
        />
      </div>,
    );

    const trigger = host.querySelector<HTMLButtonElement>(".lm-specifier-button");
    expect(trigger).toBeTruthy();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const floatingMenu = document.body.querySelector(".lm-specifier-menu-floating");
    expect(floatingMenu).toBeTruthy();

    const options = Array.from(document.body.querySelectorAll<HTMLButtonElement>(".lm-specifier-option"));
    const secondOption = options.find((option) => option.textContent === "2.5");
    expect(secondOption).toBeTruthy();

    act(() => {
      secondOption?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      secondOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("total=2.5");
    expect(onFixtureClick).not.toHaveBeenCalled();
    expect(document.body.querySelector(".lm-specifier-menu-floating")).toBeNull();
  });
});
