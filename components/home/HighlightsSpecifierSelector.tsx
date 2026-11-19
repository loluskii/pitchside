"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown01Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";
import type { MarketSpecifierOption } from "@/lib/utils/home-fixtures";

type HighlightsSpecifierSelectorProps = {
  activeSpecifier: string;
  label: string;
  onSelect: (specifier: string) => void;
  options: MarketSpecifierOption[];
};

export function HighlightsSpecifierSelector({
  activeSpecifier,
  label,
  onSelect,
  options,
}: HighlightsSpecifierSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="fc-sf-select-wrap">
      <button
        type="button"
        className="fc-sf-select"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={options.length <= 1}
        onClick={() => {
          if (options.length > 1) {
            setIsOpen((open) => !open);
          }
        }}
      >
        <span>{label}</span>
        <ArrowDown01Icon
          className={cn("fc-sf-select-icon", isOpen && "open")}
          size={16}
          color="currentColor"
        />
      </button>

      {isOpen ? (
        <div className="fc-sf-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.specifier}
              type="button"
              className={cn("fc-sf-select-option", option.specifier === activeSpecifier && "active")}
              onClick={() => {
                onSelect(option.specifier);
                setIsOpen(false);
              }}
            >
              {option.value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
