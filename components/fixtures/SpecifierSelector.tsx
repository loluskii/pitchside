"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown01Icon } from "hugeicons-react";
import { MdLock } from "react-icons/md";
import type { MarketSpecifierOption } from "@/lib/utils/home-fixtures";

type SpecifierSelectorProps = {
  activeSpecifier: string;
  label: string;
  onSelect: (specifier: string) => void;
  options: MarketSpecifierOption[];
};

export function SpecifierSelector({
  activeSpecifier,
  label,
  onSelect,
  options,
}: SpecifierSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canOpen = options.length > 1;
  const isUnavailable = options.length === 0;

  function updateMenuPosition() {
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    setMenuRect({
      left: buttonRect.left,
      top: buttonRect.bottom + 4,
      width: buttonRect.width,
    });
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen, label]);

  useEffect(() => {
    document.body.dataset.fixtureSpecifierOpen = isOpen ? "true" : "false";
    return () => {
      if (document.body.dataset.fixtureSpecifierOpen === "true") {
        delete document.body.dataset.fixtureSpecifierOpen;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handlePositionChange() {
      updateMenuPosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handlePositionChange);
    window.addEventListener("scroll", handlePositionChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handlePositionChange);
      window.removeEventListener("scroll", handlePositionChange, true);
    };
  }, [isOpen]);

  function selectSpecifier(specifier: string) {
    onSelect(specifier);
    setIsOpen(false);
  }

  function handleOptionPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleOptionClick(event: MouseEvent<HTMLButtonElement>, specifier: string) {
    event.preventDefault();
    event.stopPropagation();
    selectSpecifier(specifier);
  }

  const menu =
    typeof document !== "undefined" && isOpen && menuRect
      ? createPortal(
          <div
            ref={menuRef}
            className="lm-specifier-menu lm-specifier-menu-floating"
            role="listbox"
            style={{
              left: menuRect.left,
              top: menuRect.top,
              width: menuRect.width,
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {options.map((option) => (
              <button
                key={option.specifier}
                type="button"
                className={`lm-specifier-option${
                  option.specifier === activeSpecifier ? " active" : ""
                }`}
                onPointerDown={handleOptionPointerDown}
                onClick={(event) => handleOptionClick(event, option.specifier)}
              >
                {option.value}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="lm-specifier fixture-specifier-width"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`lm-specifier-button${canOpen ? "" : " is-static"}`}
        aria-expanded={canOpen ? isOpen : undefined}
        aria-haspopup={canOpen ? "listbox" : undefined}
        aria-disabled={!canOpen}
        onClick={(event) => {
          event.stopPropagation();
          if (canOpen) {
            setIsOpen((open) => !open);
          }
        }}
      >
        {isUnavailable ? (
          <MdLock size={18} className="text-white/55" />
        ) : (
          <span className="lm-specifier-button-label">{label}</span>
        )}
        {canOpen ? <ArrowDown01Icon size={14} color="currentColor" /> : null}
      </button>

      {menu}
    </div>
  );
}
