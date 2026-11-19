"use client";

import { useState } from "react";
import { useCouponStore } from "@/store/couponStore";

export function BookingCodeBar() {
  const [code, setCode] = useState("");
  const isLoading = useCouponStore((state) => state.isLoading);
  const requestLoadByCode = useCouponStore((state) => state.requestLoadByCode);

  async function handleLoad() {
    const trimmed = code.trim();
    if (!trimmed) return;
    await requestLoadByCode(trimmed);
  }

  return (
    <section className="px-2 pb-3 pt-2">
      <div className="flex items-center gap-3 rounded-xl bg-[#EEEEEC] px-3 py-3">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Paste a booking code"
          className="h-11 flex-1 rounded-md border border-white/15 bg-transparent px-3 text-md font-medium text-white outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-white/35"
        />
        <button
          type="button"
          onClick={handleLoad}
          disabled={!code.trim() || isLoading}
          className="h-11 shrink-0 rounded-md bg-[#E3E3DF] px-4 text-base font-semibold text-[#D22B34] transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? "Loading..." : "Load code"}
        </button>
      </div>
    </section>
  );
}
